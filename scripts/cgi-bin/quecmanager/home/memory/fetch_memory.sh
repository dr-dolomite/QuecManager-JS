#!/bin/sh

# Memory Data Fetch Script - Simple OpenWrt/BusyBox compliant version

# Handle OPTIONS request
if [ "${REQUEST_METHOD:-GET}" = "OPTIONS" ]; then
    echo "Content-Type: text/plain"
    echo "Access-Control-Allow-Origin: *"
    echo "Access-Control-Allow-Methods: GET, OPTIONS"
    echo "Access-Control-Allow-Headers: Content-Type"
    echo "Access-Control-Max-Age: 86400"
    echo ""
    exit 0
fi

# Set CORS headers
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo ""

# Only handle GET requests
if [ "${REQUEST_METHOD:-GET}" != "GET" ]; then
    echo "{\"status\":\"error\",\"message\":\"Only GET method supported\"}"
    exit 1
fi

# Configuration and data paths
MEMORY_JSON="/tmp/quecmanager/memory.json"
CONFIG_FILE="/etc/quecmanager/settings/memory_settings.conf"

# Check if memory data file exists and read it
if [ -f "$MEMORY_JSON" ]; then
    memory_data=$(cat "$MEMORY_JSON" 2>/dev/null)
    
    # Simple validation - check if it has the basic structure
    if echo "$memory_data" | grep -q '"total"' && echo "$memory_data" | grep -q '"used"'; then
        # Extract values using awk (more reliable in BusyBox)
        total=$(echo "$memory_data" | awk -F'"total"[[:space:]]*:[[:space:]]*' '{print $2}' | awk -F'[,}]' '{print $1}')
        used=$(echo "$memory_data" | awk -F'"used"[[:space:]]*:[[:space:]]*' '{print $2}' | awk -F'[,}]' '{print $1}')
        available=$(echo "$memory_data" | awk -F'"available"[[:space:]]*:[[:space:]]*' '{print $2}' | awk -F'[,}]' '{print $1}')
        
        # Basic validation
        if [ -n "$total" ] && [ "$total" -gt 0 ] 2>/dev/null; then
            echo "{\"status\":\"success\",\"data\":{\"total\":$total,\"used\":$used,\"available\":$available}}"
        else
            echo "{\"status\":\"error\",\"message\":\"Invalid memory data\"}"
        fi
    else
        echo "{\"status\":\"error\",\"message\":\"Memory data file corrupted\"}"
    fi
else
    # No memory file - check if memory monitoring is enabled
    if [ -f "$CONFIG_FILE" ]; then
        enabled=$(awk -F'=' '/^MEMORY_ENABLED=/ {print $2}' "$CONFIG_FILE" 2>/dev/null | tr -d '"')
        case "$enabled" in
            true|1|on|yes|enabled)
                echo "{\"status\":\"error\",\"message\":\"Memory daemon starting up, please wait...\"}"
                ;;
            *)
                echo "{\"status\":\"error\",\"message\":\"Memory monitoring disabled\"}"
                ;;
        esac
    else
        echo "{\"status\":\"error\",\"message\":\"Memory monitoring not configured\"}"
    fi
fi
