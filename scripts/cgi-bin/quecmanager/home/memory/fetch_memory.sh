#!/bin/sh

# Memory Data Fetch Script - UCI-based version

# Always set CORS headers first (no conditional OPTIONS handling)
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
MEMORY_JSON="/tmp/quecmanager/memory.json"
UCI_CONFIG="quecmanager"
UCI_SECTION="memory_daemon"

# Check if memory data file exists
if [ -f "$MEMORY_JSON" ] && [ -r "$MEMORY_JSON" ]; then
    # Read the file content
    memory_data=$(cat "$MEMORY_JSON" 2>/dev/null)
    
    # Check if we got content and it looks like JSON
    if [ -n "$memory_data" ] && echo "$memory_data" | grep -q '"total"'; then
        # File exists and has content, return it as-is if it's valid JSON
        if echo "$memory_data" | grep -q '"used"' && echo "$memory_data" | grep -q '"available"'; then
            echo "{\"status\":\"success\",\"data\":$memory_data}"
        else
            echo "{\"status\":\"error\",\"message\":\"Invalid memory data format\"}"
        fi
    else
        echo "{\"status\":\"error\",\"message\":\"Memory data file is empty or corrupted\"}"
    fi
else
    # No memory file exists - check UCI configuration
    if uci -q get "$UCI_CONFIG.$UCI_SECTION" >/dev/null 2>&1; then
        enabled_val=$(uci -q get "$UCI_CONFIG.$UCI_SECTION.enabled" 2>/dev/null || echo "0")
        # Check if memory monitoring is enabled
        case "$enabled_val" in
            true|1|on|yes|enabled)
                echo "{\"status\":\"error\",\"message\":\"Memory daemon starting up\"}"
                ;;
            *)
                echo "{\"status\":\"error\",\"message\":\"Memory monitoring disabled\"}"
                ;;
        esac
    else
        echo "{\"status\":\"error\",\"message\":\"Memory monitoring not configured\"}"
    fi
fi

# Always exit cleanly
exit 0