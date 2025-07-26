#!/bin/bash

# Set content-type for JSON response
printf "Content-type: application/json\r\n"
printf "\r\n"

# Define paths and constants to match queue system
QUEUE_DIR="/tmp/at_queue"
QUEUE_MANAGER="/www/cgi-bin/services/at_queue_manager"
LOCK_ID="FETCH_DATA_$(date +%s)_$$"
TOKEN_FILE="$QUEUE_DIR/token"

# Logging function (minimized)
log_message() {
    # Only log errors and critical info
   if [ "$1" = "error" ] || [ "$1" = "crit" ]; then
        logger -t at_queue -p "daemon.$1" "$2"
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

# Acquire token directly (avoid CGI overhead)
acquire_token() {
    priority="${1:-10}"
    max_attempts=10
    attempt=0
    log_message "debug" "Acquiring token"
    while [ $attempt -lt $max_attempts ]; do
        # Check if token file exists
        if [ -f "$TOKEN_FILE" ]; then
            current_holder=$(cat "$TOKEN_FILE" | jsonfilter -e '@.id' 2>/dev/null)
            current_priority=$(cat "$TOKEN_FILE" | jsonfilter -e '@.priority' 2>/dev/null)
            timestamp=$(cat "$TOKEN_FILE" | jsonfilter -e '@.timestamp' 2>/dev/null)
            current_time=$(date +%s)
            log_message "info" "current_holder: ${current_holder}"
            log_message "info" "current_priority: ${current_priority}"
            log_message "info" "timestamp: ${timestamp}"
            log_message "info" "current_time: ${current_time}"
            # Check for expired token (> 30 seconds old)
            if [ $((current_time - timestamp)) -gt 30 ] || [ -z "$current_holder" ]; then
                # Remove expired token
                log_message "debug" "Removing token, cur time minus timestamp gt 30 or current-holder not set"
                rm -f "$TOKEN_FILE" 2>/dev/null
            elif [ $priority -lt $current_priority ]; then
                # Preempt lower priority token
                log_message "debug" "Current priority lower priority than other task"
                rm -f "$TOKEN_FILE" 2>/dev/null
            else
                # Try again
                sleep 0.1
                attempt=$((attempt + 1))
                log_message "debug" "Trying again $attempt"
                continue
            fi
        else
                log_message "debug" "No token file"
        fi
        # Try to create token file
        printf "{\"id\":\"$LOCK_ID\",\"priority\":$priority,\"timestamp\":$(date +%s)}" >"$TOKEN_FILE" 2>/dev/null
        chmod 644 "$TOKEN_FILE" 2>/dev/null

        # Verify we got the token
        holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
        if [ "$holder" = "$LOCK_ID" ]; then
            return 0
        fi

        sleep 0.1
        attempt=$((attempt + 1))
    done

    return 1
}
# Release token directly
release_token() {
    log_message "debug" "Release Token"
    # Only remove if it's our token
    if [ -f "$TOKEN_FILE" ]; then
        log_message "debug" "Has Token file"
        current_holder=$(cat "$TOKEN_FILE" | jsonfilter -e '@.id' 2>/dev/null)
        log_message "debug" "Release Token, Current Holder: ${current_holder}"
        if [ "$current_holder" = "$LOCK_ID" ]; then
            log_message "debug" "Release Token, Current Holder: ${current_holder}, removing token"
            rm -f "$TOKEN_FILE" 2>/dev/null
        fi
    fi
}

# Direct AT command execution with minimal overhead
execute_at_command() {
    CMD="$1"
    sms_tool at "$CMD" -t 3 2>/dev/null
}

# Batch process all commands with a single token
process_all_commands() {
    commands="$1"
    priority="${2:-10}"
    first=1
    log_message "info" "Before acquire_token check"
    acquire_token "$priority"
    trying=$?
    log_message "debug" "trying: ${trying}"
    # Acquire a single token for all commands
    if [ $trying -ne 0 ]; then
        log_message "error" "Failed to acquire token for batch processing"
        # Return all failed responses
        printf '['
        first=1
        for cmd in $commands; do
            [ $first -eq 0 ] && printf ','
            first=0
            ESCAPED_CMD=$(escape_json "$cmd")
            printf '{"command":"%s","response":"Failed to acquire token","status":"error"}' "${ESCAPED_CMD}"
        done
        printf ']\r\n'
        return 1
    fi

    # Process all commands with the single token
    printf '['
    for cmd in $commands; do
        [ $first -eq 0 ] && printf ','
        first=0
        OUTPUT=$(execute_at_command "$cmd")
        CMD_STATUS=$?
        log_message "debug" "CMD: ${cmd}, OUTPUT: ${OUTPUT}, CMD_STAT: ${CMD_STATUS}"
        ESCAPED_CMD=$(escape_json "$cmd")
        ESCAPED_OUTPUT=$(escape_json "$OUTPUT")

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

# Main execution with timeout and proper cleanup
trap 'release_token; exit 1' INT TERM

# Command sets
COMMAND_SET_1='AT+QUIMSLOT? AT+CNUM AT+COPS? AT+CIMI AT+ICCID AT+CGSN AT+CPIN? AT+CGDCONT? AT+CREG? AT+CFUN? AT+QENG="servingcell" AT+QTEMP AT+CGCONTRDP AT+QCAINFO=1;+QCAINFO;+QCAINFO=0 AT+QRSRP AT+QMAP="WWAN" AT+C5GREG=2;+C5GREG? AT+CGREG=2;+CGREG? AT+QRSRQ AT+QSINR AT+CGCONTRDP AT+QNWCFG="lte_time_advance",1;+QNWCFG="lte_time_advance" AT+QNWCFG="nr5g_time_advance",1;+QNWCFG="nr5g_time_advance"'
COMMAND_SET_2='AT+CGDCONT? AT+CGCONTRDP AT+QNWPREFCFG="mode_pref" AT+QNWPREFCFG="nr5g_disable_mode" AT+QUIMSLOT? AT+CFUN? AT+QMBNCFG="AutoSel" AT+QMBNCFG="list" AT+QMAP="WWAN" AT+QNWCFG="lte_ambr" AT+QNWCFG="nr5g_ambr"'
COMMAND_SET_3='AT+CGMI AT+CGMM AT+QGMR AT+CNUM AT+CIMI AT+ICCID AT+CGSN AT+QMAP="LANIP" AT+QMAP="WWAN" AT+QGETCAPABILITY AT+QNWCFG="3gpp_rel"'
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
1) COMMANDS="$COMMAND_SET_1" ;;
2) COMMANDS="$COMMAND_SET_2" ;;
3) COMMANDS="$COMMAND_SET_3" ;;
4) COMMANDS="$COMMAND_SET_4" ;;
5) COMMANDS="$COMMAND_SET_5" ;;
6) COMMANDS="$COMMAND_SET_6" ;;
7) COMMANDS="$COMMAND_SET_7" ;;
8) COMMANDS="$COMMAND_SET_8" ;;
esac

# Set priority based on content
PRIORITY=10
if echo "$COMMANDS" | grep -qi "AT+QSCAN"; then
    PRIORITY=1
fi

#    (
#        sleep 60
#        kill -TERM $$
#    ) &
#    TIMEOUT_PID=$!

    process_all_commands "$COMMANDS" "$PRIORITY"

#    kill $TIMEOUT_PID 2>/dev/null
    release_token

