#!/bin/sh

# Ping Service Configuration Script - UCI-based version

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

# UCI Configuration
UCI_CONFIG="quecmanager"
UCI_SECTION="ping_daemon"

# Get current configuration from UCI
ENABLED="false"
INTERVAL="5"
HOST="8.8.8.8"

# Read from UCI (if section exists)
if uci -q get "$UCI_CONFIG.$UCI_SECTION" >/dev/null 2>&1; then
    enabled_val=$(uci -q get "$UCI_CONFIG.$UCI_SECTION.enabled" 2>/dev/null || echo "0")
    interval_val=$(uci -q get "$UCI_CONFIG.$UCI_SECTION.interval" 2>/dev/null || echo "5")
    host_val=$(uci -q get "$UCI_CONFIG.$UCI_SECTION.host" 2>/dev/null || echo "8.8.8.8")
    
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
