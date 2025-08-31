#!/bin/sh
# OpenWrt-Compatible Improved AT Queue Client
# Optimized for OpenWrt/BusyBox environment

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

# Configuration
QUEUE_DIR="/tmp/at_queue"
RESULTS_DIR="/tmp/at_queue/results"
QUEUE_MANAGER="/www/cgi-bin/services/at_queue_manager.sh"
AUTH_FILE="/tmp/at_queue_auth"

# Performance optimizations - OpenWrt friendly
DEFAULT_TIMEOUT=30
FAST_POLL_INTERVAL=0.1    # Fast polling for urgent commands
SLOW_POLL_INTERVAL=0.5    # Slower polling for regular commands
MAX_RETRIES=30            # Maximum polling attempts

# Script identification
SCRIPT_NAME_LOG="at_queue_client"

# Minimal logging for performance
log_at_queue_client() {
    local level="$1"
    local message="$2"
    
    # Only log errors and warnings to centralized system
    case "$level" in
        "error")
            qm_log_error "service" "$SCRIPT_NAME_LOG" "$message"
            logger -t at_queue_client -p "daemon.error" "$message"
            ;;
        "warn")
            qm_log_warn "service" "$SCRIPT_NAME_LOG" "$message"
            logger -t at_queue_client -p "daemon.warning" "$message"
            ;;
        "info")
            logger -t at_queue_client -p "daemon.info" "$message"
            ;;
        "debug")
            # Skip centralized logging for debug to improve performance
            [ "${DEBUG_MODE:-0}" = "1" ] && logger -t at_queue_client -p "daemon.debug" "$message"
            ;;
    esac
}

# OpenWrt-compatible URL decoding
urldecode() {
    local decoded="$1"
    # Handle common URL encodings manually for BusyBox compatibility
    decoded="${decoded//+/ }"
    decoded="${decoded//%20/ }"
    decoded="${decoded//%21/!}"
    decoded="${decoded//%22/\"}"
    decoded="${decoded//%23/#}"
    decoded="${decoded//%26/&}"
    decoded="${decoded//%27/\'}"
    decoded="${decoded//%28/(}"
    decoded="${decoded//%29/)}"
    decoded="${decoded//%2B/+}"
    decoded="${decoded//%2C/,}"
    decoded="${decoded//%3D/=}"
    decoded="${decoded//%3F/?}"
    decoded="${decoded//%40/@}"
    
    # Handle hex sequences for remaining characters
    while echo "$decoded" | grep -q '%[0-9A-Fa-f][0-9A-Fa-f]'; do
        local hex=$(echo "$decoded" | sed -n 's/.*%\([0-9A-Fa-f][0-9A-Fa-f]\).*/\1/p' | head -1)
        if [ -n "$hex" ]; then
            # Convert hex to character using printf
            local char=$(printf "\\$(printf '%03o' "0x$hex")")
            decoded=$(echo "$decoded" | sed "s/%$hex/$char/")
        else
            break
        fi
    done
    
    printf '%s' "$decoded"
}

# Fast URL encoding for common characters
urlencode() {
    local string="$1"
    # Encode special characters manually for performance
    string="${string// /%20}"
    string="${string//+/%2B}"
    string="${string//\"/%22}"
    string="${string//=/%3D}"
    string="${string//&/%26}"
    string="${string//#/%23}"
    string="${string//?/%3F}"
    
    echo "$string"
}

# Optimized command normalization
normalize_command() {
    local cmd="$1"
    
    # URL decode
    cmd=$(urldecode "$cmd")
    
    # Clean and trim - BusyBox compatible
    cmd=$(echo "$cmd" | tr -d '\r\n\f\b' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Ensure AT prefix
    case "$cmd" in
        AT*) ;;
        at*) cmd="AT${cmd#at}" ;;
        *) cmd="AT+$cmd" ;;
    esac
    
    echo "$cmd"
}

