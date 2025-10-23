#!/bin/sh

# Traffic Monitor Daemon - Monitors modem data usage to provide real-time speeds and writes 
# to websocat interface
# This daemon only runs when memory monitoring is enabled via settings

set -eu

# Ensure PATH for OpenWrt/BusyBox
export PATH="/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

# Configuration
TMP_DIR="/tmp/quecmanager"
OUT_JSON="$TMP_DIR/traffic.json"
PID_FILE="$TMP_DIR/traffic_daemon.pid"
CONFIG_FILE="/etc/quecmanager/settings/traffic_settings.conf"
[ -f "$CONFIG_FILE" ] || CONFIG_FILE="/tmp/quecmanager/settings/traffic_settings.conf"
DEFAULT_INTERVAL=1
SCRIPT_NAME="traffic_daemon"

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
            if [ -r "/proc/$pid/cmdline" ] && grep -q "traffic_daemon.sh" "/proc/$pid/cmdline" 2>/dev/null; then
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
    log "Traffic daemon stopped"
}

# Create default config if none exists
create_default_config() {
    local primary_config="/etc/quecmanager/settings/traffic_settings.conf"
    local fallback_config="/tmp/quecmanager/settings/traffic_settings.conf"
    
    if [ ! -f "$primary_config" ] && [ ! -f "$fallback_config" ]; then
        log "No config file found, creating default configuration"
        
        # Try primary location first
        if mkdir -p "/etc/quecmanager/settings" 2>/dev/null; then
            {
                echo "TRAFFIC_ENABLED=false"
                echo "TRAFFIC_INTERVAL=1"
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
            echo "TRAFFIC_ENABLED=false"
            echo "TRAFFIC_INTERVAL=1"
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
    INTERFACE="br-lan"  # Default interface
    
    if [ -f "$CONFIG_FILE" ]; then
        TRAFFIC_ENABLED=$(grep -E "^TRAFFIC_ENABLED=" "$CONFIG_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '\r' | tr -d '"')
        TRAFFIC_INTERVAL=$(grep -E "^TRAFFIC_INTERVAL=" "$CONFIG_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '\r')
        TRAFFIC_INTERFACE=$(grep -E "^TRAFFIC_INTERFACE=" "$CONFIG_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '\r' | tr -d '"')
        
        case "${TRAFFIC_ENABLED:-}" in 
            true|1|on|yes|enabled) ENABLED="true" ;;
            *) ENABLED="false" ;;
        esac
        
        if echo "${TRAFFIC_INTERVAL:-}" | grep -qE '^[0-9]+$'; then
            if [ "$TRAFFIC_INTERVAL" -ge 1 ] && [ "$TRAFFIC_INTERVAL" -le 10 ]; then
                INTERVAL="$TRAFFIC_INTERVAL"
            fi
        fi
        if [ -n "${TRAFFIC_INTERFACE:-}" ]; then
            INTERFACE="$TRAFFIC_INTERFACE"
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
log "Starting traffic monitoring daemon (PID: $$)"

# Check if already running
if daemon_is_running; then 
    log "Traffic monitoring daemon already running, exiting"
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
        log "Traffic monitoring disabled in config, exiting"
        exit 0
    fi
    
    # Get current timestamp
    ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    
    # Get traffic information using /sys/class/net/$INTERFACE/statistics/{rx_bytes,tx_bytes} (most reliable method)

    RX_BYTES=$(cat /sys/class/net/$INTERFACE/statistics/rx_bytes)
    TX_BYTES=$(cat /sys/class/net/$INTERFACE/statistics/tx_bytes)
    
    sleep 1
    
    RX_BYTES_NEW=$(cat /sys/class/net/$INTERFACE/statistics/rx_bytes)
    TX_BYTES_NEW=$(cat /sys/class/net/$INTERFACE/statistics/tx_bytes)
    
    RX_RATE=$((($RX_BYTES_NEW - $RX_BYTES) * 8 / 1024))  # Kbps
    TX_RATE=$((($TX_BYTES_NEW - $TX_BYTES) * 8 / 1024))  # Kbps
    
    echo "{ \"download\": ${RX_RATE}, \"upload\": ${TX_RATE} }" | websocat --one-message ws://localhost:8838/bandwidth-monitor
    
    RX_BYTES=$RX_BYTES_NEW
    TX_BYTES=$TX_BYTES_NEW

    
    
    # Write the JSON data
    write_json_atomic "$json"
    log "Updated memory data: total=${TOTAL_KB:-0}KB, used=${USED_BYTES:-0}B, available=${AVAIL_KB:-0}KB"
    
    # Sleep for the configured interval
    sleep "$INTERVAL"
done