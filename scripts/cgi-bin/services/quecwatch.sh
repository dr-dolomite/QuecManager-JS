#!/bin/sh

# QuecWatch Daemon with Atomic Token Operations
# Monitors cellular connectivity and performs recovery actions

# Load UCI configuration functions
. /lib/functions.sh

# Load centralized logging
LOGGER_SCRIPT="/www/cgi-bin/quecmanager/services/quecmanager_logger.sh"
if [ -f "$LOGGER_SCRIPT" ]; then
    . "$LOGGER_SCRIPT"
    USE_CENTRALIZED_LOGGING=1
else
    USE_CENTRALIZED_LOGGING=0
fi

# Configuration
QUEUE_DIR="/tmp/at_queue"
TOKEN_FILE="$QUEUE_DIR/token"
TOKEN_LOCK_DIR="$QUEUE_DIR/token.lock"
LOG_DIR="/tmp/log/quecwatch"
LOG_FILE="$LOG_DIR/quecwatch.log"
PID_FILE="/var/run/quecwatch.pid"
STATUS_FILE="/tmp/quecwatch_status.json"
RETRY_COUNT_FILE="/tmp/quecwatch_retry_count"
UCI_CONFIG="quecmanager"
MAX_TOKEN_ATTEMPTS=10  # Maximum attempts to acquire token
TOKEN_TIMEOUT=30       # Token timeout in seconds
TOKEN_LOCK_TIMEOUT=100 # 10 seconds for token lock acquisition
TOKEN_PRIORITY=15      # Medium priority (between profiles and metrics)

# Ensure directories exist
mkdir -p "$LOG_DIR" "$QUEUE_DIR"

# Store PID
echo "$$" > "$PID_FILE"
chmod 644 "$PID_FILE"

# Function to log messages
log_message() {
    local message="$1"
    local level="${2:-info}"
    
    # Use centralized logging if available
    if [ "$USE_CENTRALIZED_LOGGING" -eq 1 ]; then
        case "$level" in
            error)
                qm_log_error "service" "quecwatch" "$message"
                ;;
            warn)
                qm_log_warn "service" "quecwatch" "$message"
                ;;
            debug)
                qm_log_debug "service" "quecwatch" "$message"
                ;;
            info|*)
                qm_log_info "service" "quecwatch" "$message"
                ;;
        esac
    fi
    
    # Also log to legacy file for backward compatibility
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # Log to system log
    logger -t quecwatch -p "daemon.$level" "$message"
}

# Function to update status
update_status() {
    local status="$1"
    local message="$2"
    local retry="${3:-$CURRENT_RETRIES}"
    local max="${4:-$MAX_RETRIES}"
    local latency="${5:-$CURRENT_LATENCY}"
    local latency_ceiling="${6:-$LATENCY_CEILING}"
    
    # Create JSON status
    cat > "$STATUS_FILE" <<EOF
{
    "status": "$status",
    "message": "$message",
    "retry": $retry,
    "maxRetries": $max,
    "currentLatency": $latency,
    "latencyCeiling": $latency_ceiling,
    "timestamp": $(date +%s)
}
EOF
    chmod 644 "$STATUS_FILE"
    
    log_message "Status updated: $status - $message (latency: ${latency}ms)" "debug"
}

# Atomic lock functions for token operations
acquire_token_lock() {
    local attempt=0
    
    while [ $attempt -lt $TOKEN_LOCK_TIMEOUT ]; do
        if mkdir "$TOKEN_LOCK_DIR" 2>/dev/null; then
            log_message "Token lock acquired" "debug"
            return 0
        fi
        
        sleep 0.1
        attempt=$((attempt + 1))
    done
    
    log_message "Failed to acquire token lock after timeout" "error"
    return 1
}

release_token_lock() {
    if [ -d "$TOKEN_LOCK_DIR" ]; then
        rmdir "$TOKEN_LOCK_DIR" 2>/dev/null
        log_message "Token lock released" "debug"
        return 0
    fi
    
    log_message "Token lock directory doesn't exist during release" "warn"
    return 1
}

