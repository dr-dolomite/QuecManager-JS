#!/bin/sh
# Signal Metrics Logger with Atomic Token Operations
# Continuous background daemon for logging signal metrics
# Located in /www/cgi-bin/services/log_signal_metrics.sh

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

# Script identification for logging
SCRIPT_NAME_LOG="log_signal_metrics"

# Configuration
LOGDIR="/www/signal_graphs"
MAX_ENTRIES=10
INTERVAL=60
QUEUE_DIR="/tmp/at_queue"
TOKEN_FILE="$QUEUE_DIR/token"
TOKEN_LOCK_DIR="$QUEUE_DIR/token.lock"
METRICS_PID_FILE="/tmp/signal_metrics.pid"
TOKEN_TIMEOUT=30
TOKEN_LOCK_TIMEOUT=100  # 10 seconds
MAX_TOKEN_ATTEMPTS=20

# Ensure required directories exist
mkdir -p "$LOGDIR" "$QUEUE_DIR"

# Centralized logging wrapper with fallback
log_message() {
    local level="$1"
    local message="$2"
    
    # Use centralized logging if available, fallback to syslog
    if command -v qm_log_error >/dev/null 2>&1; then
        case "$level" in
            "error")
                qm_log_error "service" "$SCRIPT_NAME_LOG" "$message"
                ;;
            "warn")
                qm_log_warn "service" "$SCRIPT_NAME_LOG" "$message"
                ;;
            "info")
                qm_log_info "service" "$SCRIPT_NAME_LOG" "$message"
                ;;
            *)
                qm_log_info "service" "$SCRIPT_NAME_LOG" "$message"
                ;;
        esac
    else
        # Fallback to syslog
        logger -t signal_metrics -p "daemon.$level" "$message"
    fi
}

