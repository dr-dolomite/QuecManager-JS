#!/bin/sh

# Set content-type for JSON response
echo "Content-type: application/json"
echo ""

# Function to output error in JSON format
output_error() {
    echo "{\"error\": \"$1\"}"
    exit 1
}

# Define command sets
define_command_sets() {
    COMMAND_SET_1='AT+QUIMSLOT? AT+CNUM AT+COPS? AT+CIMI AT+ICCID AT+CGSN AT+CPIN? AT+CGDCONT? AT+CREG? AT+CFUN? AT+QENG="servingcell" AT+QTEMP AT+CGCONTRDP AT+QCAINFO AT+QRSRP AT+QMAP="WWAN" AT+C5GREG=2;+C5GREG? AT+CGREG=2;+CGREG? AT+QRSRQ AT+QSINR'
    COMMAND_SET_2='AT+CGDCONT? AT+CGCONTRDP AT+QNWPREFCFG="mode_pref" AT+QNWPREFCFG="nr5g_disable_mode" AT+QUIMSLOT?'
    COMMAND_SET_3='AT+CGMI AT+CGMM AT+QGMR AT+CNUM AT+CIMI AT+ICCID AT+CGSN AT+QMAP="LANIP" AT+QMAP="WWAN" AT+QGETCAPABILITY'
    COMMAND_SET_4='AT+QMAP="MPDN_RULE" AT+QMAP="DHCPV4DNS" AT+QCFG="usbnet"'
    COMMAND_SET_5='AT+QRSRP AT+QRSRQ AT+QSINR AT+QCAINFO AT+QSPN'
    COMMAND_SET_6='AT+CEREG=2;+CEREG? AT+C5GREG=2;+C5GREG? AT+CPIN? AT+CGDCONT? AT+CGCONTRDP AT+QMAP="WWAN" AT+QRSRP AT+QTEMP AT+QNETRC?'
    COMMAND_SET_7='AT+QNWPREFCFG="policy_band" AT+QNWPREFCFG="lte_band";+QNWPREFCFG="nsa_nr5g_band";+QNWPREFCFG="nr5g_band"'
}

# Debug logging
DEBUG_LOG="/tmp/debug.log"
echo "Starting script at $(date)" > "$DEBUG_LOG"

# Function to escape JSON strings (handling quotes and newlines)
escape_json() {
    echo "$1" | sed ':a;N;$!ba;s/\n/\\n/g; s/"/\\"/g'
}

# Function to process AT commands
process_commands() {
    local commands="$1"
    local json_response="["
    
    for cmd in $commands; do
        echo "Processing command: $cmd" >> "$DEBUG_LOG"

        # Run the command using sms_tool at
        if ! OUTPUT=$(echo "$cmd" | sms_tool at 2>> "$DEBUG_LOG"); then
            echo "Command failed: $cmd" >> "$DEBUG_LOG"
            OUTPUT="Error executing command"
        else
            echo "Command output: $OUTPUT" >> "$DEBUG_LOG"
        fi

        # Escape special characters for JSON
        ESCAPED_OUTPUT=$(escape_json "$OUTPUT")

        # Append the response
        json_response="${json_response}{\"response\":\"$ESCAPED_OUTPUT\"},"
    done

    # Remove the trailing comma and close the JSON array
    if [ "${json_response: -1}" = "," ]; then
        json_response="${json_response%,}]"
    else
        json_response="${json_response}]"
    fi

    echo "$json_response"
}

# Main execution
define_command_sets

# Get command set from query string
COMMAND_SET=$(echo "$QUERY_STRING" | grep -o 'set=[1-7]' | cut -d'=' -f2 | tr -cd '0-9')

# Select the appropriate command set
case "$COMMAND_SET" in
    1) COMMANDS="$COMMAND_SET_1";;
    2) COMMANDS="$COMMAND_SET_2";;
    3) COMMANDS="$COMMAND_SET_3";;
    4) COMMANDS="$COMMAND_SET_4";;
    5) COMMANDS="$COMMAND_SET_5";;
    6) COMMANDS="$COMMAND_SET_6";;
    7) COMMANDS="$COMMAND_SET_7";;
    *) COMMANDS="$COMMAND_SET_1";; # Default to set 1 if no valid set specified
esac

# Process the selected commands and output the response
JSON_RESPONSE=$(process_commands "$COMMANDS")
echo "$JSON_RESPONSE" >> "$DEBUG_LOG"
echo "$JSON_RESPONSE"

echo "Script completed at $(date)" >> "$DEBUG_LOG"