# Function to acquire token with atomic operations
acquire_token() {
    local requestor_id="QUECWATCH_$(date +%s)_$$"
    local priority="$TOKEN_PRIORITY"
    local attempt=0
    
    log_message "Attempting to acquire token with priority $priority" "debug"
    
    while [ $attempt -lt $MAX_TOKEN_ATTEMPTS ]; do
        # Acquire atomic lock for token operations
        if ! acquire_token_lock; then
            log_message "Failed to acquire token lock" "error"
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
                log_message "Found expired token from $current_holder, removing" "debug"
                rm -f "$TOKEN_FILE" 2>/dev/null
                should_create_token=1
            elif [ $priority -lt $current_priority ]; then
                log_message "Preempting token from $current_holder (priority: $current_priority)" "info"
                rm -f "$TOKEN_FILE" 2>/dev/null
                should_create_token=1
            else
                # Token held by higher/equal priority, release lock and retry
                release_token_lock
                
                # Log more descriptive waiting messages
                if echo "$current_holder" | grep -q "CELL_SCAN"; then
                    log_message "Token held by cell scan (priority: $current_priority), waiting (attempt $attempt)..." "debug"
                elif echo "$current_holder" | grep -q "QUECPROFILES"; then
                    log_message "Token held by profile application (priority: $current_priority), waiting (attempt $attempt)..." "debug"
                elif echo "$current_holder" | grep -q "AT_CLIENT"; then
                    log_message "Token held by frontend request (priority: $current_priority), waiting (attempt $attempt)..." "debug"
                else
                    log_message "Token held by $current_holder with priority $current_priority, waiting (attempt $attempt)..." "debug"
                fi
                
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
                "$requestor_id" "$priority" "$(date +%s)" > "$TOKEN_FILE" 2>/dev/null
            chmod 644 "$TOKEN_FILE" 2>/dev/null
            
            # Verify we got the token (read back atomically)
            local holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
            
            if [ "$holder" = "$requestor_id" ]; then
                log_message "Successfully acquired token with ID $requestor_id (priority: $priority)" "debug"
                release_token_lock
                echo "$requestor_id"
                return 0
            else
                log_message "Token verification failed, holder: $holder, expected: $requestor_id" "warn"
            fi
        fi
        
        # Release lock before retry
        release_token_lock
        sleep 0.5
        attempt=$((attempt + 1))
    done
    
    log_message "Failed to acquire token after $MAX_TOKEN_ATTEMPTS attempts" "error"
    return 1
}

# Function to release token with atomic operations
release_token() {
    local requestor_id="$1"
    
    # Acquire atomic lock for token operations
    if ! acquire_token_lock; then
        log_message "Failed to acquire token lock for release" "error"
        return 1
    fi
    
    if [ -f "$TOKEN_FILE" ]; then
        local current_holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
        if [ "$current_holder" = "$requestor_id" ]; then
            rm -f "$TOKEN_FILE" 2>/dev/null
            log_message "Released token $requestor_id" "debug"
            release_token_lock
            return 0
        else
            log_message "Token held by $current_holder, not by us ($requestor_id)" "warn"
        fi
    else
        log_message "Token file doesn't exist, nothing to release" "debug"
    fi
    
    release_token_lock
    return 1
}

# Function to execute AT command with token
execute_at_command() {
    local cmd="$1"
    local timeout="${2:-5}"
    local token_id="$3"
    
    if [ -z "$token_id" ]; then
        log_message "No valid token provided for command: $cmd" "error"
        return 1
    fi
    
    log_message "Executing AT command: $cmd (timeout: ${timeout}s)" "debug"
    
    # Execute the command with proper timeout
    local output
    local status=1
    
    output=$(sms_tool at "$cmd" -t "$timeout" 2>&1)
    status=$?
    
    if [ $status -ne 0 ]; then
        log_message "AT command failed: $cmd (exit code: $status)" "error"
        return 1
    fi
    
    echo "$output"
    return 0
}

