#!/bin/sh

# Memory Daemon - Monitors system memory usage and writes to JSON file
# This daemon only runs when memory monitoring is enabled via settings

set -eu

# Ensure PATH for OpenWrt/BusyBox
export PATH="/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# Configuration
TMP_DIR="/tmp/quecmanager"
OUT_JSON="$TMP_DIR/memory.json"
PID_FILE="$TMP_DIR/memory_daemon.pid"
LOG_FILE="$TMP_DIR/memory_daemon.log"
CONFIG_FILE="/etc/quecmanager/settings/memory_settings.conf"
[ -f "$CONFIG_FILE" ] || CONFIG_FILE="/tmp/quecmanager/settings/memory_settings.conf"
DEFAULT_INTERVAL=1

# Ensure temp directory exists
ensure_tmp_dir() { 
    [ -d "$TMP_DIR" ] || mkdir -p "$TMP_DIR" || exit 1
} 

# Logging function
log() {
    printf '%s - %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG_FILE" 2>/dev/null || true
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

# Create default config if none exists
create_default_config() {
    local primary_config="/etc/quecmanager/settings/memory_settings.conf"
    local fallback_config="/tmp/quecmanager/settings/memory_settings.conf"
    
    if [ ! -f "$primary_config" ] && [ ! -f "$fallback_config" ]; then
        log "No config file found, creating default configuration"
        
        # Try primary location first
        if mkdir -p "/etc/quecmanager/settings" 2>/dev/null; then
            {
                echo "MEMORY_ENABLED=false"
                echo "MEMORY_INTERVAL=1"
            } > "$primary_config" 2>/dev/null && {
                chmod 644 "$primary_config" 2>/dev/null || true
                CONFIG_FILE="$primary_config"
                log "Created default config at $primary_config"
                return 0
            }
        fi
        
        # Fallback to tmp location
        mkdir -p "/tmp/quecmanager/settings" 2>/dev/null || true
        {
            echo "MEMORY_ENABLED=false"
            echo "MEMORY_INTERVAL=1"
        } > "$fallback_config" && {
            chmod 644 "$fallback_config" 2>/dev/null || true
            CONFIG_FILE="$fallback_config"
            log "Created default config at $fallback_config"
            return 0
        }
        
        log "Failed to create default config file"
        return 1
    fi
}

# Read configuration from file
read_config() {
    ENABLED="false"
    INTERVAL="$DEFAULT_INTERVAL"
    
    if [ -f "$CONFIG_FILE" ]; then
        MEMORY_ENABLED=$(grep -E "^MEMORY_ENABLED=" "$CONFIG_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '\r' | tr -d '"')
        MEMORY_INTERVAL=$(grep -E "^MEMORY_INTERVAL=" "$CONFIG_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '\r')
        
        case "${MEMORY_ENABLED:-}" in 
            true|1|on|yes|enabled) ENABLED="true" ;;
            *) ENABLED="false" ;;
        esac
        
        if echo "${MEMORY_INTERVAL:-}" | grep -qE '^[0-9]+$'; then
            if [ "$MEMORY_INTERVAL" -ge 1 ] && [ "$MEMORY_INTERVAL" -le 10 ]; then
                INTERVAL="$MEMORY_INTERVAL"
            fi
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

# Create default config if needed
create_default_config

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
    
    # Write the JSON data
    write_json_atomic "$json"
    log "Updated memory data: total=${TOTAL_KB:-0}KB, used=${USED_BYTES:-0}B, available=${AVAIL_KB:-0}KB"
    
    # Sleep for the configured interval
    sleep "$INTERVAL"
done