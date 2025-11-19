#!/bin/sh

# Device Uptime Daemon
# Broadcasts system uptime via WebSocket using OpenWRT's built-in uptime

# Ensure PATH for OpenWrt/BusyBox
export PATH="/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# Load centralized logging
LOGGER_SCRIPT="/www/cgi-bin/services/quecmanager_logger.sh"
if [ -f "$LOGGER_SCRIPT" ]; then
    . "$LOGGER_SCRIPT"
    USE_CENTRALIZED_LOGGING=1
else
    USE_CENTRALIZED_LOGGING=0
fi

TMP_DIR="/tmp/quecmanager"
PID_FILE="$TMP_DIR/device_uptime_daemon.pid"
SCRIPT_NAME="device_uptime_daemon"

# Websocket Configuration - Default to wss with self-signed certificate
WEBSOCKET_PORT=8838
WEBSOCKET_HOST="localhost"
WEBSOCKET_URL="wss://${WEBSOCKET_HOST}:${WEBSOCKET_PORT}"
WEBSOCKET_SERVICE="websocat"
WS_CMD="${WEBSOCKET_SERVICE} -k --one-message ${WEBSOCKET_URL}"


# Ensure directories exist
ensure_tmp_dir() {
    [ -d "$TMP_DIR" ] || mkdir -p "$TMP_DIR" 2>/dev/null || true
}

log() {
    local message="$1"
    local level="${2:-info}"

    # Use centralized logging if available
    if [ "$USE_CENTRALIZED_LOGGING" -eq 1 ]; then
        case "$level" in
            error)
                qm_log_error "service" "$SCRIPT_NAME" "$message"
                ;;
            warn)
                qm_log_warn "service" "$SCRIPT_NAME" "$message"
                ;;
            debug)
                qm_log_debug "service" "$SCRIPT_NAME" "$message"
                ;;
            *)
                qm_log_info "service" "$SCRIPT_NAME" "$message"
                ;;
        esac
    else
        # Fallback to echo
        echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message"
    fi
}

# Check if daemon is already running
check_running() {
    if [ -f "$PID_FILE" ]; then
        local old_pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            log "Daemon already running with PID $old_pid" "warn"
            exit 1
        else
            rm -f "$PID_FILE"
        fi
    fi
}

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

# Send update via WebSocket
send_update() {
    local uptime_seconds=$1
    local uptime_formatted=$2
    local current_timestamp=$(date +%s)

    # Create JSON message (single line to avoid heredoc issues)
    local json_msg="{\"type\":\"device_uptime\",\"uptime_seconds\":$uptime_seconds,\"uptime_formatted\":\"$uptime_formatted\",\"timestamp\":$current_timestamp}"

    # Log the update being sent
    log "Sending update: ${uptime_formatted} (${uptime_seconds}s)" "debug"

    # Send via ${WEBSOCKET_SERVICE} on port ${WEBSOCKET_PORT} (use --one-message like other daemons)
    if echo "$json_msg" | ${WS_CMD} 2>/dev/null; then
        log "Update sent successfully" "debug"
    else
        log "Failed to send update via WebSocket" "warn"
    fi
}

# Main daemon loop
main() {
    ensure_tmp_dir
    check_running

    # Write PID file
    echo $$ > "$PID_FILE"

    log "Device uptime daemon started (PID: $$)"

    # Test if ${WEBSOCKET_SERVICE} is available and WebSocket server is running
    if ! command -v "${WEBSOCKET_SERVICE}" >/dev/null 2>&1; then
        log "${WEBSOCKET_SERVICE} command not found!" "error"
        exit 1
    fi

    log "${WEBSOCKET_SERVICE} found, starting main loop" "debug"

    # Send a test message to verify WebSocket connectivity
    test_msg='{"type":"device_uptime","uptime_seconds":0,"uptime_formatted":"test","timestamp":0}'
    if echo "$test_msg" | ${WS_CMD} 2>/dev/null; then
        log "Test message sent successfully" "debug"
    else
        log "Failed to send test message - WebSocket may not be ready" "warn"
    fi

    # Main loop - update every 5 seconds
    while true; do
        # Get current system uptime
        uptime_seconds=$(get_uptime_seconds)
        uptime_formatted=$(format_uptime "$uptime_seconds")

        log "Current uptime: ${uptime_formatted}" "debug"

        # Send update via WebSocket
        send_update "$uptime_seconds" "$uptime_formatted"

        # Sleep for 5 seconds before next update
        sleep 5
    done
}

# Cleanup on exit
cleanup() {
    log "Device uptime daemon stopping"
    rm -f "$PID_FILE"
    exit 0
}

# Trap signals
trap cleanup INT TERM EXIT

# Run daemon
main