# Function to check internet connectivity
check_internet() {
    local ping_target
    local ping_count=3
    
    # Get ping target from UCI
    config_load "$UCI_CONFIG"
    config_get ping_target quecwatch ping_target
    
    if [ -z "$ping_target" ]; then
        log_message "No ping target configured" "error"
        return 1
    fi
    
    log_message "Checking internet connectivity to $ping_target" "debug"
    
    if ping -c $ping_count "$ping_target" > /dev/null 2>&1; then
        log_message "Internet connectivity check successful" "debug"
        return 0
    else
        log_message "Internet connectivity check failed" "warn"
        return 1
    fi
}

# Function to check internet connectivity with latency measurement
check_internet_with_latency() {
    local ping_target
    local ping_count=3
    local ping_output
    local status
    
    # Get ping target from UCI
    config_load "$UCI_CONFIG"
    config_get ping_target quecwatch ping_target
    
    if [ -z "$ping_target" ]; then
        log_message "No ping target configured" "error"
        CURRENT_LATENCY=0
        return 1
    fi
    
    log_message "Measuring latency to $ping_target" "debug"
    
    # Execute ping and capture output
    ping_output=$(ping -c $ping_count "$ping_target" 2>&1)
    status=$?
    
    if [ $status -eq 0 ]; then
        # Extract average latency from ping output
        # Look for patterns like "round-trip min/avg/max = 99.687/169.223/272.216 ms"
        local stats_line=$(echo "$ping_output" | grep "round-trip min/avg/max")
        if [ -n "$stats_line" ]; then
            # Extract the average (second value) from min/avg/max
            local avg_latency=$(echo "$stats_line" | cut -d'=' -f2 | cut -d'/' -f2)
            if [ -n "$avg_latency" ]; then
                # Convert to integer (remove decimal part)
                CURRENT_LATENCY=$(echo "$avg_latency" | cut -d'.' -f1)
                [ -z "$CURRENT_LATENCY" ] && CURRENT_LATENCY=0
            else
                CURRENT_LATENCY=0
            fi
        else
            # Fallback: try to extract latency from individual ping lines
            local latency_line=$(echo "$ping_output" | grep "time=" | head -1)
            if [ -n "$latency_line" ]; then
                CURRENT_LATENCY=$(echo "$latency_line" | grep -o 'time=[0-9.]*' | cut -d'=' -f2 | cut -d'.' -f1 | head -1)
                [ -z "$CURRENT_LATENCY" ] && CURRENT_LATENCY=0
            else
                CURRENT_LATENCY=0
            fi
        fi
        
        log_message "Latency measurement successful: ${CURRENT_LATENCY}ms" "debug"
        return 0
    else
        log_message "Latency measurement failed - no connectivity" "warn"
        CURRENT_LATENCY=0
        return 1
    fi
}

# Function to get current SIM slot
get_current_sim() {
    local token_id=$(acquire_token)
    if [ -z "$token_id" ]; then
        log_message "Failed to acquire token for SIM slot check" "error"
        return 1
    fi
    
    log_message "Checking current SIM slot" "debug"
    
    local result=$(execute_at_command "AT+QUIMSLOT?" 5 "$token_id")
    local status=$?
    
    # Release token
    release_token "$token_id"
    
    if [ $status -eq 0 ] && [ -n "$result" ]; then
        # Extract SIM slot number from response
        local current_sim=$(echo "$result" | grep -o '+QUIMSLOT: [0-9]' | cut -d' ' -f2)
        
        if [ -n "$current_sim" ]; then
            log_message "Current SIM slot: $current_sim" "debug"
            echo "$current_sim"
            return 0
        fi
    fi
    
    log_message "Failed to get current SIM slot" "error"
    return 1
}

