#!/bin/sh

# Set content-type for JSON response
echo "Content-type: application/json"
echo ""

# Define paths and constants to match queue system
QUEUE_DIR="/tmp/at_queue"
RESULTS_DIR="$QUEUE_DIR/results"
TOKEN_FILE="$QUEUE_DIR/token"
TEMP_FILE="/tmp/network_info_output.txt"
LOCK_ID="NETWORK_INFO_$(date +%s)_$$"
COMMAND_TIMEOUT=4
MAX_TOKEN_WAIT=10
PRIORITY=5  # Medium-high priority (between cell scan and normal commands)

# Function to log messages
log_message() {
    local level="${2:-info}"
    logger -t at_queue -p "daemon.$level" "network_info: $1"
}

# Function to output JSON error
output_error() {
    printf '{"status":"error","message":"%s","timestamp":"%s"}\n' "$1" "$(date '+%H:%M:%S')"
    exit 1
}

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

# Acquire token directly with medium-high priority
acquire_token() {
    local priority="$PRIORITY"  # Medium-high priority for network info
    local max_attempts=$MAX_TOKEN_WAIT
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        # Check if token file exists
        if [ -f "$TOKEN_FILE" ]; then
            local current_holder=$(cat "$TOKEN_FILE" | jsonfilter -e '@.id' 2>/dev/null)
            local current_priority=$(cat "$TOKEN_FILE" | jsonfilter -e '@.priority' 2>/dev/null)
            local timestamp=$(cat "$TOKEN_FILE" | jsonfilter -e '@.timestamp' 2>/dev/null)
            local current_time=$(date +%s)
            
            # Check for expired token (> 30 seconds old)
            if [ $((current_time - timestamp)) -gt 30 ] || [ -z "$current_holder" ]; then
                # Remove expired token
                rm -f "$TOKEN_FILE" 2>/dev/null
            elif [ $priority -lt $current_priority ]; then
                # Preempt lower priority token
                log_message "Preempting token from $current_holder (priority: $current_priority)" "info"
                rm -f "$TOKEN_FILE" 2>/dev/null
            else
                # Try again - higher priority token exists
                log_message "Token held by $current_holder with priority $current_priority, retrying..." "debug"
                sleep 0.5
                attempt=$((attempt + 1))
                continue
            fi
        fi
        
        # Try to create token file
        echo "{\"id\":\"$LOCK_ID\",\"priority\":$priority,\"timestamp\":$(date +%s)}" > "$TOKEN_FILE" 2>/dev/null
        chmod 644 "$TOKEN_FILE" 2>/dev/null
        
        # Verify we got the token
        local holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
        if [ "$holder" = "$LOCK_ID" ]; then
            log_message "Successfully acquired token with priority $priority" "info"
            return 0
        fi
        
        sleep 0.5
        attempt=$((attempt + 1))
    done
    
    log_message "Failed to acquire token after $max_attempts attempts" "error"
    return 1
}

# Release token directly
release_token() {
    if [ -f "$TOKEN_FILE" ]; then
        local current_holder=$(cat "$TOKEN_FILE" | jsonfilter -e '@.id' 2>/dev/null)
        if [ "$current_holder" = "$LOCK_ID" ]; then
            rm -f "$TOKEN_FILE" 2>/dev/null
            log_message "Released token" "info"
            return 0
        fi
        log_message "Token held by $current_holder, not by us ($LOCK_ID)" "warn"
    fi
    return 1
}

# Function to execute AT command with retries
execute_at_command() {
    local CMD="$1"
    local RETRY_COUNT=0
    local MAX_RETRIES=3
    local OUTPUT=""
    
    log_message "Executing command: $CMD" "debug"
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        OUTPUT=$(sms_tool at "$CMD" -t $COMMAND_TIMEOUT 2>&1)
        local EXIT_CODE=$?
        
        if [ $EXIT_CODE -eq 0 ]; then
            if echo "$OUTPUT" | grep -q "CME ERROR"; then
                log_message "Command returned CME ERROR, retrying: $CMD" "warn"
                RETRY_COUNT=$((RETRY_COUNT + 1))
                [ $RETRY_COUNT -lt $MAX_RETRIES ] && sleep 1
                continue
            fi
            
            log_message "Command executed successfully" "debug"
            echo "$OUTPUT"
            return 0
        fi
        
        log_message "Command failed (code $EXIT_CODE), retrying: $CMD" "warn"
        RETRY_COUNT=$((RETRY_COUNT + 1))
        [ $RETRY_COUNT -lt $MAX_RETRIES ] && sleep 1
    done
    
    log_message "Command failed after $MAX_RETRIES attempts: $CMD" "error"
    return 1
}

