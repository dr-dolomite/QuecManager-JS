#!/bin/sh

# Ping Service Configuration Script - Simple OpenWrt compatible version

# Always set CORS headers first
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Handle OPTIONS request and exit early
if [ "${REQUEST_METHOD:-GET}" = "OPTIONS" ]; then
    echo "{\"status\":\"success\"}"
    exit 0
fi

# Only handle GET requests
if [ "${REQUEST_METHOD:-GET}" != "GET" ]; then
    echo "{\"status\":\"error\",\"message\":\"Method not allowed\"}"
    exit 0
fi

# Configuration path
CONFIG_FILE="/etc/quecmanager/settings/ping_settings.conf"

# Get current configuration
ENABLED="false"
INTERVAL="5"
HOST="8.8.8.8"

if [ -f "$CONFIG_FILE" ] && [ -r "$CONFIG_FILE" ]; then
    # Parse config using awk (more reliable in BusyBox)
    enabled_val=$(awk -F'=' '/^PING_ENABLED=/ {print $2}' "$CONFIG_FILE" 2>/dev/null | tr -d '"')
    interval_val=$(awk -F'=' '/^PING_INTERVAL=/ {print $2}' "$CONFIG_FILE" 2>/dev/null)
    host_val=$(awk -F'=' '/^PING_HOST=/ {print $2}' "$CONFIG_FILE" 2>/dev/null | tr -d '"')
    
    case "$enabled_val" in
        true|1|on|yes|enabled) ENABLED="true" ;;
        *) ENABLED="false" ;;
    esac
    
    if echo "$interval_val" | grep -qE '^[0-9]+$' && [ "$interval_val" -ge 1 ] && [ "$interval_val" -le 3600 ]; then
        INTERVAL="$interval_val"
    fi
    
    if [ -n "$host_val" ]; then
        HOST="$host_val"
    fi
fi

# Check if ping daemon is running
RUNNING="false"
if pgrep -f "ping_daemon.sh" >/dev/null 2>&1; then
    RUNNING="true"
fi

# Return configuration and status
echo "{\"status\":\"success\",\"data\":{\"enabled\":$ENABLED,\"interval\":$INTERVAL,\"host\":\"$HOST\",\"running\":$RUNNING}}"

# Always exit cleanly
exit 0
