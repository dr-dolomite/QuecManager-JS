#!/bin/sh
# AT Queue Client for OpenWRT - CGI Script for Frontend
# Direct Execution with Atomic Token Management
# Located in /www/cgi-bin/services/at_queue_client.sh

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

# Script identification for logging
SCRIPT_NAME_LOG="at_queue_client"

# Define paths and constants
QUEUE_DIR="/tmp/at_queue"
TOKEN_FILE="$QUEUE_DIR/token"
TOKEN_LOCK_DIR="$QUEUE_DIR/token.lock"
HOST_DIR=$(pwd)
LOCK_ID="AT_CLIENT_$(date +%s)_$$"
MAX_TOKEN_ATTEMPTS=50
TOKEN_TIMEOUT=30
DEFAULT_CMD_TIMEOUT=3
LOCK_ACQUIRE_TIMEOUT=100  # 10 seconds (100 * 0.1s)

# Output headers immediately
printf "Content-Type: application/json\r\n"
printf "\r\n"

# Centralized logging wrapper function
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
        # Fallback to syslog if centralized logging not available
        logger -t at_queue_client -p "daemon.$level" "$message"
    fi
}

# Atomic lock functions for token operations
acquire_token_lock() {
    local attempt=0
    
    while [ $attempt -lt $LOCK_ACQUIRE_TIMEOUT ]; do
        if mkdir "$TOKEN_LOCK_DIR" 2>/dev/null; then
            # Lock acquired - no logging to reduce log spam
            return 0
        fi
        
        sleep 0.1
        attempt=$((attempt + 1))
    done
    
    # Only log critical errors
    log_message "error" "Failed to acquire token lock after timeout"
    return 1
}

release_token_lock() {
    if [ -d "$TOKEN_LOCK_DIR" ]; then
        rmdir "$TOKEN_LOCK_DIR" 2>/dev/null
        # Lock released - no logging to reduce log spam
        return 0
    fi
    
    # Silently fail - this can happen in normal operation
    return 1
}

# Enhanced JSON string escaping
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

# URL decode function
urldecode() {
    local encoded="$1"
    local decoded="${encoded//%2B/+}"
    decoded="${decoded//%22/\"}"
    decoded=$(printf '%b' "${decoded//%/\\x}")
    echo "$decoded"
}

