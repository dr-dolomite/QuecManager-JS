#!/bin/sh

# Device Uptime Daemon
# Continuously monitors connection and updates uptime via WebSocket

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
PID_FILE="$TMP_DIR/uptime_daemon.pid"
UPTIME_STATE="$TMP_DIR/uptime_state.json"
REALTIME_JSON="$TMP_DIR/ping_realtime.json"
LOG_FILE="/tmp/log/uptime_daemon/uptime_daemon.log"
SCRIPT_NAME="uptime_daemon"

# Ensure directories exist
ensure_tmp_dir() { 
    [ -d "$TMP_DIR" ] || mkdir -p "$TMP_DIR" 2>/dev/null || true
    [ -d "/tmp/log/uptime_daemon" ] || mkdir -p "/tmp/log/uptime_daemon" 2>/dev/null || true
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
            info|*)
                qm_log_info "service" "$SCRIPT_NAME" "$message"
                ;;
        esac
    fi
    
    # Also log to legacy file for backward compatibility
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date)
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE" 2>/dev/null || true
}

daemon_is_running() {
    if [ -f "$PID_FILE" ]; then
        pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            if [ -r "/proc/$pid/cmdline" ] && grep -q "uptime_daemon.sh" "/proc/$pid/cmdline" 2>/dev/null; then
                return 0 
            else
                rm -f "$PID_FILE" 2>/dev/null || true
            fi
        else
            rm -f "$PID_FILE" 2>/dev/null || true
        fi
    fi
    return 1
}

write_pid() { echo "$$" > "$PID_FILE"; }

cleanup() { rm -f "$PID_FILE" 2>/dev/null || true; }

# Initialize uptime state
init_uptime_state() {
    if [ ! -f "$UPTIME_STATE" ]; then
        cat > "$UPTIME_STATE" <<EOF
{
    "uptime_seconds": 0,
    "last_update": $(date +%s),
    "is_connected": true,
    "last_disconnect": 0,
    "disconnect_count": 0
}
EOF
        chmod 644 "$UPTIME_STATE"
    fi
}

# Check connection status based on ping failures
check_connection_status() {
    if [ ! -f "$REALTIME_JSON" ]; then
        echo "false"
        return
    fi
    
    # Count failures in last 6 entries (roughly 1 minute)
    local failure_count=0
    
    tail -n 6 "$REALTIME_JSON" 2>/dev/null | while IFS= read -r line; do
        if [ -n "$line" ]; then
            # Check for failures
            if echo "$line" | grep -qE '"ok":false|"packet_loss":100'; then
                echo "FAIL"
            fi
        fi
    done > /tmp/uptime_check_$$
    
    failure_count=$(grep -c "FAIL" /tmp/uptime_check_$$ 2>/dev/null || echo "0")
    rm -f /tmp/uptime_check_$$
    
    # 5 or more failures = disconnected
    if [ "$failure_count" -ge 5 ]; then
        echo "false"
    else
        echo "true"
    fi
}

# Format uptime to human readable
format_uptime() {
    local total_seconds=$1
    local days=$((total_seconds / 86400))
    local hours=$(((total_seconds % 86400) / 3600))
    local minutes=$(((total_seconds % 3600) / 60))
    local seconds=$((total_seconds % 60))
    
    if [ $days -gt 0 ]; then
        printf "%dd %dh %dm %ds" "$days" "$hours" "$minutes" "$seconds"
    elif [ $hours -gt 0 ]; then
        printf "%dh %dm %ds" "$hours" "$minutes" "$seconds"
    elif [ $minutes -gt 0 ]; then
        printf "%dm %ds" "$minutes" "$seconds"
    else
        printf "%ds" "$seconds"
    fi
}

# Update uptime calculation
update_uptime() {
    init_uptime_state
    
    # Read current state
    local current_uptime=$(cat "$UPTIME_STATE" | grep -oE '"uptime_seconds":[0-9]+' | cut -d':' -f2)
    local last_update=$(cat "$UPTIME_STATE" | grep -oE '"last_update":[0-9]+' | cut -d':' -f2)
    local was_connected=$(cat "$UPTIME_STATE" | grep -oE '"is_connected":(true|false)' | cut -d':' -f2)
    local last_disconnect=$(cat "$UPTIME_STATE" | grep -oE '"last_disconnect":[0-9]+' | cut -d':' -f2)
    local disconnect_count=$(cat "$UPTIME_STATE" | grep -oE '"disconnect_count":[0-9]+' | cut -d':' -f2)
    
    # Defaults
    [ -z "$current_uptime" ] && current_uptime=0
    [ -z "$last_update" ] && last_update=$(date +%s)
    [ -z "$was_connected" ] && was_connected="true"
    [ -z "$last_disconnect" ] && last_disconnect=0
    [ -z "$disconnect_count" ] && disconnect_count=0
    
    # Check current connection
    local is_connected=$(check_connection_status)
    local current_time=$(date +%s)
    local time_elapsed=$((current_time - last_update))
    
    # Update uptime logic
    if [ "$is_connected" = "true" ]; then
        if [ "$was_connected" = "true" ]; then
            # Still connected, increment uptime
            current_uptime=$((current_uptime + time_elapsed))
        else
            # Just reconnected, reset uptime
            current_uptime=0
            disconnect_count=$((disconnect_count + 1))
            log "Connection restored, uptime reset" "info"
        fi
    else
        if [ "$was_connected" = "true" ]; then
            # Just disconnected
            last_disconnect=$current_time
            disconnect_count=$((disconnect_count + 1))
            log "Connection lost (failures detected)" "warn"
        fi
        # Uptime frozen while disconnected
    fi
    
    # Save state
    cat > "$UPTIME_STATE" <<EOF
{
    "uptime_seconds": $current_uptime,
    "last_update": $current_time,
    "is_connected": $is_connected,
    "last_disconnect": $last_disconnect,
    "disconnect_count": $disconnect_count
}
EOF
    chmod 644 "$UPTIME_STATE"
    
    # Format and send via WebSocket
    local formatted_uptime=$(format_uptime "$current_uptime")
    
    local json_data="{\"type\":\"uptime\",\"uptime_seconds\":$current_uptime,\"uptime_formatted\":\"$formatted_uptime\",\"is_connected\":$is_connected,\"disconnect_count\":$disconnect_count,\"last_disconnect\":$last_disconnect,\"timestamp\":$current_time}"
    
    # Send to WebSocket if available
    if command -v websocat >/dev/null 2>&1; then
        echo "$json_data" | websocat --one-message ws://localhost:8838 2>/dev/null || true
    fi
}

# Main daemon loop
ensure_tmp_dir
log "Starting uptime daemon (PID: $$)"

if daemon_is_running; then 
    log "Already running" "warn"
    exit 0
fi

trap cleanup EXIT INT TERM 
write_pid

# Initialize state
init_uptime_state

# Main loop - update every second
while true; do
    update_uptime
    sleep 1
done
