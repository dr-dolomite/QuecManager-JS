#!/bin/sh

# Memory Data Fetch Script
# Returns current memory usage data from the memory daemon

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
MEMORY_JSON="/tmp/quecmanager/memory.json"
CONFIG_FILE="/etc/quecmanager/settings/memory_settings.conf"
FALLBACK_CONFIG_FILE="/tmp/quecmanager/settings/memory_settings.conf"

# Check if memory monitoring is enabled
is_memory_enabled() {
    local config_to_read=""
    if [ -f "$CONFIG_FILE" ]; then
        config_to_read="$CONFIG_FILE"
    elif [ -f "$FALLBACK_CONFIG_FILE" ]; then
        config_to_read="$FALLBACK_CONFIG_FILE"
    fi

    if [ -n "$config_to_read" ]; then
        local enabled_val=$(grep "^MEMORY_ENABLED=" "$config_to_read" 2>/dev/null | tail -n1 | cut -d'=' -f2 | tr -d '"')
        case "$enabled_val" in
            true|1|on|yes|enabled) return 0 ;;
            *) return 1 ;;
        esac
    fi
    return 1  # Default to disabled
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

# Check if memory monitoring is enabled
if ! is_memory_enabled; then
    echo "{\"status\":\"error\",\"code\":\"MEMORY_DISABLED\",\"message\":\"Memory monitoring is disabled. Enable it in settings to view memory data.\"}"
    exit 1
fi

# Check if daemon is running
if ! is_memory_daemon_running; then
    echo "{\"status\":\"error\",\"code\":\"DAEMON_NOT_RUNNING\",\"message\":\"Memory daemon is not running. Check memory settings.\"}"
    exit 1
fi

# Check if memory data file exists and is recent (within last 30 seconds)
if [ ! -f "$MEMORY_JSON" ]; then
    echo "{\"status\":\"error\",\"code\":\"NO_DATA\",\"message\":\"Memory data file not found. Memory daemon may be starting up.\"}"
    exit 1
fi

# Check if file is recent (modified within last 30 seconds)
# Get current time and file modification time
current_time=$(date +%s)
file_time=$(stat -c %Y "$MEMORY_JSON" 2>/dev/null)

if [ -z "$file_time" ]; then
    echo "{\"status\":\"error\",\"code\":\"STAT_ERROR\",\"message\":\"Cannot determine file modification time.\"}"
    exit 1
fi

# Check if file is older than 30 seconds
time_diff=$((current_time - file_time))
if [ "$time_diff" -gt 30 ]; then
    echo "{\"status\":\"error\",\"code\":\"STALE_DATA\",\"message\":\"Memory data is stale (${time_diff}s old). Memory daemon may have stopped.\"}"
    exit 1
fi

# Read and validate the memory data
if [ -r "$MEMORY_JSON" ]; then
    memory_content=$(cat "$MEMORY_JSON" 2>/dev/null)
    
    # Basic validation - check if it looks like valid JSON with required fields
    if echo "$memory_content" | grep -q '"total"' && echo "$memory_content" | grep -q '"used"' && echo "$memory_content" | grep -q '"available"'; then
        # Extract the data part and ensure it's properly formatted
        total=$(echo "$memory_content" | sed -n 's/.*"total"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p')
        used=$(echo "$memory_content" | sed -n 's/.*"used"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p')
        available=$(echo "$memory_content" | sed -n 's/.*"available"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p')
        
        # Validate that we got valid numbers
        if [ -n "$total" ] && [ -n "$used" ] && [ -n "$available" ] && \
           [ "$total" -gt 0 ] && [ "$used" -ge 0 ] && [ "$available" -ge 0 ]; then
            # Return properly formatted response
            echo "{\"status\":\"success\",\"data\":{\"total\":$total,\"used\":$used,\"available\":$available}}"
        else
            echo "{\"status\":\"error\",\"code\":\"INVALID_DATA\",\"message\":\"Memory data contains invalid values.\"}"
            exit 1
        fi
    else
        echo "{\"status\":\"error\",\"code\":\"INVALID_FORMAT\",\"message\":\"Memory data file has invalid format.\"}"
        exit 1
    fi
else
    echo "{\"status\":\"error\",\"code\":\"READ_ERROR\",\"message\":\"Cannot read memory data file.\"}"
    exit 1
fi