# Normalize AT command
normalize_at_command() {
    local cmd="$1"
    cmd=$(urldecode "$cmd")
    cmd=$(echo "$cmd" | tr -d '\r\n')
    cmd=$(echo "$cmd" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    echo "$cmd"
}

# Determine priority based on command
get_command_priority() {
    local cmd="$1"
    if echo "$cmd" | grep -qi "AT+QSCAN"; then
        echo "1"
    else
        echo "10"
    fi
}

# Acquire token from queue manager
acquire_token() {
    local priority="${1:-10}"
    local attempt=0
    
    mkdir -p "$QUEUE_DIR" 2>/dev/null
    chmod 755 "$QUEUE_DIR" 2>/dev/null
    
    # Removed debug log to reduce log spam
    
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
                # Expired token - clean up silently
                rm -f "$TOKEN_FILE" 2>/dev/null
                should_create_token=1
            elif [ $priority -lt $current_priority ]; then
                # Log preemption as it's an important event
                log_message "info" "Token preemption: priority $priority > $current_priority"
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
            printf '{"id":"%s","priority":%d,"timestamp":%d}' \
                "$LOCK_ID" "$priority" "$(date +%s)" > "$TOKEN_FILE" 2>/dev/null
            chmod 644 "$TOKEN_FILE" 2>/dev/null
            
            # Verify we got the token (read back atomically)
            local holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
            
            if [ "$holder" = "$LOCK_ID" ]; then
                # Token acquired - only log if high priority to track QSCAN operations
                [ $priority -eq 1 ] && log_message "info" "High-priority token acquired (QSCAN)"
                release_token_lock
                return 0
            else
                # This shouldn't happen - log as warning
                log_message "warn" "Token verification failed"
            fi
        fi
        
        # Release lock before retry
        release_token_lock
        sleep 0.1
        attempt=$((attempt + 1))
    done
    
    log_message "error" "Failed to acquire token after $MAX_TOKEN_ATTEMPTS attempts"
    return 1
}

# Release token
release_token() {
    # Acquire atomic lock for token operations
    if ! acquire_token_lock; then
        log_message "error" "Failed to acquire lock for token release"
        return 1
    fi
    
    if [ -f "$TOKEN_FILE" ]; then
        local current_holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
        if [ "$current_holder" = "$LOCK_ID" ]; then
            rm -f "$TOKEN_FILE" 2>/dev/null
            # Token released - no logging needed for normal operation
            release_token_lock
            return 0
        else
            # Ownership mismatch - this is unusual, log it
            log_message "warn" "Token owned by different process during release"
        fi
    fi
    # Token file missing is normal if already released
    
    release_token_lock
    return 1
}

# Execute AT command directly
execute_at_command() {
    local cmd="$1"
    local timeout="${2:-$DEFAULT_CMD_TIMEOUT}"
    local output
    local status
    
    # Execute command with timeout (no logging to reduce spam)
    output=$(sms_tool at "$cmd" -t "$timeout" 2>&1)
    status=$?
    
    # Only log failures
    [ $status -ne 0 ] && log_message "error" "Command failed: $cmd (exit: $status)"
    
    echo "$output"
    return $status
}

# Process single command
process_single_command() {
    local cmd="$1"
    local priority="${2:-10}"
    local timeout="${3:-$DEFAULT_CMD_TIMEOUT}"
    
    # Validate AT command format
    if ! echo "$cmd" | grep -qi "^AT"; then
        echo '{"error":"Invalid AT command format","status":"error"}'
        return 1
    fi
    
    # Acquire token
    if ! acquire_token "$priority"; then
        echo '{"error":"Failed to acquire token","status":"error"}'
        return 1
    fi
    
    # Execute command
    local output=$(execute_at_command "$cmd" "$timeout")
    local cmd_status=$?
    
    # Release token
    release_token
    
    # Format response
    local escaped_cmd=$(escape_json "$cmd")
    local escaped_output=$(escape_json "$output")
    
    if [ $cmd_status -eq 0 ] && [ -n "$output" ]; then
        echo "{\"command\":\"${escaped_cmd}\",\"response\":\"${escaped_output}\",\"status\":\"success\"}"
    else
        echo "{\"command\":\"${escaped_cmd}\",\"response\":\"${escaped_output}\",\"status\":\"error\"}"
    fi
    
    return $cmd_status
}

# Process batch commands
process_batch_commands() {
    local commands="$1"
    local priority="${2:-10}"
    local timeout="${3:-$DEFAULT_CMD_TIMEOUT}"
    local first=1
    
    # Acquire token once for all commands
    if ! acquire_token "$priority"; then
        printf '['
        first=1
        for cmd in $commands; do
            [ $first -eq 0 ] && printf ','
            first=0
            local escaped_cmd=$(escape_json "$cmd")
            printf '{"command":"%s","response":"Failed to acquire token","status":"error"}' "${escaped_cmd}"
        done
        printf ']'
        return 1
    fi
    
    # Process all commands with the single token
    printf '['
    first=1
    for cmd in $commands; do
        [ $first -eq 0 ] && printf ','
        first=0
        
        local output=$(execute_at_command "$cmd" "$timeout")
        local cmd_status=$?
        
        local escaped_cmd=$(escape_json "$cmd")
        local escaped_output=$(escape_json "$output")
        
        if [ $cmd_status -eq 0 ] && [ -n "$output" ]; then
            printf '{"command":"%s","response":"%s","status":"success"}' \
                "${escaped_cmd}" "${escaped_output}"
        else
            printf '{"command":"%s","response":"%s","status":"error"}' \
                "${escaped_cmd}" "${escaped_output}"
        fi
    done
    printf ']'
    
    # Release token after all commands
    release_token
    return 0
}

# CGI request handling - Authentication and routing
# Check Authorization Header
if [ -z "${HTTP_AUTHORIZATION}" ]; then
    echo '{"error":"Unauthorized","status":"error"}'
    exit 1
fi

# Validate authentication
AUTH_RESPONSE=$(/bin/sh ${HOST_DIR}/cgi-bin/quecmanager/auth-token.sh process "${HTTP_AUTHORIZATION}")
AUTH_RESPONSE_STATUS=$?
if [ $AUTH_RESPONSE_STATUS -ne 0 ]; then
    echo "$AUTH_RESPONSE"
    exit $AUTH_RESPONSE_STATUS
fi

# Setup cleanup trap
trap 'release_token; rmdir "$TOKEN_LOCK_DIR" 2>/dev/null; exit 1' INT TERM

# Parse query string
eval $(echo "$QUERY_STRING" | sed 's/&/;/g')

# Handle batch mode (multiple commands separated by semicolon or space)
if [ -n "$batch" ] && [ "$batch" = "1" ]; then
    # Batch mode - process multiple commands
    if [ -n "$commands" ]; then
        commands=$(urldecode "$commands")
        priority=$(get_command_priority "$commands")
        timeout="${timeout:-$DEFAULT_CMD_TIMEOUT}"
        
        # Special handling for QSCAN commands
        if echo "$commands" | grep -qi "AT+QSCAN"; then
            timeout=200
        fi
        
        process_batch_commands "$commands" "$priority" "$timeout"
    else
        echo '{"error":"No commands specified","status":"error"}'
    fi
else
    # Single command mode
    if [ -n "$command" ]; then
        command=$(normalize_at_command "$command")
        priority=$(get_command_priority "$command")
        timeout="${timeout:-$DEFAULT_CMD_TIMEOUT}"
        
        # Special handling for QSCAN commands
        if echo "$command" | grep -qi "AT+QSCAN"; then
            timeout=200
        fi
        
        process_single_command "$command" "$priority" "$timeout"
    else
        echo '{"error":"No command specified","status":"error"}'
    fi
fi

# Cleanup
release_token
exit 0