# Function to switch SIM card
switch_sim_card() {
    local current_sim
    local target_sim
    local token_id
    
    log_message "Starting SIM card switch operation" "info"
    
    # Get current SIM slot
    current_sim=$(get_current_sim)
    if [ $? -ne 0 ]; then
        log_message "Failed to get current SIM slot, cannot switch" "error"
        return 1
    fi
    
    # Determine target SIM
    if [ "$current_sim" = "1" ]; then
        target_sim=2
    else
        target_sim=1
    fi
    
    log_message "Attempting to switch from SIM $current_sim to SIM $target_sim" "info"
    
    # Get token for AT commands
    token_id=$(acquire_token)
    if [ -z "$token_id" ]; then
        log_message "Failed to acquire token for SIM switch" "error"
        return 1
    fi
    
    # Detach from network
    log_message "Detaching from network" "debug"
    execute_at_command "AT+COPS=2" 10 "$token_id"
    sleep 2
    
    # Switch SIM slot
    log_message "Switching to SIM slot $target_sim" "debug"
    local switch_result=$(execute_at_command "AT+QUIMSLOT=$target_sim" 10 "$token_id")
    local switch_status=$?
    
    # If switch failed, return error
    if [ $switch_status -ne 0 ]; then
        log_message "Failed to switch to SIM $target_sim" "error"
        release_token "$token_id"
        return 1
    fi
    
    sleep 5
    
    # Reattach to network
    log_message "Reattaching to network" "debug"
    execute_at_command "AT+COPS=0" 10 "$token_id"
    
    # Release token
    release_token "$token_id"
    
    # Verify switch
    sleep 10
    local new_sim=$(get_current_sim)
    if [ "$new_sim" = "$target_sim" ]; then
        log_message "Successfully switched to SIM $target_sim" "info"
        return 0
    else
        log_message "Failed to verify SIM switch, current SIM is $new_sim" "error"
        return 1
    fi
}

# Function to perform connection recovery
perform_connection_recovery() {
    local token_id
    
    log_message "Starting connection recovery" "info"
    update_status "recovering" "Connection recovery in progress - monitoring paused" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
    
    # Get token for AT commands
    token_id=$(acquire_token)
    if [ -z "$token_id" ]; then
        log_message "Failed to acquire token for connection recovery" "error"
        update_status "error" "Failed to acquire token for recovery" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
        return 1
    fi

    # First check if CFUN is 1, if not set it to 1
    local cfun_status=$(execute_at_command "AT+CFUN?" 5 "$token_id")
    if [ $? -ne 0 ]; then
        log_message "Failed to get CFUN status" "error"
        release_token "$token_id"
        update_status "error" "Failed to get CFUN status" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
        return 1
    fi

    if echo "$cfun_status" | grep -q '+CFUN: 1'; then
        log_message "CFUN is already 1, no action needed" "debug"
    else
        log_message "Setting CFUN to 1"
        update_status "recovering" "Setting CFUN to 1" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
        execute_at_command "AT+CFUN=1" 10 "$token_id"
        sleep 2
        
        # Recheck CFUN status
        cfun_status=$(execute_at_command "AT+CFUN?" 5 "$token_id")
        if [ $? -ne 0 ] || ! echo "$cfun_status" | grep -q '+CFUN: 1'; then
            log_message "Failed to set CFUN to 1" "error"
            release_token "$token_id"
            update_status "error" "Failed to set CFUN to 1" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
            return 1
        fi

        log_message "CFUN set to 1 successfully" "debug"
        sleep 2
    fi
    
    # Detach from network
    log_message "Detaching from network" "debug"
    update_status "recovering" "Detaching from network" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
    execute_at_command "AT+COPS=2" 10 "$token_id"
    sleep 2
    
    # Reattach to network
    log_message "Reattaching to network" "debug"
    update_status "recovering" "Reattaching to network" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
    execute_at_command "AT+COPS=0" 15 "$token_id"
    sleep 1
    
    # Release token
    release_token "$token_id"
    
    # Wait for network to stabilize before verification
    log_message "Waiting for network to stabilize (10 seconds)" "debug"
    update_status "recovering" "Waiting for network to stabilize" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
    sleep 10
    
    # Verify recovery with appropriate check
    log_message "Verifying connection recovery" "debug"
    update_status "recovering" "Verifying connection recovery" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
    
    local recovery_check=0
    if [ "$HIGH_LATENCY_MONITORING" -eq 1 ]; then
        if check_internet_with_latency; then
            # Also check if latency is acceptable after recovery
            if [ "$CURRENT_LATENCY" -le "$LATENCY_CEILING" ]; then
                recovery_check=1
            else
                log_message "Recovery succeeded but latency still high: ${CURRENT_LATENCY}ms > ${LATENCY_CEILING}ms" "warn"
            fi
        fi
    else
        if check_internet; then
            recovery_check=1
        fi
    fi
    
    if [ $recovery_check -eq 1 ]; then
        log_message "Connection recovery successful" "info"
        update_status "recovered" "Connection recovery successful" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
        
        # Add grace period after successful recovery
        log_message "Grace period: waiting 20 seconds before resuming monitoring" "debug"
        sleep 20
        
        return 0
    else
        log_message "Connection recovery failed" "error"
        update_status "error" "Connection recovery failed" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
        return 1
    fi
}

