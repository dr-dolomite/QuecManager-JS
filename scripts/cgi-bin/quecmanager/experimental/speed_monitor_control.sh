#!/bin/sh

# Set proper headers
echo "Content-Type: application/json"
echo "Cache-Control: no-cache"
echo ""

# Configuration
MONITOR_SCRIPT="/www/cgi-bin/quecmanager/experimental/realtime_speed_monitor.sh"
WEBSOCKET_PORT="8080"

# Function to validate request method
validate_request() {
    if [ "$REQUEST_METHOD" != "POST" ] && [ "$REQUEST_METHOD" != "GET" ]; then
        echo '{"error": "Method not allowed", "code": 405}'
        exit 1
    fi
}

# Function to get POST data
get_post_data() {
    if [ "$REQUEST_METHOD" = "POST" ]; then
        if [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ]; then
            read -n "$CONTENT_LENGTH" POST_DATA
            echo "$POST_DATA"
        fi
    fi
}

# Function to parse JSON action from POST data
parse_action() {
    local post_data="$1"
    if [ -n "$post_data" ]; then
        # Simple JSON parsing for action field
        echo "$post_data" | sed -n 's/.*"action"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
    fi
}

# Function to check if websocat is available
check_websocat() {
    if ! command -v websocat >/dev/null 2>&1; then
        echo '{"error": "websocat not installed", "code": 500, "message": "Please install websocat: opkg update && opkg install websocat"}'
        exit 1
    fi
}

# Function to start the monitor
start_monitor() {
    check_websocat
    
    # Check if already running
    if pgrep -f "websocat.*$WEBSOCKET_PORT" >/dev/null; then
        echo '{"status": "already_running", "port": '$WEBSOCKET_PORT', "message": "Monitor is already running"}'
        return 0
    fi
    
    # Make script executable
    chmod +x "$MONITOR_SCRIPT" 2>/dev/null
    
    # Start the monitor
    if [ -x "$MONITOR_SCRIPT" ]; then
        "$MONITOR_SCRIPT" start >/dev/null 2>&1
        sleep 2  # Give it time to start
        
        # Verify it started
        if pgrep -f "websocat.*$WEBSOCKET_PORT" >/dev/null; then
            echo '{"status": "started", "port": '$WEBSOCKET_PORT', "websocket_url": "ws://127.0.0.1:'$WEBSOCKET_PORT'"}'
        else
            echo '{"error": "Failed to start monitor", "code": 500}'
        fi
    else
        echo '{"error": "Monitor script not found or not executable", "code": 500}'
    fi
}

# Function to stop the monitor
stop_monitor() {
    "$MONITOR_SCRIPT" stop >/dev/null 2>&1
    sleep 1
    
    # Verify it stopped
    if ! pgrep -f "websocat.*$WEBSOCKET_PORT" >/dev/null; then
        echo '{"status": "stopped"}'
    else
        # Force kill if still running
        pkill -9 -f "websocat.*$WEBSOCKET_PORT" 2>/dev/null
        echo '{"status": "force_stopped"}'
    fi
}

# Function to get monitor status
get_status() {
    if pgrep -f "websocat.*$WEBSOCKET_PORT" >/dev/null; then
        # Get process info
        local pid=$(pgrep -f "websocat.*$WEBSOCKET_PORT" | head -n1)
        local uptime=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ' || echo "unknown")
        
        echo '{"status": "running", "port": '$WEBSOCKET_PORT', "websocket_url": "ws://127.0.0.1:'$WEBSOCKET_PORT'", "uptime": "'$uptime'", "pid": '$pid'}'
    else
        echo '{"status": "stopped"}'
    fi
}

# Function to restart the monitor
restart_monitor() {
    stop_monitor >/dev/null 2>&1
    sleep 2
    start_monitor
}

# Main execution
validate_request

# Handle different HTTP methods
case "$REQUEST_METHOD" in
    "GET")
        # GET request returns status
        get_status
        ;;
    "POST")
        # Parse POST data for action
        POST_DATA=$(get_post_data)
        ACTION=$(parse_action "$POST_DATA")
        
        # Default action if none specified
        [ -z "$ACTION" ] && ACTION="status"
        
        case "$ACTION" in
            "start")
                start_monitor
                ;;
            "stop")
                stop_monitor
                ;;
            "restart")
                restart_monitor
                ;;
            "status"|*)
                get_status
                ;;
        esac
        ;;
esac