# Extract command ID from response with multiple fallback methods
extract_command_id() {
    local response="$1"
    local cmd_id=""
    
    # Method 1: Direct grep for speed
    local json_response=$(echo "$response" | sed -n '/^{/,$p' | head -1)
    
    # Method 2: Simple pattern matching (fastest)
    if [ -n "$json_response" ]; then
        cmd_id=$(echo "$json_response" | grep -o '"command_id":"[^"]*"' | cut -d'"' -f4)
    fi
    
    # Method 3: Alternative field name
    if [ -z "$cmd_id" ]; then
        cmd_id=$(echo "$json_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    fi
    
    # Method 4: jsonfilter fallback (slower but more reliable)
    if [ -z "$cmd_id" ] && command -v jsonfilter >/dev/null; then
        cmd_id=$(echo "$json_response" | jsonfilter -e '@.command_id' 2>/dev/null)
        [ -z "$cmd_id" ] && cmd_id=$(echo "$json_response" | jsonfilter -e '@.id' 2>/dev/null)
    fi
    
    echo "$cmd_id"
}

# Intelligent priority assignment based on command type
get_command_priority() {
    local cmd="$1"
    
    case "$cmd" in
        *"QSCAN"*|*"COPS=?"*)
            echo 1  # Highest priority for scanning operations
            ;;
        *"CFUN"*|*"QPOWD"*|*"RESET"*)
            echo 2  # High priority for system commands
            ;;
        *"?"*|*"CREG"*|*"CGREG"*|*"CEREG"*|*"CPIN"*)
            echo 3  # Medium-high for status queries
            ;;
        *"QCFG"*|*"QNWPREFCFG"*)
            echo 4  # Medium for configuration
            ;;
        *)
            echo 5  # Default priority
            ;;
    esac
}

# Submit command to queue manager
submit_command() {
    local cmd="$1"
    local priority="$2"
    local preempt="$3"
    
    local escaped_cmd=$(urlencode "$cmd")
    local url="$QUEUE_MANAGER?command=$escaped_cmd&priority=$priority"
    
    [ "$preempt" = "true" ] && url="$url&preempt=true"
    
    log_at_queue_client "debug" "Submitting: $cmd (priority: $priority)"
    
    # Execute queue manager as CGI
    REQUEST_METHOD="GET" QUERY_STRING="command=$escaped_cmd&priority=$priority$([ "$preempt" = "true" ] && echo "&preempt=true")" "$QUEUE_MANAGER"
}

# Wait for result with adaptive polling
wait_for_result() {
    local cmd_id="$1"
    local timeout="${2:-$DEFAULT_TIMEOUT}"
    local priority="$3"
    
    local result_file="$RESULTS_DIR/$cmd_id"
    local poll_interval=$SLOW_POLL_INTERVAL
    
    # Use faster polling for high-priority commands
    [ "$priority" -le 3 ] && poll_interval=$FAST_POLL_INTERVAL
    
    local attempts=0
    local max_attempts=$((timeout * 10 / ${poll_interval%.*}))  # Convert to polling attempts
    
    while [ $attempts -lt $max_attempts ]; do
        if [ -f "$result_file" ]; then
            local result_content=$(cat "$result_file")
            if [ -n "$result_content" ]; then
                echo "$result_content"
                rm -f "$result_file" 2>/dev/null  # Cleanup
                return 0
            fi
        fi
        
        sleep $poll_interval
        attempts=$((attempts + 1))
    done
    
    log_at_queue_client "warn" "Command $cmd_id timed out after ${timeout}s"
    return 1
}

# Output JSON response
output_json() {
    local response="$1"
    local show_headers="${2:-true}"
    
    if [ "$show_headers" = "true" ]; then
        printf "Content-type: application/json\r\n\r\n"
    fi
    
    if [ -n "$response" ]; then
        echo "$response"
    else
        printf '{"error":"No response received","status":"error"}\r\n'
    fi
}

# Process a single AT command with error handling
process_command() {
    local cmd="$1"
    local timeout="${2:-$DEFAULT_TIMEOUT}"
    local preempt="${3:-false}"
    local show_headers="${4:-true}"
    
    # Normalize command
    cmd=$(normalize_command "$cmd")
    
    if [ -z "$cmd" ]; then
        output_json '{"error":"Invalid command","status":"error"}' "$show_headers"
        return 1
    fi
    
    # Get priority and submit
    local priority=$(get_command_priority "$cmd")
    local response=$(submit_command "$cmd" "$priority" "$preempt")
    
    if [ -z "$response" ]; then
        output_json '{"error":"Failed to submit command","status":"error"}' "$show_headers"
        return 1
    fi
    
    # Extract command ID
    local cmd_id=$(extract_command_id "$response")
    
    if [ -z "$cmd_id" ]; then
        output_json "$response" "$show_headers"
        return 1
    fi
    
    # Wait for result
    local result=$(wait_for_result "$cmd_id" "$timeout" "$priority")
    
    if [ -n "$result" ]; then
        output_json "$result" "$show_headers"
        return 0
    else
        output_json '{"error":"Command timeout","status":"timeout"}' "$show_headers"
        return 1
    fi
}

