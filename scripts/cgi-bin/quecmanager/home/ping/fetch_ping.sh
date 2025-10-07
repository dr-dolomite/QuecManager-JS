#!/bin/sh

# Ping Data Fetch Script - Simplified and OpenWrt compatible

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

# Paths
PING_JSON="/tmp/quecmanager/ping_latency.json"
UCI_CONFIG="quecmanager"

# Check if ping data file exists
if [ -f "$PING_JSON" ] && [ -r "$PING_JSON" ]; then
    # Read the file content
    ping_data=$(cat "$PING_JSON" 2>/dev/null)
    
    # Check if we got content and it looks like JSON
    if [ -n "$ping_data" ] && echo "$ping_data" | grep -q '"timestamp"'; then
        # File exists and has content, return it wrapped in success
        # Example: {"timestamp":"2025-10-04T05:54:58Z","host":"8.8.8.8","latency":117,"packet_loss":20,"ok":true}
        echo "{\"status\":\"success\",\"data\":$ping_data}"
    else
        echo "{\"status\":\"error\",\"message\":\"Ping data file is empty or corrupted\"}"
    fi
else
    # No ping file exists - check UCI configuration
    PING_ENABLED=$(uci get "$UCI_CONFIG.ping_monitoring.enabled" 2>/dev/null || echo "0")
    
    case "$PING_ENABLED" in
        true|1|on|yes|enabled)
            echo "{\"status\":\"error\",\"message\":\"Ping daemon starting up\"}"
            ;;
        *)
            echo "{\"status\":\"error\",\"message\":\"Ping monitoring disabled\"}"
            ;;
    esac
fi

# Always exit cleanly
exit 0
