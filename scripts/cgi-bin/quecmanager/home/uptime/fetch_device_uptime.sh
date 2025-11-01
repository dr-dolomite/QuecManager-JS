#!/bin/sh

# Device Uptime Fetch Script
# Returns system uptime using OpenWRT's built-in uptime

# Set CORS headers
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Handle OPTIONS request
if [ "${REQUEST_METHOD:-GET}" = "OPTIONS" ]; then
    echo "{\"status\":\"success\"}"
    exit 0
fi

# Get system uptime in seconds
get_uptime_seconds() {
    # Read from /proc/uptime (format: "123.45 456.78")
    # First field is total uptime in seconds (with decimals)
    if [ -f /proc/uptime ]; then
        local uptime_raw=$(cat /proc/uptime | awk '{print $1}')
        # Convert to integer (remove decimals)
        echo "${uptime_raw%.*}"
    else
        echo "0"
    fi
}

# Format seconds to human readable (days as max unit)
format_uptime() {
    local total_seconds=$1
    local days=$((total_seconds / 86400))
    local hours=$(((total_seconds % 86400) / 3600))
    local minutes=$(((total_seconds % 3600) / 60))
    local seconds=$((total_seconds % 60))
    
    if [ $days -gt 0 ]; then
        echo "${days}d ${hours}h ${minutes}m ${seconds}s"
    elif [ $hours -gt 0 ]; then
        echo "${hours}h ${minutes}m ${seconds}s"
    elif [ $minutes -gt 0 ]; then
        echo "${minutes}m ${seconds}s"
    else
        echo "${seconds}s"
    fi
}

# Get uptime
uptime_seconds=$(get_uptime_seconds)
uptime_formatted=$(format_uptime "$uptime_seconds")

# Return JSON response
cat <<EOF
{
    "status": "success",
    "uptime_seconds": $uptime_seconds,
    "uptime_formatted": "$uptime_formatted",
    "timestamp": $(date +%s)
}
EOF

exit 0
