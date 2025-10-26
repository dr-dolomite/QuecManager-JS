#!/bin/sh

# Ping 12-Hour Data Fetch Script - Returns up to 12 hourly aggregated entries

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
HOURLY_JSON="/tmp/quecmanager/ping_hourly.json"
UCI_CONFIG="quecmanager"

# Check if hourly data file exists
if [ -f "$HOURLY_JSON" ] && [ -r "$HOURLY_JSON" ]; then
    # Read the file content and get only the last 12 entries
    hourly_data=$(tail -n 12 "$HOURLY_JSON" 2>/dev/null)
    
    # Check if we got content
    if [ -n "$hourly_data" ]; then
        # Convert newline-delimited JSON to a proper JSON array
        json_array="["
        first=true
        
        while IFS= read -r line; do
            # Skip empty lines
            if [ -n "$line" ]; then
                if [ "$first" = true ]; then
                    json_array="${json_array}${line}"
                    first=false
                else
                    json_array="${json_array},${line}"
                fi
            fi
        done << EOF
$hourly_data
EOF
        
        json_array="${json_array}]"
        
        # Return the array wrapped in success
        echo "{\"status\":\"success\",\"data\":${json_array}}"
    else
        echo "{\"status\":\"error\",\"message\":\"No 12-hour data available\"}"
    fi
else
    # No hourly file exists - check if ping monitoring is enabled
    PING_ENABLED=$(uci get "$UCI_CONFIG.ping_monitoring.enabled" 2>/dev/null || echo "0")
    
    case "$PING_ENABLED" in
        true|1|on|yes|enabled)
            echo "{\"status\":\"success\",\"data\":[],\"message\":\"Collecting 12-hour data...\"}"
            ;;
        *)
            echo "{\"status\":\"error\",\"message\":\"Ping monitoring disabled\"}"
            ;;
    esac
fi

# Always exit cleanly
exit 0