# Function to check network mode
check_network_mode() {
    local OUTPUT=$(execute_at_command "AT+QENG=\"servingcell\"")
    echo "$OUTPUT" > "$TEMP_FILE"
    
    # Check for both LTE and NR5G-NSA (NSA mode)
    if echo "$OUTPUT" | grep -q "\"LTE\"" && echo "$OUTPUT" | grep -q "\"NR5G-NSA\""; then
        log_message "Detected network mode: NRLTE (NSA)" "info"
        echo "NRLTE"
    # Check for LTE only
    elif echo "$OUTPUT" | grep -q "\"LTE\""; then
        log_message "Detected network mode: LTE" "info"
        echo "LTE"
    # Check for NR5G-SA
    elif echo "$OUTPUT" | grep -q "\"NR5G-SA\""; then
        log_message "Detected network mode: NR5G (SA)" "info"
        echo "NR5G"
    else
        log_message "Detected network mode: UNKNOWN" "warn"
        echo "UNKNOWN"
    fi
}

# Function to check NR5G measurement info setting
check_nr5g_meas_info() {
    local OUTPUT=$(execute_at_command "AT+QNWCFG=\"nr5g_meas_info\"")
    if echo "$OUTPUT" | grep -q "\"nr5g_meas_info\",1"; then
        log_message "NR5G measurement info is enabled" "debug"
        return 0
    else
        log_message "NR5G measurement info is disabled" "debug"
        return 1
    fi
}

# Function to escape JSON string
escape_json_string() {
    echo "$1" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr -d '\n' | sed 's/\r//g'
}

# Function to parse and format output as JSON
format_output_json() {
    local MODE="$1"
    local NEIGHBOR_OUTPUT="$2"
    local MEAS_OUTPUT="$3"
    
    # Basic JSON structure
    printf '{"status":"success","timestamp":"%s","mode":"%s","data":{' "$(date '+%H:%M:%S')" "$MODE"
    
    # Add neighbor cell info if available
    if [ -n "$NEIGHBOR_OUTPUT" ]; then
        printf '"neighborCells":"%s"' "$(escape_json_string "$NEIGHBOR_OUTPUT")"
    fi
    
    # Add measurement info if available
    if [ -n "$MEAS_OUTPUT" ]; then
        [ -n "$NEIGHBOR_OUTPUT" ] && printf ','
        printf '"meas":"%s"' "$(escape_json_string "$MEAS_OUTPUT")"
    fi
    
    printf '}}\n'
}

# Set up trap for cleanup
trap 'log_message "Script interrupted, cleaning up" "warn"; release_token; rm -f "$TEMP_FILE"; exit 1' INT TERM

# Main execution
{
    # Ensure directories exist
    mkdir -p "$QUEUE_DIR" "$RESULTS_DIR"
    
    log_message "Starting network info collection" "info"
    
    # Acquire token for AT command execution
    if ! acquire_token; then
        output_error "Failed to acquire token for command processing"
    fi
    
    # Check network mode
    NETWORK_MODE=$(check_network_mode)
    
    SERVING_OUTPUT=""
    MEAS_OUTPUT=""
    
    case "$NETWORK_MODE" in
        "NRLTE")
            log_message "Processing NRLTE mode commands" "info"
            SERVING_OUTPUT=$(execute_at_command "AT+QENG=\"neighbourcell\"")
            if ! check_nr5g_meas_info; then
                log_message "Enabling and fetching NR5G measurement info" "info"
                MEAS_OUTPUT=$(execute_at_command "AT+QNWCFG=\"nr5g_meas_info\",1;+QNWCFG=\"nr5g_meas_info\"")
            else
                log_message "Fetching NR5G measurement info" "info"
                MEAS_OUTPUT=$(execute_at_command "AT+QNWCFG=\"nr5g_meas_info\"")
            fi
            ;;
        "LTE")
            log_message "Processing LTE mode commands" "info"
            SERVING_OUTPUT=$(execute_at_command "AT+QENG=\"neighbourcell\"")
            ;;
        "NR5G")
            log_message "Processing NR5G mode commands" "info"
            if ! check_nr5g_meas_info; then
                log_message "Enabling and fetching NR5G measurement info" "info"
                MEAS_OUTPUT=$(execute_at_command "AT+QNWCFG=\"nr5g_meas_info\",1;+QNWCFG=\"nr5g_meas_info\"")
            else
                log_message "Fetching NR5G measurement info" "info"
                MEAS_OUTPUT=$(execute_at_command "AT+QNWCFG=\"nr5g_meas_info\"")
            fi
            ;;
        *)
            release_token
            output_error "Unknown or unsupported network mode"
            ;;
    esac
    
    # Generate command ID for AT queue results format
    local cmd_id="network_info_$(date +%s)_$$"
    local end_time=$(date +%s)
    local start_time=$end_time  # For simplicity, use same timestamp
    
    # Format and output JSON response
    log_message "Formatting output response" "debug"
    format_output_json "$NETWORK_MODE" "$SERVING_OUTPUT" "$MEAS_OUTPUT"
    
    # Release token and clean up
    release_token
    rm -f "$TEMP_FILE"
    
    log_message "Network info collection completed" "info"
    
} || {
    # Error handler
    log_message "Script failed with error" "error"
    release_token
    rm -f "$TEMP_FILE"
    output_error "Internal error occurred"
}