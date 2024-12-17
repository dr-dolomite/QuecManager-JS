#!/bin/sh

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> /tmp/speedtest_cgi.log
}

# Function to return JSON response
json_response() {
    local status="$1"
    local message="$2"
    echo "Content-Type: application/json"
    echo ""
    printf '{"status": "%s", "message": "%s"}\n' "$status" "$message"
}

# Determine request method and parse input
REQUEST_METHOD="${REQUEST_METHOD:-POST}"
if [ "$REQUEST_METHOD" = "GET" ]; then
    QUERY_STRING="${QUERY_STRING:-$1}"
    ACTION=$(printf '%s\n' "$QUERY_STRING" | awk -F'action=' '{print $2}' | awk -F'&' '{print $1}')
elif [ "$REQUEST_METHOD" = "POST" ]; then
    read -r POST_DATA
    ACTION=$(printf '%s\n' "$QUERY_STRING" | awk -F'action=' '{print $2}' | awk -F'&' '{print $1}')
else
    log "Unsupported request method: $REQUEST_METHOD"
    json_response "error" "Unsupported request method"
    exit 1
fi

# Sanitize input
if [ -z "$ACTION" ] || { [ "$ACTION" != "start" ] && [ "$ACTION" != "stop" ]; }; then
    log "Invalid action: ${ACTION:-empty}"
    json_response "error" "Invalid action. Use 'start' or 'stop'."
    exit 1
fi

# Process the action
if [ "$ACTION" = "start" ]; then
    # Check if speedtest is already running
    if [ -p /www/realtime_spd.json ] || pgrep -f "speedtest -f json" > /dev/null; then
        log "Speedtest already running"
        json_response "warning" "Speedtest is already running"
        exit 0
    fi

    # Remove existing FIFO if it exists
    [ -p /www/realtime_spd.json ] && rm /www/realtime_spd.json
    
    # Create FIFO
    mkfifo /www/realtime_spd.json

    log "Speedtest started"
    json_response "success" "Speedtest started"

    
    # Run speedtest in background
    /usr/bin/speedtest -f json -p yes --progress-update-interval=100 > /www/realtime_spd.json
    

elif [ "$ACTION" = "stop" ]; then
    # Check if speedtest is running
    if ! pgrep -f "speedtest -f json" > /dev/null; then
        log "No speedtest process found"
        json_response "warning" "No speedtest process running"
        exit 0
    fi

    # Kill all speedtest processes
    pkill -f "speedtest -f json"
    
    # Remove FIFO if it exists
    [ -p /www/realtime_spd.json ] && rm /www/realtime_spd.json
    
    log "Speedtest stopped"
    json_response "success" "Speedtest stopped"
fi