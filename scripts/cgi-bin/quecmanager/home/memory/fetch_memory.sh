#!/bin/sh

# Fetch Memory Result (following ping pattern)
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
OUT_JSON="/tmp/quecmanager/memory.json"
CONFIG_FILE="/etc/quecmanager/settings/memory_settings.conf"
[ -f "$CONFIG_FILE" ] || CONFIG_FILE="/tmp/quecmanager/settings/memory_settings.conf"

# Get enabled setting
get_enabled() {
    local enabled="true"
    if [ -f "$CONFIG_FILE" ]; then
        val=$(grep -E "^MEMORY_ENABLED=" "$CONFIG_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '\r' || echo "")
        case "${val:-}" in
            true|1|on|yes|enabled) enabled="true" ;;
            false|0|off|no|disabled) enabled="false" ;;
        esac
    fi
    echo "$enabled"
}

# Get interval setting
get_interval() {
    local interval="1"
    if [ -f "$CONFIG_FILE" ]; then
        val=$(grep -E "^MEMORY_INTERVAL=" "$CONFIG_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '\r' || echo "")
        if [ -n "$val" ] && echo "$val" | grep -qE '^[0-9]+$'; then
            interval="$val"
        fi
    fi
    echo "$interval"
}

# Get config values
ENABLED=$(get_enabled)
INTERVAL=$(get_interval)

# Check if daemon JSON exists and is readable
if [ -f "$OUT_JSON" ] && [ -r "$OUT_JSON" ]; then
    # Read the daemon output
    MEMORY_DATA=$(cat "$OUT_JSON" 2>/dev/null || echo "")
    
    if [ -n "$MEMORY_DATA" ]; then
        # Simple approach: just wrap the daemon data with our response format
        echo "{\"status\":\"success\",\"data\":$MEMORY_DATA,\"config\":{\"enabled\":$ENABLED,\"interval\":$INTERVAL}}"
    else
        # JSON file exists but is empty/unreadable
        echo "{\"status\":\"error\",\"message\":\"Memory data file exists but is empty or unreadable\"}"
    fi
else
    # Fallback: get memory info directly using OpenWrt-compatible commands
    # Use /proc/meminfo which is more reliable on OpenWrt than 'free'
    if [ -r "/proc/meminfo" ]; then
        # Extract values from /proc/meminfo (values are in kB)
        TOTAL_KB=$(grep "^MemTotal:" /proc/meminfo | awk '{print $2}' || echo "0")
        AVAIL_KB=$(grep "^MemAvailable:" /proc/meminfo | awk '{print $2}' || echo "0")
        FREE_KB=$(grep "^MemFree:" /proc/meminfo | awk '{print $2}' || echo "0")
        
        # If MemAvailable is not available (older kernels), use MemFree
        if [ "$AVAIL_KB" = "0" ]; then
            AVAIL_KB="$FREE_KB"
        fi
        
        # Convert to bytes (multiply by 1024)
        TOTAL_BYTES=$((TOTAL_KB * 1024))
        AVAIL_BYTES=$((AVAIL_KB * 1024))
        USED_BYTES=$((TOTAL_BYTES - AVAIL_BYTES))
        
        # Generate timestamp
        TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")
        
        # Output JSON
        echo "{\"status\":\"success\",\"data\":{\"total\":$TOTAL_BYTES,\"used\":$USED_BYTES,\"available\":$AVAIL_BYTES,\"timestamp\":\"$TIMESTAMP\"},\"config\":{\"enabled\":$ENABLED,\"interval\":$INTERVAL}}"
    else
        echo "{\"status\":\"error\",\"message\":\"Unable to read memory information\"}"
    fi
fi
