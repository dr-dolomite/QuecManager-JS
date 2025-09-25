#!/bin/sh

# Memory Data Fetch Script - Simplified and robust

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
CONFIG_FILE="/etc/quecmanager/settings/memory_settings.conf"

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
    # No memory file exists - check configuration
    if [ -f "$CONFIG_FILE" ] && [ -r "$CONFIG_FILE" ]; then
        # Check if memory monitoring is enabled
        if grep -q "^MEMORY_ENABLED=true" "$CONFIG_FILE" 2>/dev/null; then
            echo "{\"status\":\"error\",\"message\":\"Memory daemon starting up\"}"
        else
            echo "{\"status\":\"error\",\"message\":\"Memory monitoring disabled\"}"
        fi
    else
        echo "{\"status\":\"error\",\"message\":\"Memory monitoring not configured\"}"
    fi
fi

# Always exit cleanly
exit 0