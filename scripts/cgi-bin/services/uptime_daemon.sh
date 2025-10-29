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

# State variables (kept in memory)
UPTIME_SECONDS=0
FAIL_COUNT=0
DISCONNECT_COUNT=0

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

# Load state from file
load_state() {
    if [ -f "$UPTIME_STATE" ]; then
        UPTIME_SECONDS=$(grep -oE '"uptime_seconds":[0-9]+' "$UPTIME_STATE" | cut -d':' -f2)
        FAIL_COUNT=$(grep -oE '"fail_count":[0-9]+' "$UPTIME_STATE" | cut -d':' -f2)
        DISCONNECT_COUNT=$(grep -oE '"disconnect_count":[0-9]+' "$UPTIME_STATE" | cut -d':' -f2)
        
        # Defaults if parsing failed
        [ -z "$UPTIME_SECONDS" ] && UPTIME_SECONDS=0
        [ -z "$FAIL_COUNT" ] && FAIL_COUNT=0
        [ -z "$DISCONNECT_COUNT" ] && DISCONNECT_COUNT=0
    fi
}

# Save state to file
save_state() {
    cat > "$UPTIME_STATE" <<EOF
{
    "uptime_seconds": $UPTIME_SECONDS,
    "fail_count": $FAIL_COUNT,
    "disconnect_count": $DISCONNECT_COUNT
}
EOF
    chmod 644 "$UPTIME_STATE"
}

# Check if last ping was successful
is_ping_ok() {
    if [ ! -f "$REALTIME_JSON" ]; then
        echo "0"
        return
    fi
    
    local last_ping=$(tail -n 1 "$REALTIME_JSON" 2>/dev/null)
    
    if [ -z "$last_ping" ]; then
        echo "0"
        return
    fi
    
    # Check if ping was successful (ok:true AND packet_loss NOT 100)
    if echo "$last_ping" | grep -q '"ok":true'; then
        if ! echo "$last_ping" | grep -q '"packet_loss":100'; then
            echo "1"
            return
        fi
    fi
    
    echo "0"
}

# Format uptime to human readable (max unit: days)
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

# Send uptime data via WebSocket
send_update() {
    local current_time=$(date +%s)
    local formatted_uptime=$(format_uptime "$UPTIME_SECONDS")
    local is_stable=$((FAIL_COUNT == 0))
    
    local json_data="{\"type\":\"uptime\",\"uptime_seconds\":$UPTIME_SECONDS,\"uptime_formatted\":\"$formatted_uptime\",\"is_connected\":$is_stable,\"disconnect_count\":$DISCONNECT_COUNT,\"fail_count\":$FAIL_COUNT,\"timestamp\":$current_time}"
    
    # Send to WebSocket server
    if command -v websocat >/dev/null 2>&1; then
        echo "$json_data" | websocat --one-message ws://localhost:8838 2>/dev/null || true
    fi
}

# Main daemon loop
ensure_tmp_dir
log "Starting uptime daemon (PID: $$)" "info"

if daemon_is_running; then 
    log "Already running" "warn"
    exit 0
fi

trap cleanup EXIT INT TERM 
write_pid

# Load existing state or start fresh
load_state

log "Loaded state: uptime=$UPTIME_SECONDS, fail_count=$FAIL_COUNT, disconnect_count=$DISCONNECT_COUNT" "info"

# Main loop - update every second
while true; do
    # Check if last ping was successful
    ping_ok=$(is_ping_ok)
    
    if [ "$ping_ok" = "1" ]; then
        # Ping successful - increment uptime
        UPTIME_SECONDS=$((UPTIME_SECONDS + 1))
        FAIL_COUNT=0
    else
        # Ping failed - freeze uptime, increment fail count
        FAIL_COUNT=$((FAIL_COUNT + 1))
        
        if [ "$FAIL_COUNT" -ge 5 ]; then
            # 5 consecutive failures - reset uptime
            if [ "$UPTIME_SECONDS" -gt 0 ]; then
                DISCONNECT_COUNT=$((DISCONNECT_COUNT + 1))
                log "Connection lost after ${UPTIME_SECONDS}s uptime (5 failures)" "warn"
            fi
            UPTIME_SECONDS=0
            FAIL_COUNT=0
        fi
    fi
    
    # Save state and send update
    save_state
    send_update
    
    sleep 1
done
