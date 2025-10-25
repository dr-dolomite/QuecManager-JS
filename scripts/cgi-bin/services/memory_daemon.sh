#!/bin/sh

# Memory Daemon - Monitors system memory usage and writes to JSON file
# This daemon only runs when memory monitoring is enabled via settings

set -eu

# Ensure PATH for OpenWrt/BusyBox
export PATH="/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

# Configuration
TMP_DIR="/tmp/quecmanager"
OUT_JSON="$TMP_DIR/memory.json"
PID_FILE="$TMP_DIR/memory_daemon.pid"
DEFAULT_INTERVAL=1
SCRIPT_NAME="memory_daemon"
UCI_CONFIG="quecmanager"

# Ensure temp directory exists
ensure_tmp_dir() { 
    [ -d "$TMP_DIR" ] || mkdir -p "$TMP_DIR" || exit 1
} 

# Logging function
log() {
    qm_log_info "daemon" "$SCRIPT_NAME" "$1"
}

# Check if this daemon instance is already running
daemon_is_running() {
    if [ -f "$PID_FILE" ]; then
        pid="$(cat "$PID_FILE" 2>/dev/null || true)"
        if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
            # Verify it's actually our daemon by checking process cmdline
            if [ -r "/proc/$pid/cmdline" ] && grep -q "memory_daemon.sh" "/proc/$pid/cmdline" 2>/dev/null; then
                return 0
            else
                # PID file is stale, remove it
                rm -f "$PID_FILE" 2>/dev/null || true
            fi
        fi
    fi
    return 1
}

# Write our PID to file
write_pid() { 
    echo "$$" > "$PID_FILE"
}

# Cleanup function
cleanup() { 
    rm -f "$PID_FILE" 2>/dev/null || true
    log "Memory daemon stopped"
}

# Initialize UCI config
init_uci_config() {
    if ! uci get "$UCI_CONFIG.memory_daemon" >/dev/null 2>&1; then
        uci set "$UCI_CONFIG.memory_daemon=service"
        uci set "$UCI_CONFIG.memory_daemon.enabled=0"
        uci set "$UCI_CONFIG.memory_daemon.interval=$DEFAULT_INTERVAL"
        uci commit "$UCI_CONFIG"
        log "Initialized UCI memory daemon config with defaults"
    fi
}

# Read configuration from UCI
read_config() {
    ENABLED="false"
    INTERVAL="$DEFAULT_INTERVAL"
    
    init_uci_config
    
    MEMORY_ENABLED=$(uci get "$UCI_CONFIG.memory_daemon.enabled" 2>/dev/null || echo "0")
    MEMORY_INTERVAL=$(uci get "$UCI_CONFIG.memory_daemon.interval" 2>/dev/null || echo "$DEFAULT_INTERVAL")
    
    case "${MEMORY_ENABLED:-}" in 
        true|1|on|yes|enabled) ENABLED="true" ;;
        *) ENABLED="false" ;;
    esac
    
    if echo "${MEMORY_INTERVAL:-}" | grep -qE '^[0-9]+$'; then
        if [ "$MEMORY_INTERVAL" -ge 1 ] && [ "$MEMORY_INTERVAL" -le 10 ]; then
            INTERVAL="$MEMORY_INTERVAL"
        fi
    fi
}

# Write JSON data atomically
write_json_atomic() {
    local json_data="$1"
    local tmpfile="$(mktemp "$TMP_DIR/memory.XXXXXX" 2>/dev/null || echo "$TMP_DIR/memory.tmp.$$")"
    
    if [ -n "$tmpfile" ] && printf '%s' "$json_data" > "$tmpfile" 2>/dev/null; then
        mv "$tmpfile" "$OUT_JSON" 2>/dev/null || {
            # Fallback if move fails
            printf '%s' "$json_data" > "$OUT_JSON" 2>/dev/null || true
            rm -f "$tmpfile" 2>/dev/null || true
        }
    else
        # Direct write fallback
        printf '%s' "$json_data" > "$OUT_JSON" 2>/dev/null || true
        rm -f "$tmpfile" 2>/dev/null || true
    fi
}

# Main execution starts here
ensure_tmp_dir
log "Starting memory daemon (PID: $$)"

# Check if already running
if daemon_is_running; then 
    log "Memory daemon already running, exiting"
    exit 0
fi

# Set up signal handlers
trap cleanup EXIT INT TERM 
write_pid

# Main monitoring loop
while true; do
    read_config
    
    # Exit if disabled
    if [ "$ENABLED" != "true" ]; then 
        log "Memory monitoring disabled in config, exiting"
        exit 0
    fi
    
    # Get current timestamp
    ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    
    # Get memory information using /proc/meminfo (most reliable method)
    if [ -r "/proc/meminfo" ]; then
        # Extract values from /proc/meminfo (values are in kB)
        TOTAL_KB=$(grep "^MemTotal:" /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
        AVAIL_KB=$(grep "^MemAvailable:" /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
        FREE_KB=$(grep "^MemFree:" /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
        
        # If MemAvailable is not available (older kernels), estimate it
        if [ "$AVAIL_KB" = "0" ]; then
            CACHED_KB=$(grep "^Cached:" /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
            BUFFERS_KB=$(grep "^Buffers:" /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
            AVAIL_KB=$((FREE_KB + CACHED_KB + BUFFERS_KB))
        fi
        
        # Convert to bytes (multiply by 1024)
        TOTAL_BYTES=$((TOTAL_KB * 1024))
        AVAIL_BYTES=$((AVAIL_KB * 1024))
        USED_BYTES=$((TOTAL_BYTES - AVAIL_BYTES))
        
        json="{\"total\": $TOTAL_BYTES, \"used\": $USED_BYTES, \"available\": $AVAIL_BYTES, \"timestamp\": \"$ts\"}"
    else
        # Fallback if /proc/meminfo is not available
        log "Warning: /proc/meminfo not readable, using error response"
        json="{\"total\": 0, \"used\": 0, \"available\": 0, \"timestamp\": \"$ts\", \"error\": \"meminfo_unavailable\"}"
    fi
    
    # Write the JSON data to file (for backward compatibility)
    write_json_atomic "$json"
    
    # Send to WebSocat server if available (non-blocking)
    if command -v websocat >/dev/null 2>&1; then
        echo "$json" | websocat --one-message ws://localhost:8838 2>/dev/null || true
    fi
    
    log "Updated memory data: total=${TOTAL_KB:-0}KB, used=${USED_BYTES:-0}B, available=${AVAIL_KB:-0}KB"
    
    # Sleep for the configured interval
    sleep "$INTERVAL"
done