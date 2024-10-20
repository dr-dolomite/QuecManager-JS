#!/bin/sh

# Set content-type for JSON response
echo "Content-type: application/json"
echo ""

# Define the lock file
LOCK_FILE="/tmp/home_data.lock"

# Acquire the lock (wait if needed)
exec 200>$LOCK_FILE
flock -x 200

# Debug logging
DEBUG_LOG="/tmp/debug.log"
echo "Starting script at $(date)" > "$DEBUG_LOG"

CONFIG_FILE="/etc/quecManager.conf"
# Check config file
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Config file not found: $CONFIG_FILE" >> "$DEBUG_LOG"
    echo '{"error": "Config file not found"}'
    exit 1
fi

# Get AT_PORT with debug logging
AT_PORT=$(head -n 1 "$CONFIG_FILE" | cut -d'=' -f2 | tr -d ' \n\r' | sed 's|^dev/||')
echo "Raw config line: $(head -n 1 "$CONFIG_FILE")" >> "$DEBUG_LOG"
echo "Extracted AT_PORT: '$AT_PORT'" >> "$DEBUG_LOG"

# List available devices for debugging
ls -l /dev/smd* >> "$DEBUG_LOG" 2>&1

if [ -z "$AT_PORT" ]; then
    echo "AT_PORT is empty" >> "$DEBUG_LOG"
    echo '{"error": "Failed to read AT_PORT from config"}'
    exit 1
fi

# Check if AT_PORT exists
if [ ! -c "/dev/$AT_PORT" ]; then
    echo "AT_PORT device not found: /dev/$AT_PORT" >> "$DEBUG_LOG"
    echo "Available smd devices:" >> "$DEBUG_LOG"
    ls -l /dev/smd* >> "$DEBUG_LOG" 2>&1
    echo '{"error": "AT_PORT device not found"}'
    exit 1
fi

# Function to escape JSON strings (handling quotes and newlines)
escape_json() {
    # Escape newlines and double quotes
    echo "$1" | sed ':a;N;$!ba;s/\n/\\n/g; s/"/\\"/g'
}

# Initialize JSON response array
JSON_RESPONSE="["

# List of AT commands to run, one by one
for COMMAND in 'AT+CGDCONT?' 'AT+QNWPREFCFG="mode_pref"' 'AT+QNWPREFCFG="nr5g_disable_mode"' 'AT+QUIMSLOT?'; do
    # Write the command to the input file
    echo "$COMMAND" > "$INPUT_FILE"

    # Run the command using atinout
    atinout "$INPUT_FILE" "/dev/$AT_PORT" "$OUTPUT_FILE"

    # Read the output from the output file
    OUTPUT=$(cat "$OUTPUT_FILE")

    # Escape special characters for JSON (escape only output)
    ESCAPED_OUTPUT=$(escape_json "$OUTPUT")

    # Append the response as an object to the JSON response array
    JSON_RESPONSE="${JSON_RESPONSE}{\"response\":\"$ESCAPED_OUTPUT\"},"
done

# Remove the trailing comma and close the JSON array
if [ "${JSON_RESPONSE: -1}" = "," ]; then
    JSON_RESPONSE="${JSON_RESPONSE%,}]"
else
    JSON_RESPONSE="${JSON_RESPONSE}]"
fi

# Return the output as a valid JSON response
echo "$JSON_RESPONSE"

# Clean up temporary files
rm "$INPUT_FILE" "$OUTPUT_FILE"

# Release the lock
flock -u 200