# Check if result already exists
check_existing_result() {
    local cmd_id="$1"
    local result_file="$RESULTS_DIR/$cmd_id"
    
    if [ -f "$result_file" ]; then
        output_json "$(cat "$result_file")" "$show_headers"
        return 0
    fi
    
    # Check if still processing
    local start_time=$(date +%s)
    local timeout=30
    
    while [ $(($(date +%s) - start_time)) -lt $timeout ]; do
        if [ -f "$result_file" ]; then
            local result_content=$(cat "$result_file" 2>/dev/null)
            if [ -n "$result_content" ]; then
                output_json "$result_content" "$show_headers"
                return 0
            fi
        fi
        sleep 0.2
    done
    
    return 1
}

# Enhanced authentication check for OpenWrt
is_authenticated() {
    local token="$1"
    
    # Skip auth check if no auth file exists
    [ ! -f "$AUTH_FILE" ] && return 0
    
    # Check token format and expiry
    if [ -n "$token" ]; then
        local token_line=$(grep "${token}" "${AUTH_FILE}" | head -1)
        if [ -n "$token_line" ]; then
            # OpenWrt-compatible date parsing
            local token_date=$(echo "$token_line" | awk '{print $1}' | sed 's/T/ /')
            local token_time=0
            
            # Try different date parsing methods for OpenWrt compatibility
            if command -v date >/dev/null 2>&1; then
                token_time=$(date -d "$token_date" +%s 2>/dev/null)
                if [ $? -ne 0 ]; then
                    # Fallback for BusyBox date
                    token_time=$(echo "$token_date" | awk -F'[ :-]' '{
                        printf "%d", mktime($1" "$2" "$3" "$4" "$5" "$6)
                    }' 2>/dev/null || echo 0)
                fi
            fi
            
            local now_time=$(date +%s)
            
            # Token valid for 24 hours
            if [ $((now_time - token_time)) -lt 86400 ]; then
                return 0
            fi
        fi
    fi
    
    return 1
}

# Parse CGI parameters with OpenWrt compatibility
parse_cgi_params() {
    local query_string="${QUERY_STRING:-}"
    
    # Parse command
    CMD=$(echo "$query_string" | grep -o 'cmd=[^&]*' | cut -d'=' -f2-)
    [ -z "$CMD" ] && CMD=$(echo "$query_string" | grep -o 'command=[^&]*' | cut -d'=' -f2-)
    
    # Parse timeout
    TIMEOUT=$(echo "$query_string" | grep -o 'timeout=[0-9]*' | cut -d'=' -f2)
    TIMEOUT=${TIMEOUT:-$DEFAULT_TIMEOUT}
    
    # Parse preempt flag
    PREEMPT=$(echo "$query_string" | grep -o 'preempt=true' | cut -d'=' -f2)
    PREEMPT=${PREEMPT:-false}
    
    # Parse result ID (for checking existing results)
    RESULT_ID=$(echo "$query_string" | grep -o 'result_id=[^&]*' | cut -d'=' -f2)
    
    # Parse auth token
    AUTH_TOKEN=$(echo "$query_string" | grep -o 'token=[^&]*' | cut -d'=' -f2)
}

# Main execution
main() {
    # Ensure queue directory exists
    mkdir -p "$QUEUE_DIR" "$RESULTS_DIR"
    
    # CGI mode
    if [ -n "${REQUEST_METHOD:-}" ]; then
        parse_cgi_params
        
        # Check authentication if auth file exists
        if [ -f "$AUTH_FILE" ] && ! is_authenticated "$AUTH_TOKEN"; then
            output_json '{"error":"Authentication required","status":"unauthorized"}' true
            exit 1
        fi
        
        # Handle different operations
        if [ -n "$RESULT_ID" ]; then
            # Check for existing result
            if ! check_existing_result "$RESULT_ID"; then
                output_json '{"error":"Result not found","status":"not_found"}' true
            fi
        elif [ -n "$CMD" ]; then
            # Process new command
            process_command "$CMD" "$TIMEOUT" "$PREEMPT" true
        else
            output_json '{"error":"No command specified","status":"error"}' true
        fi
        
    # CLI mode
    else
        local cmd="$1"
        local timeout="${2:-$DEFAULT_TIMEOUT}"
        local preempt="${3:-false}"
        
        if [ -z "$cmd" ]; then
            echo "Usage: $0 <AT_command> [timeout] [preempt]"
            echo "  AT_command - AT command to execute"
            echo "  timeout    - Timeout in seconds (default: $DEFAULT_TIMEOUT)"
            echo "  preempt    - true/false for priority preemption (default: false)"
            exit 1
        fi
        
        process_command "$cmd" "$timeout" "$preempt" false
    fi
}

# Execute main function
main "$@"
