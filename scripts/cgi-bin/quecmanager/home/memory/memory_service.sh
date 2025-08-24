#!/bin/sh

# Memory Service Fetch Script
# Returns current memory configuration and status

# Handle OPTIONS request first
if [ "${REQUEST_METHOD:-GET}" = "OPTIONS" ]; then
    echo "Content-Type: text/plain"
    echo "Access-Control-Allow-Origin: *"
    echo "Access-Control-Allow-Methods: GET, OPTIONS"
    echo "Access-Control-Allow-Headers: Content-Type"
    echo "Access-Control-Max-Age: 86400"
    echo ""
    exit 0
fi

# Set content type and CORS headers
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Configuration paths
CONFIG_FILE="/etc/quecmanager/settings/memory_settings.conf"
FALLBACK_CONFIG_FILE="/tmp/quecmanager/settings/memory_settings.conf"

# Get current configuration
get_config() {
    # Defaults
    ENABLED="false"
    INTERVAL="1"

    # Try primary config first, then fallback
    local config_to_read=""
    if [ -f "$CONFIG_FILE" ]; then
        config_to_read="$CONFIG_FILE"
    elif [ -f "$FALLBACK_CONFIG_FILE" ]; then
        config_to_read="$FALLBACK_CONFIG_FILE"
    fi

    if [ -n "$config_to_read" ]; then
        local enabled_val=$(grep "^MEMORY_ENABLED=" "$config_to_read" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '"')
        local interval_val=$(grep "^MEMORY_INTERVAL=" "$config_to_read" 2>/dev/null | tail -n1 | cut -d'=' -f2)
        
        case "$enabled_val" in
            true|1|on|yes|enabled) ENABLED="true" ;;
            *) ENABLED="false" ;;
        esac
        
        if echo "$interval_val" | grep -qE '^[0-9]+$' && [ "$interval_val" -ge 1 ] && [ "$interval_val" -le 10 ]; then
            INTERVAL="$interval_val"
        fi
    fi
}

# Check if memory daemon is running
is_memory_daemon_running() {
    pgrep -f "memory_daemon.sh" >/dev/null 2>&1
}

# Handle GET request only
if [ "${REQUEST_METHOD:-GET}" != "GET" ]; then
    echo "{\"status\":\"error\",\"code\":\"METHOD_NOT_ALLOWED\",\"message\":\"Only GET method is supported\"}"
    exit 1
fi

# Get current configuration
get_config

# Check daemon status
running="false"
if is_memory_daemon_running; then
    running="true"
fi

# Return configuration and status
echo "{\"status\":\"success\",\"data\":{\"enabled\":$ENABLED,\"interval\":$INTERVAL,\"running\":$running}}"