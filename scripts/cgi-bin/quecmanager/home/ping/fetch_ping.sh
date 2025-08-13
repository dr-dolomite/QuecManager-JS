#!/bin/sh

# Fetch Ping Result (relocated under /home/ping)
# OpenWrt/BusyBox compatible version

# Handle OPTIONS first
if [ "${REQUEST_METHOD:-GET}" = "OPTIONS" ]; then
    echo "Content-Type: application/json"
    echo "Access-Control-Allow-Origin: *"
    echo "Access-Control-Allow-Methods: GET, OPTIONS"
    echo "Access-Control-Allow-Headers: Content-Type"
    echo ""
    exit 0
fi

# Set headers for other requests
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Configuration
OUT_JSON="/tmp/quecmanager/ping_latency.json"
CONFIG_FILE="/etc/quecmanager/settings/ping_settings.conf"
[ -f "$CONFIG_FILE" ] || CONFIG_FILE="/tmp/quecmanager/settings/ping_settings.conf"

# Get enabled setting
get_enabled() {
    local enabled="true"
    if [ -f "$CONFIG_FILE" ]; then
        val=$(grep -E "^PING_ENABLED=" "$CONFIG_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '\r' || echo "")
        case "${val:-}" in
            true|1|on|yes|enabled) enabled="true" ;;
            false|0|off|no|disabled) enabled="false" ;;
        esac
    fi
    echo "$enabled"
}

# Get interval setting
get_interval() {
    local interval="5"
    if [ -f "$CONFIG_FILE" ]; then
        val=$(grep -E "^PING_INTERVAL=" "$CONFIG_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '\r' || echo "")
        if [ -n "$val" ] && echo "$val" | grep -qE '^[0-9]+$'; then
            interval="$val"
        fi
    fi
    echo "$interval"
}

# Get host setting
get_host() {
    local host="8.8.8.8"
    if [ -f "$CONFIG_FILE" ]; then
        val=$(grep -E "^PING_HOST=" "$CONFIG_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '\r' || echo "")
        if [ -n "$val" ]; then
            host="$val"
        fi
    fi
    echo "$host"
}

# Get config values
ENABLED=$(get_enabled)
INTERVAL=$(get_interval)
HOST=$(get_host)

# Check if daemon JSON exists and is readable
if [ -f "$OUT_JSON" ] && [ -r "$OUT_JSON" ]; then
    # Read the daemon output
    PING_DATA=$(cat "$OUT_JSON" 2>/dev/null || echo "")
    
    if [ -n "$PING_DATA" ]; then
        # Simple approach: just wrap the daemon data with our response format
        echo "{\"status\":\"success\",\"data\":$PING_DATA,\"config\":{\"enabled\":$ENABLED,\"interval\":$INTERVAL,\"host\":\"$HOST\"}}"
    else
        # JSON file exists but is empty/unreadable
        echo "{\"status\":\"error\",\"message\":\"Ping data file exists but is empty or unreadable\"}"
    fi
else
    # Fallback: return default structure when daemon file doesn't exist
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")
    echo "{\"status\":\"success\",\"data\":{\"timestamp\":\"$TIMESTAMP\",\"host\":\"$HOST\",\"latency\":null,\"ok\":false},\"config\":{\"enabled\":$ENABLED,\"interval\":$INTERVAL,\"host\":\"$HOST\"}}"
fi