# Check if another instance is running
check_running() {
    if [ -f "$METRICS_PID_FILE" ]; then
        pid=$(cat "$METRICS_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
        rm -f "$METRICS_PID_FILE" 2>/dev/null
    fi
    return 1
}

# Atomic lock functions for token operations
acquire_token_lock() {
    local attempt=0
    
    while [ $attempt -lt $TOKEN_LOCK_TIMEOUT ]; do
        if mkdir "$TOKEN_LOCK_DIR" 2>/dev/null; then
            return 0
        fi
        
        sleep 0.1
        attempt=$((attempt + 1))
    done
    
    log_message "error" "Failed to acquire token lock after timeout"
    return 1
}

release_token_lock() {
    if [ -d "$TOKEN_LOCK_DIR" ]; then
        rmdir "$TOKEN_LOCK_DIR" 2>/dev/null
        return 0
    fi
    
    log_message "warn" "Token lock directory doesn't exist during release"
    return 1
}

# Acquire token with atomic operations
acquire_token() {
    local metrics_id="METRICS_$(date +%s)_$$"
    local priority=20  # Lowest priority for background metrics
    local attempt=0
    
    while [ $attempt -lt $MAX_TOKEN_ATTEMPTS ]; do
        # Acquire atomic lock for token operations
        if ! acquire_token_lock; then
            log_message "error" "Failed to acquire token lock"
            return 1
        fi
        
        # Now we have exclusive access to token file
        local should_create_token=0
        
        # Check if token file exists
        if [ -f "$TOKEN_FILE" ]; then
            local current_holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
            local current_priority=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.priority' 2>/dev/null)
            local timestamp=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.timestamp' 2>/dev/null)
            local current_time=$(date +%s)
            
            # Check for expired token (> TOKEN_TIMEOUT seconds)
            if [ $((current_time - timestamp)) -gt $TOKEN_TIMEOUT ] || [ -z "$current_holder" ]; then
                log_message "warn" "Removing expired token from ${current_holder}"
                rm -f "$TOKEN_FILE" 2>/dev/null
                should_create_token=1
            elif [ $priority -lt $current_priority ]; then
                # This should rarely happen since metrics has lowest priority (20)
                log_message "info" "Preempting token from ${current_holder} (priority $current_priority)"
                rm -f "$TOKEN_FILE" 2>/dev/null
                should_create_token=1
            else
                # Token held by higher priority, release lock and retry
                release_token_lock
                sleep 0.5
                attempt=$((attempt + 1))
                continue
            fi
        else
            should_create_token=1
        fi
        
        # Create token if we should
        if [ $should_create_token -eq 1 ]; then
            printf '{"id":"%s","priority":%d,"timestamp":%d}' \
                "$metrics_id" "$priority" "$(date +%s)" > "$TOKEN_FILE" 2>/dev/null
            chmod 644 "$TOKEN_FILE" 2>/dev/null
            
            # Verify we got the token (read back atomically)
            local holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
            
            if [ "$holder" = "$metrics_id" ]; then
                release_token_lock
                echo "$metrics_id"
                return 0
            else
                log_message "warn" "Token verification failed, holder: $holder, expected: $metrics_id"
            fi
        fi
        
        # Release lock before retry
        release_token_lock
        sleep 0.5
        attempt=$((attempt + 1))
    done
    
    log_message "warn" "Failed to acquire token after $MAX_TOKEN_ATTEMPTS attempts"
    return 1
}

# Release token with atomic operations
release_token() {
    local metrics_id="$1"
    
    # Acquire atomic lock for token operations
    if ! acquire_token_lock; then
        log_message "error" "Failed to acquire token lock for release"
        return 1
    fi
    
    if [ -f "$TOKEN_FILE" ]; then
        local current_holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
        
        if [ "$current_holder" = "$metrics_id" ]; then
            rm -f "$TOKEN_FILE" 2>/dev/null
            release_token_lock
            return 0
        else
            log_message "warn" "Token release attempted but held by different owner: $current_holder"
        fi
    fi
    
    release_token_lock
    return 1
}

# Execute AT command directly
execute_at_command() {
    local CMD="$1"
    sms_tool at "$CMD" -t 3 2>/dev/null
}

# Process all metrics commands with a single token
process_all_metrics() {
    # Try to get token
    local metrics_id=$(acquire_token)
    if [ -z "$metrics_id" ]; then
        log_message "warn" "Could not acquire token for metrics - will try again later"
        return 1
    fi
    
    # Execute all metrics commands with the single token
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    # RSRP
    local rsrp_output=$(execute_at_command "AT+QRSRP")
    if [ -n "$rsrp_output" ] && echo "$rsrp_output" | grep -q "QRSRP"; then
        local logfile="$LOGDIR/rsrp.json"
        [ ! -s "$logfile" ] && echo "[]" > "$logfile"
        
        local temp_file="${logfile}.tmp.$$"
        jq --arg dt "$timestamp" \
           --arg out "$rsrp_output" \
           '. + [{"datetime": $dt, "output": $out}] | .[-'"$MAX_ENTRIES"':]' \
           "$logfile" > "$temp_file" 2>/dev/null && mv "$temp_file" "$logfile"
        chmod 644 "$logfile"
    fi
    
    sleep 0.1
    
    # RSRQ
    local rsrq_output=$(execute_at_command "AT+QRSRQ")
    if [ -n "$rsrq_output" ] && echo "$rsrq_output" | grep -q "QRSRQ"; then
        local logfile="$LOGDIR/rsrq.json"
        [ ! -s "$logfile" ] && echo "[]" > "$logfile"
        
        local temp_file="${logfile}.tmp.$$"
        jq --arg dt "$timestamp" \
           --arg out "$rsrq_output" \
           '. + [{"datetime": $dt, "output": $out}] | .[-'"$MAX_ENTRIES"':]' \
           "$logfile" > "$temp_file" 2>/dev/null && mv "$temp_file" "$logfile"
        chmod 644 "$logfile"
    fi
    
    sleep 0.1
    
    # SINR
    local sinr_output=$(execute_at_command "AT+QSINR")
    if [ -n "$sinr_output" ] && echo "$sinr_output" | grep -q "QSINR"; then
        local logfile="$LOGDIR/sinr.json"
        [ ! -s "$logfile" ] && echo "[]" > "$logfile"
        
        local temp_file="${logfile}.tmp.$$"
        jq --arg dt "$timestamp" \
           --arg out "$sinr_output" \
           '. + [{"datetime": $dt, "output": $out}] | .[-'"$MAX_ENTRIES"':]' \
           "$logfile" > "$temp_file" 2>/dev/null && mv "$temp_file" "$logfile"
        chmod 644 "$logfile"
    fi
    
    sleep 0.1
    
    # Data usage
    local usage_output=$(execute_at_command "AT+QGDCNT?;+QGDNRCNT?")
    if [ -n "$usage_output" ] && echo "$usage_output" | grep -q "QGDCNT\|QGDNRCNT"; then
        local logfile="$LOGDIR/data_usage.json"
        [ ! -s "$logfile" ] && echo "[]" > "$logfile"
        
        local temp_file="${logfile}.tmp.$$"
        jq --arg dt "$timestamp" \
           --arg out "$usage_output" \
           '. + [{"datetime": $dt, "output": $out}] | .[-'"$MAX_ENTRIES"':]' \
           "$logfile" > "$temp_file" 2>/dev/null && mv "$temp_file" "$logfile"
        chmod 644 "$logfile"
    fi

    sleep 0.1

    # QCAINFO with timestamp
    local qcainfo_output=$(execute_at_command "AT+QCAINFO")
    if [ -n "$qcainfo_output" ] && echo "$qcainfo_output" | grep -q "QCAINFO"; then
        local logfile="$LOGDIR/qcainfo.json"
        [ ! -s "$logfile" ] && echo "[]" > "$logfile"

        local temp_file="${logfile}.tmp.$$"
        jq --arg dt "$timestamp" \
           --arg out "$qcainfo_output" \
           '. + [{"datetime": $dt, "output": $out}] | .[-'"$MAX_ENTRIES"':]' \
           "$logfile" > "$temp_file" 2>/dev/null && mv "$temp_file" "$logfile"
        chmod 644 "$logfile"
    fi

    sleep 0.1

    # Servingcell with timestamp
    local servingcell_output=$(execute_at_command "AT+QENG=\"servingcell\"")
    if [ -n "$servingcell_output" ] && echo "$servingcell_output" | grep -q "QENG"; then
        local logfile="$LOGDIR/servingcell.json"
        [ ! -s "$logfile" ] && echo "[]" > "$logfile"

        local temp_file="${logfile}.tmp.$$"
        jq --arg dt "$timestamp" \
           --arg out "$servingcell_output" \
           '. + [{"datetime": $dt, "output": $out}] | .[-'"$MAX_ENTRIES"':]' \
           "$logfile" > "$temp_file" 2>/dev/null && mv "$temp_file" "$logfile"
        chmod 644 "$logfile"
    fi

    # Release token
    release_token "$metrics_id"
    return 0
}

# Main continuous logging function with proper locking
start_continuous_logging() {
    # Check if already running
    if check_running; then
        log_message "error" "Signal metrics logging already running"
        exit 1
    fi
    
    # Store PID
    echo "$$" > "$METRICS_PID_FILE"
    chmod 644 "$METRICS_PID_FILE"
    
    # Cleanup trap - remove PID file and any stale lock
    trap 'rm -f "$METRICS_PID_FILE"; rmdir "$TOKEN_LOCK_DIR" 2>/dev/null; exit 0' INT TERM
    
    sleep 20  # Initial delay to allow system startup
    log_message "info" "Started continuous signal metrics logging (PID: $$, Priority: 20)"

    while true; do
        process_all_metrics
        sleep "$INTERVAL"
    done
}

# Start the continuous logging
start_continuous_logging