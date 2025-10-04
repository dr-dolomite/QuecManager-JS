#!/bin/sh

# Ping Daily Data Fetch Script - Returns daily aggregated ping entries

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
DAILY_JSON="/tmp/quecmanager/ping_daily.json"
UCI_CONFIG="quecmanager"

# Check if daily data file exists
if [ -f "$DAILY_JSON" ] && [ -r "$DAILY_JSON" ]; then
    # Read the file content
    daily_data=$(cat "$DAILY_JSON" 2>/dev/null)
    
    # Check if we got content
    if [ -n "$daily_data" ]; then
        # Convert newline-delimited JSON to a proper JSON array
        # Each line is a complete JSON object, we need to wrap them in an array
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
$daily_data
EOF
        
        json_array="${json_array}]"
        
        # Return the array wrapped in success
        echo "{\"status\":\"success\",\"data\":${json_array}}"
    else
        echo "{\"status\":\"error\",\"message\":\"No daily data available\"}"
    fi
else
    # No daily file exists - check if ping monitoring is enabled
    PING_ENABLED=$(uci get "$UCI_CONFIG.ping_monitoring.enabled" 2>/dev/null || echo "0")
    
    case "$PING_ENABLED" in
        true|1|on|yes|enabled)
            echo "{\"status\":\"success\",\"data\":[],\"message\":\"Collecting data...\"}"
            ;;
        *)
            echo "{\"status\":\"error\",\"message\":\"Ping monitoring disabled\"}"
            ;;
    esac
fi

# Always exit cleanly
exit 0
