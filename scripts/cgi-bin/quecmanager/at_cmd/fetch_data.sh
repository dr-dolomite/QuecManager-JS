#!/bin/sh
# fetch_data.sh with Atomic Token Operations
# On SDXPINN and (assumed) SDXLEMUR with OpenWRT Overlay, the environment NEEDS to be /bin/sh,
# whereas QTI environment on SDXLEMUR uses /bin/bash. This assumption requires verification.

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

# Script identification for logging
SCRIPT_NAME_LOG="fetch_data"

# Set content-type for JSON response
printf "Content-type: application/json\r\n"
printf "\r\n"

# Define paths and constants to match queue system
QUEUE_DIR="/tmp/at_queue"
LOCK_ID="FETCH_DATA_$(date +%s)_$$"
TOKEN_FILE="$QUEUE_DIR/token"
TOKEN_LOCK_DIR="$QUEUE_DIR/token.lock"
TOKEN_TIMEOUT=30
TOKEN_LOCK_TIMEOUT=100  # 10 seconds

# Centralized logging wrapper with fallback
log_message() {
    local level="$1"
    local message="$2"
    
    # Use centralized logging if available, fallback to syslog
    if command -v qm_log_error >/dev/null 2>&1; then
        case "$level" in
            "error")
                qm_log_error "at_cmd" "$SCRIPT_NAME_LOG" "$message"
                ;;
            "warn")
                qm_log_warn "at_cmd" "$SCRIPT_NAME_LOG" "$message"
                ;;
            "info")
                qm_log_info "at_cmd" "$SCRIPT_NAME_LOG" "$message"
                ;;
            *)
                qm_log_info "at_cmd" "$SCRIPT_NAME_LOG" "$message"
                ;;
        esac
    else
        # Fallback to syslog
        logger -t fetch_data -p "daemon.$level" "$message"
    fi
}

mkdir -m755 -p ${QUEUE_DIR}

# Enhanced JSON string escaping function
escape_json() {
    printf '%s' "$1" | awk '
    BEGIN { RS="\n"; ORS="\\n" }
    {
        gsub(/\\/, "\\\\")
        gsub(/"/, "\\\"")
        gsub(/\r/, "")
        gsub(/\t/, "\\t")
        gsub(/\f/, "\\f")
        gsub(/\b/, "\\b")
        print
    }
    ' | sed 's/\\n$//'
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
    local priority="${1:-10}"
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
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
            
            # Check for expired token (> TOKEN_TIMEOUT seconds old)
            if [ $((current_time - timestamp)) -gt $TOKEN_TIMEOUT ] || [ -z "$current_holder" ]; then
                log_message "warn" "Removing expired token from ${current_holder}"
                rm -f "$TOKEN_FILE" 2>/dev/null
                should_create_token=1
            elif [ $priority -lt $current_priority ]; then
                # Preempt lower priority token
                log_message "info" "Preempting token from ${current_holder} (priority $current_priority) for priority $priority"
                rm -f "$TOKEN_FILE" 2>/dev/null
                should_create_token=1
            else
                # Token held by higher/equal priority, release lock and retry
                release_token_lock
                sleep 0.1
                attempt=$((attempt + 1))
                continue
            fi
        else
            should_create_token=1
        fi
        
        # Create token if we should
        if [ $should_create_token -eq 1 ]; then
            # Write token atomically within the lock
            printf '{"id":"%s","priority":%d,"timestamp":%d}' \
                "$LOCK_ID" "$priority" "$(date +%s)" > "$TOKEN_FILE" 2>/dev/null
            chmod 644 "$TOKEN_FILE" 2>/dev/null
            
            # Verify we got the token (read back atomically)
            local holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
            
            if [ "$holder" = "$LOCK_ID" ]; then
                release_token_lock
                return 0
            else
                log_message "warn" "Token verification failed, holder: $holder, expected: $LOCK_ID"
            fi
        fi
        
        # Release lock before retry
        release_token_lock
        sleep 0.1
        attempt=$((attempt + 1))
    done
    
    log_message "error" "Failed to acquire token after $max_attempts attempts"
    return 1
}

# Release token with atomic operations
release_token() {
    # Acquire atomic lock for token operations
    if ! acquire_token_lock; then
        log_message "error" "Failed to acquire token lock for release"
        return 1
    fi
    
    # Only remove if it's our token
    if [ -f "$TOKEN_FILE" ]; then
        local current_holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
        
        if [ "$current_holder" = "$LOCK_ID" ]; then
            rm -f "$TOKEN_FILE" 2>/dev/null
            release_token_lock
            return 0
        else
            log_message "warn" "Token held by different owner: $current_holder"
        fi
    fi
    
    release_token_lock
    return 1
}

# Direct AT command execution with minimal overhead
execute_at_command() {
    local CMD="$1"
    sms_tool at "$CMD" -t 3 2>/dev/null
}

