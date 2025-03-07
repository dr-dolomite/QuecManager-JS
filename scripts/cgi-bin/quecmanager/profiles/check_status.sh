#!/bin/sh
# Location: /www/cgi-bin/quecmanager/profiles/check_status.cgi

# Set content type to JSON
echo "Content-type: application/json"
echo ""

# Configuration
STATUS_FILE="/tmp/quecprofiles_status.json"
TRACK_FILE="/tmp/quecprofiles_active"

# Function to log messages
log_message() {
    local level="${2:-info}"
    logger -t quecprofiles -p "daemon.$level" "status_check: $1"
}

# Function to output default "idle" JSON
output_idle_json() {
    cat <<EOF
{
    "status": "idle",
    "message": "No active profile operations",
    "profile": "unknown",
    "progress": 0,
    "timestamp": $(date +%s)
}
EOF
    exit 0
}

# Check if status file exists
if [ -f "$STATUS_FILE" ]; then
    # Check if file is not empty and is valid JSON
    if [ -s "$STATUS_FILE" ] && grep -q "status" "$STATUS_FILE"; then
        # Check if the file is recent (less than 5 minutes old)
        file_time=$(stat -c %Y "$STATUS_FILE" 2>/dev/null || echo "0")
        current_time=$(date +%s)
        age=$((current_time - file_time))
        
        if [ $age -lt 300 ]; then
            # Output the status file content
            cat "$STATUS_FILE"
            log_message "Retrieved status from file: $(cat "$STATUS_FILE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
            exit 0
        else
            log_message "Status file too old (${age}s), returning idle state"
        fi
    else
        log_message "Status file exists but invalid or empty"
    fi
fi

# If we get here, either no file exists or it's invalid/old
# Check if track file exists (as a fallback)
if [ -f "$TRACK_FILE" ]; then
    status_info=$(cat "$TRACK_FILE")
    status=$(echo "$status_info" | cut -d':' -f1)
    profile=$(echo "$status_info" | cut -d':' -f2)
    progress=$(echo "$status_info" | cut -d':' -f3)
    
    # Output JSON based on track file
    cat <<EOF
{
    "status": "$status",
    "message": "Profile operation in progress",
    "profile": "$profile",
    "progress": $progress,
    "timestamp": $(date +%s)
}
EOF
    log_message "Retrieved status from track file: $status"
    exit 0
fi

# If no valid files found, output idle state
output_idle_json