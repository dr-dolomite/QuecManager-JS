#!/bin/sh

# Set content type
printf "Content-Type: application/json\n\n"

# URL decode function
urldecode() {
    echo "$*" | sed 's/+/ /g;s/%\([0-9A-F][0-9A-F]\)/\\\\x\1/g' | xargs -0 printf '%b'
}

# Extract indexes from query string
query=$(echo "$QUERY_STRING" | grep -o 'indexes=[^&]*' | cut -d= -f2)
indexes=$(urldecode "$query")

# Function to output JSON response
send_json() {
    printf '{"status":"%s","message":"%s"}\n' "$1" "$2"
}

# Validate input
if [ -z "$indexes" ]; then
    send_json "error" "No indexes provided"
    exit 0
fi

# Check if "all" is requested
if [ "$indexes" = "all" ]; then
    if sms_tool delete all >/dev/null 2>&1; then
        send_json "success" "Successfully deleted all messages"
    else
        send_json "error" "Failed to delete all messages"
    fi
    exit 0
fi

# Count indexes
index_count=$(echo "$indexes" | tr ',' '\n' | grep -c .)

# Initialize counters
success=0
failure=0

# Sort in descending order (highest to lowest) to avoid index shifting
sorted_indexes=$(echo "$indexes" | tr ',' '\n' | sort -rn)

# Delete each index one by one
while IFS= read -r index; do
    if [ -z "$index" ]; then
        continue
    fi
    
    if sms_tool delete "$index" >/dev/null 2>&1; then
        success=$((success + 1))
    else
        failure=$((failure + 1))
    fi
done << EOF
$sorted_indexes
EOF

# Send response
if [ "$success" -eq "$index_count" ]; then
    send_json "success" "Successfully deleted $success message(s)"
elif [ "$success" -gt 0 ]; then
    send_json "partial" "Deleted $success of $index_count message(s)"
else
    send_json "error" "Failed to delete messages"
fi