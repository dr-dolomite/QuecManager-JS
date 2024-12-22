#!/bin/sh

# CGI script to handle SMS operations
# Handles both initialization and retrieval of SMS messages

# Content type declaration for CGI
echo "Content-type: application/json"
echo ""

# Check if atinout and jq are installed
if ! command -v atinout &> /dev/null || ! command -v jq &> /dev/null; then
    echo '{"error": "Required tools (atinout or jq) are not installed"}'
    exit 1
fi

# Check if the device exists
if [ ! -c "/dev/smd11" ]; then
    echo '{"error": "Device /dev/smd11 not found"}'
    exit 1
fi

# Function to fetch SMS messages
fetch_sms() {
    # Check if SMS mode is set (do this only once during server startup)
    if [ ! -f "/tmp/sms_mode_initialized" ]; then
        if ! echo "AT+CMGF=1" | atinout - /dev/smd11 -; then
            echo '{"error": "Failed to set SMS text mode"}'
            exit 1
        fi
        touch "/tmp/sms_mode_initialized"
        sleep 2
    fi

    # Fetch all SMS messages and store in temporary file
    if ! echo "AT+CMGL=\"ALL\"" | atinout - /dev/smd11 - | jq -R -s '
        split("\n") | 
        map(select(length > 0)) | 
        map(
            select(startswith("+CMGL:") or (. != "OK" and . != "ERROR"))
        ) | 
        {messages: .}
    ' > /tmp/sms_inbox.json; then
        echo '{"error": "Failed to fetch SMS messages"}'
        exit 1
    fi
}

# Get the query string
QUERY_STRING=${QUERY_STRING:-$(cat)}

# Handle different operations based on query
case "$QUERY_STRING" in
    "refresh_sms")
        # Fetch new messages every time
        fetch_sms
        # Return the contents of the JSON file
        if [ -f "/tmp/sms_inbox.json" ]; then
            cat /tmp/sms_inbox.json
        else
            echo '{"error": "SMS inbox file not found"}'
        fi
        ;;
    *)
        echo '{"error": "Invalid operation"}'
        ;;
esac