#!/bin/sh

# Device Connection Uptime Tracker
# Reads latency logs and calculates uptime based on ping failures

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

# Paths
REALTIME_JSON="/tmp/quecmanager/ping_realtime.json"
UPTIME_STATE="/tmp/quecmanager/uptime_state.json"
UCI_CONFIG="quecmanager"

# Initialize uptime state file if it doesn't exist
init_uptime_state() {
    if [ ! -f "$UPTIME_STATE" ]; then
        cat > "$UPTIME_STATE" <<EOF
{
    "uptime_seconds": 0,
    "last_update": $(date +%s),
    "last_check": $(date +%s),
    "is_connected": true,
    "last_disconnect": 0,
    "disconnect_count": 0
}
EOF
        chmod 644 "$UPTIME_STATE"
    fi
}

# Check for ping failures in the last minute
check_connection_status() {
    if [ ! -f "$REALTIME_JSON" ]; then
        echo "false"
        return
    fi
    
    # Get current timestamp
    local current_time=$(date +%s)
    local one_minute_ago=$((current_time - 60))
    
    # Count failures in the last minute (last 6 entries at 10-second intervals)
    local failure_count=0
    local total_entries=0
    
    # Read last 6 entries
    tail -n 6 "$REALTIME_JSON" 2>/dev/null | while IFS= read -r line; do
        if [ -n "$line" ]; then
            total_entries=$((total_entries + 1))
            
            # Check if ok is false or packet_loss is 100
            if echo "$line" | grep -q '"ok":false'; then
                failure_count=$((failure_count + 1))
            elif echo "$line" | grep -q '"packet_loss":100'; then
                failure_count=$((failure_count + 1))
            fi
        fi
    done > /tmp/failure_check_$$
    
    # Read the results
    if [ -f /tmp/failure_check_$$ ]; then
        failure_count=$(grep -c "" /tmp/failure_check_$$ 2>/dev/null || echo "0")
        rm -f /tmp/failure_check_$$
    fi
    
    # If 5 or more failures detected, consider disconnected
    if [ "$failure_count" -ge 5 ]; then
        echo "false"
    else
        echo "true"
    fi
}

# Calculate and update uptime
calculate_uptime() {
    init_uptime_state
    
    # Read current state
    local current_uptime=$(cat "$UPTIME_STATE" | grep -o '"uptime_seconds":[0-9]*' | cut -d':' -f2)
    local last_update=$(cat "$UPTIME_STATE" | grep -o '"last_update":[0-9]*' | cut -d':' -f2)
    local last_check=$(cat "$UPTIME_STATE" | grep -o '"last_check":[0-9]*' | cut -d':' -f2)
    local was_connected=$(cat "$UPTIME_STATE" | grep -o '"is_connected":[a-z]*' | cut -d':' -f2)
    local last_disconnect=$(cat "$UPTIME_STATE" | grep -o '"last_disconnect":[0-9]*' | cut -d':' -f2)
    local disconnect_count=$(cat "$UPTIME_STATE" | grep -o '"disconnect_count":[0-9]*' | cut -d':' -f2)
    
    # Defaults
    [ -z "$current_uptime" ] && current_uptime=0
    [ -z "$last_update" ] && last_update=$(date +%s)
    [ -z "$last_check" ] && last_check=$(date +%s)
    [ -z "$was_connected" ] && was_connected="true"
    [ -z "$last_disconnect" ] && last_disconnect=0
    [ -z "$disconnect_count" ] && disconnect_count=0
    
    # Check current connection status
    local is_connected=$(check_connection_status)
    local current_time=$(date +%s)
    local time_elapsed=$((current_time - last_update))
    
    # Update uptime based on connection status
    if [ "$is_connected" = "true" ]; then
        if [ "$was_connected" = "true" ]; then
            # Still connected, add elapsed time
            current_uptime=$((current_uptime + time_elapsed))
        else
            # Just reconnected, reset uptime counter
            current_uptime=0
            disconnect_count=$((disconnect_count + 1))
        fi
    else
        if [ "$was_connected" = "true" ]; then
            # Just disconnected, record the time
            last_disconnect=$current_time
            disconnect_count=$((disconnect_count + 1))
        fi
        # While disconnected, uptime stays the same
    fi
    
    # Update state file
    cat > "$UPTIME_STATE" <<EOF
{
    "uptime_seconds": $current_uptime,
    "last_update": $current_time,
    "last_check": $current_time,
    "is_connected": $is_connected,
    "last_disconnect": $last_disconnect,
    "disconnect_count": $disconnect_count
}
EOF
    chmod 644 "$UPTIME_STATE"
    
    # Return formatted uptime
    echo "$current_uptime|$is_connected|$disconnect_count|$last_disconnect"
}

# Format seconds to human readable
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

# Main execution
result=$(calculate_uptime)
uptime_seconds=$(echo "$result" | cut -d'|' -f1)
is_connected=$(echo "$result" | cut -d'|' -f2)
disconnect_count=$(echo "$result" | cut -d'|' -f3)
last_disconnect=$(echo "$result" | cut -d'|' -f4)

formatted_uptime=$(format_uptime "$uptime_seconds")

# Return JSON response
cat <<EOF
{
    "status": "success",
    "uptime_seconds": $uptime_seconds,
    "uptime_formatted": "$formatted_uptime",
    "is_connected": $is_connected,
    "disconnect_count": $disconnect_count,
    "last_disconnect": $last_disconnect,
    "timestamp": $(date +%s)
}
EOF

exit 0