# Batch process all commands with a single token
process_all_commands() {
    local commands="$1"
    local priority="${2:-10}"
    local first=1
    
    # Acquire a single token for all commands
    if ! acquire_token "$priority"; then
        log_message "error" "Failed to acquire token for batch processing"
        # Return all failed responses
        printf '['
        first=1
        for cmd in $commands; do
            [ $first -eq 0 ] && printf ','
            first=0
            local ESCAPED_CMD=$(escape_json "$cmd")
            printf '{"command":"%s","response":"Failed to acquire token","status":"error"}' "${ESCAPED_CMD}"
        done
        printf ']\r\n'
        return 1
    fi
    
    # Process all commands with the single token
    printf '['
    first=1
    for cmd in $commands; do
        [ $first -eq 0 ] && printf ','
        first=0
        
        local OUTPUT=$(execute_at_command "$cmd")
        local CMD_STATUS=$?
        
        local ESCAPED_CMD=$(escape_json "$cmd")
        local ESCAPED_OUTPUT=$(escape_json "$OUTPUT")
        
        if [ $CMD_STATUS -eq 0 ] && [ -n "$OUTPUT" ]; then
            printf '{"command":"%s","response":"%s","status":"success"}' \
                "${ESCAPED_CMD}" \
                "${ESCAPED_OUTPUT}"
        else
            printf '{"command":"%s","response":"Command failed","status":"error"}' \
                "${ESCAPED_CMD}"
        fi
    done
    printf ']\r\n'
    
    # Release token after all commands are done
    release_token
    return 0
}

# Setup cleanup trap
trap 'release_token; rmdir "$TOKEN_LOCK_DIR" 2>/dev/null; exit 1' INT TERM

# Command sets
COMMAND_SET_1='AT+QUIMSLOT? AT+CNUM AT+COPS? AT+CIMI AT+ICCID AT+CGSN AT+CPIN? AT+CGDCONT? AT+CREG? AT+CFUN? AT+QENG="servingcell" AT+QTEMP AT+CGCONTRDP AT+QCAINFO=1;+QCAINFO;+QCAINFO=0 AT+QRSRP AT+QMAP="WWAN" AT+C5GREG=2;+C5GREG? AT+CGREG=2;+CGREG? AT+QRSRQ AT+QSINR AT+CGCONTRDP AT+QNWCFG="lte_time_advance",1;+QNWCFG="lte_time_advance" AT+QNWCFG="nr5g_time_advance",1;+QNWCFG="nr5g_time_advance"'
COMMAND_SET_2='AT+CGDCONT? AT+CGCONTRDP AT+QNWPREFCFG="mode_pref" AT+QNWPREFCFG="nr5g_disable_mode" AT+QUIMSLOT? AT+CFUN? AT+QMBNCFG="AutoSel" AT+QMBNCFG="list" AT+QMAP="WWAN" AT+QNWCFG="lte_ambr" AT+QNWCFG="nr5g_ambr"'
COMMAND_SET_3='AT+CGMI AT+CGMM AT+QGMR AT+CNUM AT+CIMI AT+ICCID AT+CGSN AT+QMAP="LANIP" AT+QMAP="WWAN" AT+QGETCAPABILITY AT+QNWCFG="3gpp_rel"'
COMMAND_SET_4='AT+QMAP="MPDN_RULE" AT+QMAP="DHCPV4DNS" AT+QCFG="usbnet"'
COMMAND_SET_5='AT+QRSRP AT+QRSRQ AT+QSINR AT+QCAINFO AT+QSPN'
COMMAND_SET_6='AT+CEREG=2;+CEREG? AT+C5GREG=2;+C5GREG? AT+CPIN? AT+CGDCONT? AT+CGCONTRDP AT+QMAP="WWAN" AT+QRSRP AT+QTEMP AT+QNETRC?'
COMMAND_SET_7='AT+QNWPREFCFG="policy_band" AT+QNWPREFCFG="lte_band";+QNWPREFCFG="nsa_nr5g_band";+QNWPREFCFG="nr5g_band"'
COMMAND_SET_8='AT+QNWLOCK="common/4g" AT+QNWLOCK="common/5g" AT+QNWLOCK="save_ctrl"'
COMMAND_SET_9='AT+ICCID AT+CGSN AT+QUIMSLOT? '
COMMAND_SET_10='AT+QNWPREFCFG="rat_acq_order"'

# Get command set from query string with validation
COMMAND_SET=$(echo "$QUERY_STRING" | grep -o 'set=[0-9]\+' | cut -d'=' -f2 | tr -cd '0-9')
if [ -z "$COMMAND_SET" ] || [ "$COMMAND_SET" -lt 1 ] || [ "$COMMAND_SET" -gt 10 ]; then
    COMMAND_SET=1
fi

# Select the appropriate command set
case "$COMMAND_SET" in
    1) COMMANDS="$COMMAND_SET_1" ;;
    2) COMMANDS="$COMMAND_SET_2" ;;
    3) COMMANDS="$COMMAND_SET_3" ;;
    4) COMMANDS="$COMMAND_SET_4" ;;
    5) COMMANDS="$COMMAND_SET_5" ;;
    6) COMMANDS="$COMMAND_SET_6" ;;
    7) COMMANDS="$COMMAND_SET_7" ;;
    8) COMMANDS="$COMMAND_SET_8" ;;
    9) COMMANDS="$COMMAND_SET_9" ;;
    10) COMMANDS="$COMMAND_SET_10" ;;
esac

# Set priority based on content
PRIORITY=10
if echo "$COMMANDS" | grep -qi "AT+QSCAN"; then
    PRIORITY=1
fi

# Execute batch processing
process_all_commands "$COMMANDS" "$PRIORITY"

# Final cleanup
release_token
rmdir "$TOKEN_LOCK_DIR" 2>/dev/null