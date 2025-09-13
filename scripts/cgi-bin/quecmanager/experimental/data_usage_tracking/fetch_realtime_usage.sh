#!/bin/sh

# QuecManager Real-time Modem Counter Data Fetcher
# Returns real-time usage data from the modem counter daemon

COUNTER_FILE="/tmp/quecmanager/modem_counter.json"

# Send HTTP headers
printf "Content-Type: application/json\r\n"
printf "Cache-Control: no-cache, no-store, must-revalidate\r\n"
printf "Pragma: no-cache\r\n"
printf "Expires: 0\r\n"
printf "\r\n"

# Check if the counter file exists and is readable
if [ ! -f "$COUNTER_FILE" ]; then
    # File doesn't exist - return disabled state
    printf '{"enabled":false,"upload":0,"download":0,"total":0,"timestamp":%s,"error":"Counter file not found"}\n' "$(date +%s)"
    exit 0
fi

if [ ! -r "$COUNTER_FILE" ]; then
    # File exists but not readable - return error
    printf '{"enabled":false,"upload":0,"download":0,"total":0,"timestamp":%s,"error":"Counter file not readable"}\n' "$(date +%s)"
    exit 0
fi

# Check if file is empty or too old (older than 2 minutes = 120 seconds)
if [ ! -s "$COUNTER_FILE" ]; then
    # File is empty
    printf '{"enabled":false,"upload":0,"download":0,"total":0,"timestamp":%s,"error":"Counter file is empty"}\n' "$(date +%s)"
    exit 0
fi

# Check file age using stat if available, otherwise just proceed
if command -v stat >/dev/null 2>&1; then
    file_time=$(stat -c %Y "$COUNTER_FILE" 2>/dev/null)
    current_time=$(date +%s)
    if [ -n "$file_time" ] && [ "$file_time" -lt $((current_time - 120)) ]; then
        # File is too old (more than 2 minutes)
        printf '{"enabled":false,"upload":0,"download":0,"total":0,"timestamp":%s,"error":"Counter data is stale"}\n' "$current_time"
        exit 0
    fi
fi

# Read and validate JSON content
counter_data=$(cat "$COUNTER_FILE" 2>/dev/null)

if [ -z "$counter_data" ]; then
    # Failed to read file content
    printf '{"enabled":false,"upload":0,"download":0,"total":0,"timestamp":%s,"error":"Failed to read counter data"}\n' "$(date +%s)"
    exit 0
fi

# Basic JSON validation - check if it looks like JSON
if ! echo "$counter_data" | grep -q '^{.*}$'; then
    # Not valid JSON format
    printf '{"enabled":false,"upload":0,"download":0,"total":0,"timestamp":%s,"error":"Invalid counter data format"}\n' "$(date +%s)"
    exit 0
fi

# Validate that required fields exist
if ! echo "$counter_data" | grep -q '"enabled"' || \
   ! echo "$counter_data" | grep -q '"upload"' || \
   ! echo "$counter_data" | grep -q '"download"' || \
   ! echo "$counter_data" | grep -q '"total"'; then
    # Missing required fields
    printf '{"enabled":false,"upload":0,"download":0,"total":0,"timestamp":%s,"error":"Missing required fields in counter data"}\n' "$(date +%s)"
    exit 0
fi

# All checks passed - return the actual counter data
printf '%s\n' "$counter_data"