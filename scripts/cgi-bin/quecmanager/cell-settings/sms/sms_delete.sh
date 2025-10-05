#!/bin/sh

# Set content type
printf "Content-Type: application/json\n\n"

# Debug logging
exec 2>> /tmp/sms_delete_debug.log
echo "=== SMS Delete Debug $(date) ===" >&2
echo "QUERY_STRING: $QUERY_STRING" >&2

# URL decode function
urldecode() {
    echo "$*" | sed 's/+/ /g;s/%\([0-9A-F][0-9A-F]\)/\\\\x\1/g' | xargs -0 printf '%b'
}

# Extract indexes from query string
query=$(echo "$QUERY_STRING" | grep -o 'indexes=[^&]*' | cut -d= -f2)
indexes=$(urldecode "$query")

echo "Extracted indexes: $indexes" >&2

# Function to output JSON response
send_json() {
    printf '{"status":"%s","message":"%s"}\n' "$1" "$2"
}

# Validate input
if [ -z "$indexes" ]; then
    echo "Error: No indexes provided" >&2
    send_json "error" "No indexes provided"
    exit 0
fi

# Check if "all" is requested
if [ "$indexes" = "all" ]; then
    echo "Deleting all messages" >&2
    if sms_tool delete all 2>&1 | tee -a /tmp/sms_delete_debug.log >&2; then
        send_json "success" "Successfully deleted all messages"
    else
        send_json "error" "Failed to delete all messages"
    fi
    exit 0
fi

# Initialize counters
success=0
failure=0
total=0

echo "Starting deletion process..." >&2

# Sort indexes in DESCENDING order to avoid index shifting when deleting
# (when you delete index 1, index 2 becomes index 1, so delete from highest to lowest)
sorted_indexes=$(echo "$indexes" | tr ',' '\n' | sort -rn)
echo "Sorted indexes (descending): $sorted_indexes" >&2

# Process each index individually - sms_tool delete only accepts one index at a time
while IFS= read -r index; do
    # Trim whitespace
    index=$(echo "$index" | tr -d ' \t\r\n')
    
    echo "Processing index: '$index'" >&2
    
    if [ -n "$index" ] && [ "$index" -eq "$index" ] 2>/dev/null; then
        total=$((total + 1))
        echo "Attempting to delete index: $index" >&2
        
        # Delete one message at a time
        if sms_tool delete "$index" 2>&1 | tee -a /tmp/sms_delete_debug.log >&2; then
            success=$((success + 1))
            echo "Successfully deleted index: $index (success count: $success)" >&2
        else
            failure=$((failure + 1))
            echo "Failed to delete index: $index (failure count: $failure)" >&2
        fi
    else
        echo "Invalid index: '$index'" >&2
    fi
done << EOF
$sorted_indexes
EOF

echo "Final counts - Total: $total, Success: $success, Failure: $failure" >&2

# Send response
if [ $success -gt 0 ]; then
    if [ $failure -eq 0 ]; then
        echo "Sending success response" >&2
        send_json "success" "Successfully deleted $success message(s)"
    else
        echo "Sending partial response" >&2
        send_json "partial" "Deleted $success message(s), failed to delete $failure message(s)"
    fi
else
    echo "Sending error response" >&2
    send_json "error" "Failed to delete messages"
fi