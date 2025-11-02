#!/bin/sh

# Speedtest Daemon for QuecManager
# This daemon runs speedtest CLI and streams results via WebSocket
# Designed for OpenWrt with BusyBox compatibility

# Load centralized logging
LOGGER_SCRIPT="/www/cgi-bin/services/quecmanager_logger.sh"
if [ -f "$LOGGER_SCRIPT" ]; then
    . "$LOGGER_SCRIPT"
    USE_CENTRALIZED_LOGGING=1
else
    USE_CENTRALIZED_LOGGING=0
fi

SCRIPT_NAME="speedtest_daemon"
LOG_CATEGORY="daemon"

# Configuration
PID_FILE="/tmp/quecmanager/speedtest_daemon.pid"
TMP_DIR="/tmp/quecmanager"
WEB_PROTOCOL="ws"  # Change to "wss" if using SSL
WEBSOCKET_PORT=8838
WEBSOCKET_HOST="localhost"
WS_CMD="websocat --one-message ${WEB_PROTOCOL}://${WEBSOCKET_HOST}:${WEBSOCKET_PORT}"
[ "$WEB_PROTOCOL" = "wss" ] && WS_CMD="websocat -k --one-message ${WEB_PROTOCOL}://${WEBSOCKET_HOST}:${WEBSOCKET_PORT}"

# Log helper function
log() {
    if [ "$USE_CENTRALIZED_LOGGING" = "1" ]; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "$1"
    fi
}

log_error() {
    if [ "$USE_CENTRALIZED_LOGGING" = "1" ]; then
        qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "$1"
    fi
}

log_warn() {
    if [ "$USE_CENTRALIZED_LOGGING" = "1" ]; then
        qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "$1"
    fi
}

# Ensure temp directory exists
ensure_tmp_dir() {
    mkdir -p "$TMP_DIR" 2>/dev/null || true
}

# Cleanup function
cleanup() {
    log "Speedtest daemon cleaning up..."
    rm -f "$PID_FILE" 2>/dev/null || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Check if speedtest is already running
check_if_running() {
    if [ -f "$PID_FILE" ]; then
        old_pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            log_warn "Speedtest is already running (PID: $old_pid)"
            return 1
        else
            # Stale PID file, remove it
            rm -f "$PID_FILE" 2>/dev/null || true
        fi
    fi
    return 0
}

# Check if speedtest CLI is available
check_speedtest_cli() {
    if ! command -v speedtest >/dev/null 2>&1; then
        log_error "speedtest CLI not found. Please install it."
        return 1
    fi
    return 0
}

# Check if websocat is available
check_websocat() {
    if ! command -v websocat >/dev/null 2>&1; then
        log_error "websocat not found. Cannot send updates."
        return 1
    fi
    return 0
}

# Send JSON message via WebSocket
send_ws_message() {
    local json_data="$1"
    echo "$json_data" | ${WS_CMD} 2>/dev/null || true
}

# Add channel field to JSON
add_channel_to_json() {
    local json_line="$1"
    
    # Remove closing brace, add channel field, add closing brace back
    # BusyBox-compatible JSON manipulation
    if echo "$json_line" | grep -q '^{.*}$'; then
        # Remove trailing }
        local json_without_closing="${json_line%\}}"
        # Add channel field and closing brace
        echo "${json_without_closing},\"channel\":\"speedtest\"}"
    else
        echo "$json_line"
    fi
}

# Main speedtest execution
run_speedtest() {
    log "Starting speedtest CLI..."
    
    # Set HOME for speedtest CLI
    export HOME=/tmp/home
    mkdir -p "$HOME" 2>/dev/null || true
    
    # Send initial starting message
    local start_msg='{"channel":"speedtest","type":"starting","status":"starting","message":"Initializing speedtest..."}'
    send_ws_message "$start_msg"
    log "Sent starting message via WebSocket"
    
    # Run speedtest with JSON output and progress updates
    # --accept-license --accept-gdpr: Accept terms automatically
    # -f json: JSON output format
    # -p yes: Enable progress updates
    # --progress-update-interval=100: Update every 100ms
    /usr/bin/speedtest --accept-license --accept-gdpr -f json -p yes --progress-update-interval=100 2>&1 | \
    while IFS= read -r line; do
        # Skip empty lines
        [ -z "$line" ] && continue
        
        # Check if line is valid JSON
        if echo "$line" | grep -q '^{.*}$'; then
            # Add channel field to JSON
            json_with_channel=$(add_channel_to_json "$line")
            
            # Send via WebSocket
            send_ws_message "$json_with_channel"
            
            # Log the type of message sent
            msg_type=$(echo "$line" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)
            if [ -n "$msg_type" ]; then
                log "Sent $msg_type update via WebSocket"
            fi
            
            # If this is the final result, we're done
            if echo "$line" | grep -q '"type":"result"'; then
                log "Speedtest completed successfully"
                break
            fi
        fi
    done
    
    local speedtest_exit=$?
    
    if [ $speedtest_exit -ne 0 ]; then
        log_error "Speedtest CLI exited with error code: $speedtest_exit"
        # Send error message via WebSocket
        local error_msg='{"channel":"speedtest","type":"error","status":"error","message":"Speedtest failed"}'
        send_ws_message "$error_msg"
    else
        log "Speedtest completed and results sent via WebSocket"
    fi
    
    return $speedtest_exit
}

# Main function
main() {
    log "Speedtest daemon started"
    
    # Ensure temp directory exists
    ensure_tmp_dir
    
    # Check if already running
    if ! check_if_running; then
        log_error "Another speedtest is already in progress"
        exit 1
    fi
    
    # Write PID file
    echo "$$" > "$PID_FILE"
    
    # Verify dependencies
    if ! check_speedtest_cli; then
        log_error "speedtest CLI not available"
        cleanup
        exit 1
    fi
    
    if ! check_websocat; then
        log_warn "websocat not available, updates will not be sent"
        # Continue anyway in case websocat becomes available
    fi
    
    # Run the speedtest
    run_speedtest
    speedtest_result=$?
    
    # Cleanup
    cleanup
    
    exit $speedtest_result
}

# Execute main function
main