# Load configuration
load_config() {
    # Initialize variables
    PING_TARGET=""
    PING_INTERVAL=60
    PING_FAILURES=3
    MAX_RETRIES=5
    CURRENT_RETRIES=0
    CONNECTION_REFRESH=0
    REFRESH_COUNT=3
    AUTO_SIM_FAILOVER=0
    SIM_FAILOVER_SCHEDULE=0
    HIGH_LATENCY_MONITORING=0
    LATENCY_CEILING=150
    LATENCY_FAILURES=""
    CURRENT_LATENCY=0
    LATENCY_FAILURE_COUNT=0
    
    # Load from UCI
    config_load "$UCI_CONFIG"
    
    # Get settings with defaults
    config_get PING_TARGET quecwatch ping_target
    config_get PING_INTERVAL quecwatch ping_interval 60
    config_get PING_FAILURES quecwatch ping_failures 3
    config_get MAX_RETRIES quecwatch max_retries 5
    config_get CURRENT_RETRIES quecwatch current_retries 0
    config_get_bool CONNECTION_REFRESH quecwatch connection_refresh 0
    config_get REFRESH_COUNT quecwatch refresh_count 3
    config_get_bool AUTO_SIM_FAILOVER quecwatch auto_sim_failover 0
    config_get SIM_FAILOVER_SCHEDULE quecwatch sim_failover_schedule 0
    
    # Handle high latency monitoring (could be 'true'/'false' or '1'/'0')
    local latency_monitoring_raw
    config_get latency_monitoring_raw quecwatch high_latency_monitoring "false"
    if [ "$latency_monitoring_raw" = "true" ] || [ "$latency_monitoring_raw" = "1" ]; then
        HIGH_LATENCY_MONITORING=1
    else
        HIGH_LATENCY_MONITORING=0
    fi
    
    config_get LATENCY_CEILING quecwatch latency_ceiling 150
    config_get LATENCY_FAILURES quecwatch latency_failures 3
    
    # Debug logging for latency configuration
    log_message "Loaded latency configuration: HIGH_LATENCY_MONITORING=$HIGH_LATENCY_MONITORING, LATENCY_CEILING=$LATENCY_CEILING, LATENCY_FAILURES=$LATENCY_FAILURES" "debug"
    
    # Validate required settings
    if [ -z "$PING_TARGET" ]; then
        log_message "No ping target configured, using default (8.8.8.8)" "warn"
        PING_TARGET="8.8.8.8"
        uci set "$UCI_CONFIG.quecwatch.ping_target=$PING_TARGET"
        uci commit "$UCI_CONFIG"
    fi
    
    # Load persisted retry count if available
    if [ -f "$RETRY_COUNT_FILE" ]; then
        CURRENT_RETRIES=$(cat "$RETRY_COUNT_FILE")
    fi
    
    log_message "Configuration loaded: ping_target=$PING_TARGET, interval=$PING_INTERVAL, failures=$PING_FAILURES, max_retries=$MAX_RETRIES, current_retries=$CURRENT_RETRIES, latency_monitoring=$HIGH_LATENCY_MONITORING, latency_ceiling=$LATENCY_CEILING" "info"
}

# Save retry count to both UCI and file
save_retry_count() {
    local count=$1
    
    # Update UCI
    uci set "$UCI_CONFIG.quecwatch.current_retries=$count"
    uci commit "$UCI_CONFIG"
    
    # Update file for crash recovery
    echo "$count" > "$RETRY_COUNT_FILE"
    chmod 644 "$RETRY_COUNT_FILE"
    
    log_message "Updated retry count to $count" "debug"
}

