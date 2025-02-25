#!/bin/sh

# Set content-type for JSON response
echo "Content-type: application/json"
echo ""

# Define paths and constants to match queue system
QUEUE_DIR="/tmp/at_queue"
QUEUE_FILE="$QUEUE_DIR/queue"
ACTIVE_FILE="$QUEUE_DIR/active"
RESULTS_DIR="$QUEUE_DIR/results"
LOCK_ID="FETCH_DATA_$(date +%s)_$$"

# Logging function
log_message() {
    logger -t at_queue -p "daemon.$1" "$2"
}

# Enhanced JSON string escaping function (preserved from original)
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

# Add queue entry to maintain system integrity
add_queue_entry() {
    local timestamp=$(date -Iseconds)
    local priority=10  # Default priority
    
    # Set high priority (1) for QSCAN commands
    if echo "$COMMANDS" | grep -qi "AT+QSCAN"; then
        priority=1
    fi
    
    local entry="{\"id\":\"$LOCK_ID\",\"command\":\"FETCH_DATA_LOCK\",\"priority\":$priority,\"timestamp\":\"$timestamp\"}"
    
    # Add entry to queue file
    local temp_file=$(mktemp)
    echo "$entry" > "$temp_file"
    cat "$QUEUE_FILE" >> "$temp_file" 2>/dev/null
    mv "$temp_file" "$QUEUE_FILE"
    
    # Create active file
    echo "$entry" > "$ACTIVE_FILE"
    
    log_message "info" "Added queue entry: $LOCK_ID"
}

# Remove queue entry and cleanup
remove_queue_entry() {
    # Remove from queue file if present
    if [ -f "$QUEUE_FILE" ]; then
        sed -i "/\"id\":\"$LOCK_ID\"/d" "$QUEUE_FILE"
    fi
    
    # Remove active file if it's ours
    if [ -f "$ACTIVE_FILE" ]; then
        grep -q "\"id\":\"$LOCK_ID\"" "$ACTIVE_FILE" && rm -f "$ACTIVE_FILE"
    fi
    
    log_message "info" "Removed queue entry: $LOCK_ID"
}

# Enhanced AT command execution with retries (preserved from original)
execute_at_command() {
    local CMD="$1"
    local RETRY_COUNT=0
    local MAX_RETRIES=3
    local OUTPUT=""
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        OUTPUT=$(sms_tool at "$CMD" -t 4 2>/dev/null)
        if [ $? -eq 0 ] && [ -n "$OUTPUT" ]; then
            echo "$OUTPUT"
            return 0
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        [ $RETRY_COUNT -lt $MAX_RETRIES ] && sleep 1
    done
    
    logger -t at_commands "Command failed after $MAX_RETRIES attempts: $CMD"
    return 1
}

# Enhanced command processing function (preserved from original)
process_commands() {
    local commands="$1"
    local first=1
    
    printf '['
    
    for cmd in $commands; do
        [ $first -eq 0 ] && printf ','
        first=0
        
        OUTPUT=$(execute_at_command "$cmd")
        local CMD_STATUS=$?
        
        ESCAPED_CMD=$(escape_json "$cmd")
        ESCAPED_OUTPUT=$(escape_json "$OUTPUT")
        
        if [ $CMD_STATUS -eq 0 ]; then
            printf '{"command":"%s","response":"%s","status":"success"}' \
                "${ESCAPED_CMD}" \
                "${ESCAPED_OUTPUT}"
        else
            printf '{"command":"%s","response":"Command failed","status":"error"}' \
                "${ESCAPED_CMD}"
        fi
    done
    
    printf ']\n'
}

# Main process wrapper with automatic queue handling
main_with_queue() {
    ( sleep 60; kill -TERM $$ 2>/dev/null ) & 
    TIMEOUT_PID=$!
    
    if ! add_queue_entry; then
        printf '{"error": "Failed to acquire queue entry for command processing"}\n'
        kill $TIMEOUT_PID 2>/dev/null
        exit 1
    fi
    
    process_commands "$COMMANDS"
    
    remove_queue_entry
    kill $TIMEOUT_PID 2>/dev/null
}

# Command sets
COMMAND_SET_1='AT+QUIMSLOT? AT+CNUM AT+COPS? AT+CIMI AT+ICCID AT+CGSN AT+CPIN? AT+CGDCONT? AT+CREG? AT+CFUN? AT+QENG="servingcell" AT+QTEMP AT+CGCONTRDP AT+QCAINFO AT+QRSRP AT+QMAP="WWAN" AT+C5GREG=2;+C5GREG? AT+CGREG=2;+CGREG? AT+QRSRQ AT+QSINR'
COMMAND_SET_2='AT+CGDCONT? AT+CGCONTRDP AT+QNWPREFCFG="mode_pref" AT+QNWPREFCFG="nr5g_disable_mode" AT+QUIMSLOT?'
COMMAND_SET_3='AT+CGMI AT+CGMM AT+QGMR AT+CNUM AT+CIMI AT+ICCID AT+CGSN AT+QMAP="LANIP" AT+QMAP="WWAN" AT+QGETCAPABILITY'
COMMAND_SET_4='AT+QMAP="MPDN_RULE" AT+QMAP="DHCPV4DNS" AT+QCFG="usbnet"'
COMMAND_SET_5='AT+QRSRP AT+QRSRQ AT+QSINR AT+QCAINFO AT+QSPN'
COMMAND_SET_6='AT+CEREG=2;+CEREG? AT+C5GREG=2;+C5GREG? AT+CPIN? AT+CGDCONT? AT+CGCONTRDP AT+QMAP="WWAN" AT+QRSRP AT+QTEMP AT+QNETRC?'
COMMAND_SET_7='AT+QNWPREFCFG="policy_band" AT+QNWPREFCFG="lte_band";+QNWPREFCFG="nsa_nr5g_band";+QNWPREFCFG="nr5g_band"'
COMMAND_SET_8='AT+QNWLOCK="common/4g" AT+QNWLOCK="common/5g" AT+QNWLOCK="save_ctrl"'

# Get command set from query string with validation
COMMAND_SET=$(echo "$QUERY_STRING" | grep -o 'set=[1-8]' | cut -d'=' -f2 | tr -cd '0-9')
if [ -z "$COMMAND_SET" ] || [ "$COMMAND_SET" -lt 1 ] || [ "$COMMAND_SET" -gt 8 ]; then
    COMMAND_SET=1
fi

# Select the appropriate command set
case "$COMMAND_SET" in
    1) COMMANDS="$COMMAND_SET_1";;
    2) COMMANDS="$COMMAND_SET_2";;
    3) COMMANDS="$COMMAND_SET_3";;
    4) COMMANDS="$COMMAND_SET_4";;
    5) COMMANDS="$COMMAND_SET_5";;
    6) COMMANDS="$COMMAND_SET_6";;
    7) COMMANDS="$COMMAND_SET_7";;
    8) COMMANDS="$COMMAND_SET_8";;
esac

# Execute main process with queue handling
main_with_queue