# Main monitoring function
main() {
    log_message "QuecWatch daemon starting with Atomic Token Operations (PID: $$)" "info"
    
    # Load configuration
    load_config
    
    # Initial status update
    update_status "active" "Monitoring started" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
    
    # Track consecutive failures
    local failure_count=0
    
    # For scheduled SIM failover
    local sim_failover_interval=0
    local initial_sim=""
    
    # If auto SIM failover is enabled, store initial SIM slot
    if [ "$AUTO_SIM_FAILOVER" -eq 1 ]; then
        initial_sim=$(get_current_sim)
        if [ -n "$initial_sim" ]; then
            log_message "Auto SIM failover enabled, initial SIM slot: $initial_sim" "info"
        fi
    fi
    
    # Main monitoring loop
    while true; do
        log_message "Starting monitoring cycle (latency_monitoring=$HIGH_LATENCY_MONITORING)" "debug"
        
        # Flag to track if recovery was performed this cycle
        local recovery_performed=0
        
        # Connection monitoring logic - two separate paths
        local connectivity_ok=0
        
        if [ "$HIGH_LATENCY_MONITORING" -eq 1 ]; then
            # HIGH LATENCY MONITORING MODE
            # Use latency-aware ping - handles both connectivity AND latency
            if check_internet_with_latency; then
                # Ping succeeded - we have internet
                # Now check if latency is acceptable
                if [ "$CURRENT_LATENCY" -gt "$LATENCY_CEILING" ]; then
                    LATENCY_FAILURE_COUNT=$((LATENCY_FAILURE_COUNT + 1))
                    log_message "High latency detected: ${CURRENT_LATENCY}ms > ${LATENCY_CEILING}ms (failures: $LATENCY_FAILURE_COUNT/$LATENCY_FAILURES)" "warn"
                    
                    # Check if latency failure threshold is reached
                    if [ $LATENCY_FAILURE_COUNT -ge $LATENCY_FAILURES ]; then
                        log_message "Latency failure threshold reached ($LATENCY_FAILURE_COUNT/$LATENCY_FAILURES), treating as connectivity failure" "warn"
                        connectivity_ok=0  # Treat as failure to trigger retry logic
                        LATENCY_FAILURE_COUNT=0  # Reset latency failure counter
                    else
                        connectivity_ok=1  # Latency high but not threshold yet
                    fi
                else
                    # Latency is acceptable
                    connectivity_ok=1
                    # Reset latency failure counter if latency is good
                    if [ $LATENCY_FAILURE_COUNT -gt 0 ]; then
                        log_message "Latency improved: ${CURRENT_LATENCY}ms <= ${LATENCY_CEILING}ms, resetting latency failure counter" "info"
                        LATENCY_FAILURE_COUNT=0
                    fi
                fi
            else
                # Ping failed - no internet connectivity
                log_message "No internet connectivity" "warn"
                connectivity_ok=0
                CURRENT_LATENCY=0
            fi
        else
            # STANDARD CONNECTION MONITORING MODE
            # Use standard ping - only checks connectivity
            if check_internet; then
                connectivity_ok=1
                CURRENT_LATENCY=0  # No latency data when monitoring is disabled
            else
                connectivity_ok=0
                CURRENT_LATENCY=0
            fi
        fi
        
        # Process connectivity results - unified logic for both modes
        if [ $connectivity_ok -eq 0 ]; then
            failure_count=$((failure_count + 1))
            
            # Use appropriate failure threshold based on monitoring mode
            local failure_threshold
            if [ $HIGH_LATENCY_MONITORING -eq 1 ]; then
                failure_threshold=$LATENCY_FAILURES
            else
                failure_threshold=$PING_FAILURES
            fi
            
            log_message "Connectivity check failed ($failure_count/$failure_threshold)" "warn"
            
            # Update status
            update_status "warning" "Connection check failed: $failure_count/$failure_threshold failures" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
            
            # Check if failure threshold is reached
            if [ $failure_count -ge $failure_threshold ]; then
                # Reset failure counter
                failure_count=0
                
                # Increment retry counter
                CURRENT_RETRIES=$((CURRENT_RETRIES + 1))
                save_retry_count $CURRENT_RETRIES
                
                log_message "Failure threshold reached. Current retry: $CURRENT_RETRIES/$MAX_RETRIES" "warn"
                update_status "error" "Connection lost, attempt $CURRENT_RETRIES/$MAX_RETRIES to recover" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
                
                # Check if max retries reached
                if [ $CURRENT_RETRIES -ge $MAX_RETRIES ]; then
                    log_message "Maximum retries reached" "error"
                    
                    # Try SIM failover if enabled
                    if [ "$AUTO_SIM_FAILOVER" -eq 1 ]; then
                        log_message "Attempting SIM failover" "info"
                        update_status "failover" "Maximum retries reached, attempting SIM failover"
                        
                        local sim_failover_success=0
                        if switch_sim_card; then
                            if [ "$HIGH_LATENCY_MONITORING" -eq 1 ]; then
                                if check_internet_with_latency && [ "$CURRENT_LATENCY" -le "$LATENCY_CEILING" ]; then
                                    sim_failover_success=1
                                fi
                            else
                                if check_internet; then
                                    sim_failover_success=1
                                fi
                            fi
                        fi
                        
                        if [ $sim_failover_success -eq 1 ]; then
                            log_message "SIM failover successful, connection restored" "info"
                            update_status "recovered" "Connection restored via SIM failover"
                            
                            # Reset retry counter
                            CURRENT_RETRIES=0
                            save_retry_count $CURRENT_RETRIES
                        else
                            log_message "SIM failover failed, system will reboot" "error"
                            update_status "rebooting" "SIM failover failed, system will reboot"
                            
                            # Reset retry counter before reboot
                            CURRENT_RETRIES=0
                            save_retry_count $CURRENT_RETRIES
                            
                            # Wait briefly and reboot
                            sleep 5
                            reboot
                        fi
                    else
                        log_message "Auto SIM failover disabled, system will reboot" "error"
                        update_status "rebooting" "Maximum retries reached, system will reboot"
                        
                        # Reset retry counter before reboot
                        CURRENT_RETRIES=0
                        save_retry_count $CURRENT_RETRIES
                        
                        # Wait briefly and reboot
                        sleep 5
                        reboot
                    fi
                else
                    # Handle connection refresh logic
                    if [ $CURRENT_RETRIES -eq 1 ] && [ "$CONNECTION_REFRESH" -eq 1 ]; then
                        # First retry with connection refresh enabled - attempt recovery
                        log_message "First retry with connection refresh enabled, attempting connection recovery" "info"
                        
                        if perform_connection_recovery; then
                            log_message "Connection recovery successful" "info"
                            
                            # Mark that recovery was performed
                            recovery_performed=1
                            
                            # Reset retry counter
                            CURRENT_RETRIES=0
                            save_retry_count $CURRENT_RETRIES
                            
                            # Reset failure count
                            failure_count=0
                        else
                            log_message "Connection recovery failed, will wait for next cycle" "warn"
                            update_status "error" "Connection recovery failed, attempt $CURRENT_RETRIES/$MAX_RETRIES" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
                        fi
                    else
                        # Either not first retry, or connection refresh disabled - just wait
                        if [ "$CONNECTION_REFRESH" -eq 1 ]; then
                            log_message "Connection refresh already attempted, waiting for recovery (attempt $CURRENT_RETRIES/$MAX_RETRIES)" "info"
                            update_status "error" "Waiting for recovery, attempt $CURRENT_RETRIES/$MAX_RETRIES" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
                        else
                            log_message "Connection refresh disabled, waiting for max retries (attempt $CURRENT_RETRIES/$MAX_RETRIES)" "info"
                            update_status "error" "Connection refresh disabled, attempt $CURRENT_RETRIES/$MAX_RETRIES" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
                        fi
                    fi
                fi
            fi
        else
            # Connection is good
            # For HIGH_LATENCY_MONITORING: only reset if latency is below ceiling
            # For standard monitoring: reset on any successful ping
            local should_reset=0
            
            if [ "$HIGH_LATENCY_MONITORING" -eq 1 ]; then
                # Only reset if latency is acceptable
                if [ "$CURRENT_LATENCY" -le "$LATENCY_CEILING" ]; then
                    should_reset=1
                fi
            else
                # Standard mode: reset on successful ping
                should_reset=1
            fi
            
            if [ $should_reset -eq 1 ]; then
                if [ $failure_count -gt 0 ] || [ $CURRENT_RETRIES -gt 0 ]; then
                    log_message "Connection restored" "info"
                    update_status "stable" "Connection restored" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
                    
                    # Reset counters
                    failure_count=0
                    CURRENT_RETRIES=0
                    save_retry_count $CURRENT_RETRIES
                else
                    # Update status even when connection is consistently good to refresh latency data
                    update_status "stable" "Connection stable" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
                fi
            else
                # High latency mode with latency still above ceiling - don't reset counters
                update_status "stable" "Connection active but latency high" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
            fi
            
            # Scheduled SIM failover check
            if [ "$AUTO_SIM_FAILOVER" -eq 1 ] && [ "$SIM_FAILOVER_SCHEDULE" -gt 0 ] && [ -n "$initial_sim" ]; then
                # Get current SIM to check if we're on the backup
                local current_sim=$(get_current_sim)
                
                # If we're on backup SIM, check if it's time to try primary again
                if [ -n "$current_sim" ] && [ "$current_sim" != "$initial_sim" ]; then
                    sim_failover_interval=$((sim_failover_interval + 1))
                    
                    # Check if we've reached the scheduled time
                    if [ $((sim_failover_interval * PING_INTERVAL)) -ge $((SIM_FAILOVER_SCHEDULE * 60)) ]; then
                        log_message "Scheduled check: attempting to switch back to primary SIM $initial_sim" "info"
                        update_status "switchback" "Attempting to switch back to primary SIM"
                        
                        # Try switching back
                        local switchback_success=0
                        if switch_sim_card; then
                            if [ "$HIGH_LATENCY_MONITORING" -eq 1 ]; then
                                if check_internet_with_latency && [ "$CURRENT_LATENCY" -le "$LATENCY_CEILING" ]; then
                                    switchback_success=1
                                fi
                            else
                                if check_internet; then
                                    switchback_success=1
                                fi
                            fi
                        fi
                        
                        if [ $switchback_success -eq 1 ]; then
                            log_message "Successfully switched back to primary SIM" "info"
                            update_status "stable" "Successfully switched back to primary SIM" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
                            
                            # Mark that recovery was performed (SIM switch includes recovery-like operations)
                            recovery_performed=1
                        else
                            log_message "Failed to switch back to primary SIM, staying on backup" "warn"
                            update_status "stable" "Staying on backup SIM - primary SIM check failed" "$CURRENT_RETRIES" "$MAX_RETRIES" "$CURRENT_LATENCY" "$LATENCY_CEILING"
                            
                            # Switch back to backup SIM
                            current_sim=$(get_current_sim)
                            if [ -n "$current_sim" ] && [ "$current_sim" = "$initial_sim" ]; then
                                switch_sim_card
                            fi
                        fi
                        
                        # Reset failover interval
                        sim_failover_interval=0
                    fi
                fi
            fi
        fi
        
        # Smart sleep interval: Skip regular sleep if recovery was performed
        # Recovery already includes its own delays and grace period
        if [ $recovery_performed -eq 1 ]; then
            log_message "Recovery performed this cycle - resuming monitoring immediately" "debug"
            # No sleep needed - recovery function already included grace period
        else
            # Normal monitoring cycle - sleep for configured interval
            log_message "Sleeping for $PING_INTERVAL seconds before next check" "debug"
            sleep $PING_INTERVAL
        fi
    done
}

# Set up trap for clean shutdown and cleanup
trap 'log_message "Received signal, exiting" "info"; update_status "stopped" "Daemon stopped"; rm -f "$PID_FILE"; rmdir "$TOKEN_LOCK_DIR" 2>/dev/null; exit 0' INT TERM

# Start the main function
main