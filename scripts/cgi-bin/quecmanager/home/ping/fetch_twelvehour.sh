#!/bin/sh

# Ping 12-Hour Aggregated Data Fetch Script
# Each data point represents the average of 12 hours of hourly data

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

# Function to aggregate 12 hours of data into one entry
aggregate_twelvehour() {
    local start_line=$1
    local end_line=$2
    local temp_file="/tmp/ping_twelvehour_$$"
    
    # Extract the range of lines
    sed -n "${start_line},${end_line}p" "$HOURLY_JSON" > "$temp_file"
    
    # Calculate averages
    total_latency=0
    total_packet_loss=0
    valid_count=0
    first_timestamp=""
    host=""
    
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            # Extract values using grep
            latency=$(echo "$line" | grep -oE '"latency":[0-9]+' | cut -d':' -f2)
            packet_loss=$(echo "$line" | grep -oE '"packet_loss":[0-9]+' | cut -d':' -f2)
            
            # Get first timestamp and host
            if [ -z "$first_timestamp" ]; then
                first_timestamp=$(echo "$line" | grep -oE '"timestamp":"[^"]*"' | cut -d'"' -f4)
                host=$(echo "$line" | grep -oE '"host":"[^"]*"' | cut -d'"' -f4)
            fi
            
            if [ -n "$latency" ]; then
                total_latency=$((total_latency + latency))
                total_packet_loss=$((total_packet_loss + packet_loss))
                valid_count=$((valid_count + 1))
            fi
        fi
    done < "$temp_file"
    
    rm -f "$temp_file"
    
    # Calculate averages
    if [ "$valid_count" -gt 0 ]; then
        avg_latency=$((total_latency / valid_count))
        avg_packet_loss=$((total_packet_loss / valid_count))
        
        # Return JSON entry
        echo "{\"timestamp\":\"$first_timestamp\",\"host\":\"$host\",\"latency\":$avg_latency,\"packet_loss\":$avg_packet_loss,\"sample_count\":$valid_count}"
    fi
}

# Check if hourly data file exists
if [ -f "$HOURLY_JSON" ] && [ -r "$HOURLY_JSON" ]; then
    # Count total lines
    total_lines=$(wc -l < "$HOURLY_JSON" 2>/dev/null || echo "0")
    
    # Need at least 12 hours of data
    if [ "$total_lines" -ge 12 ]; then
        json_array="["
        first=true
        
        # Process data in 12-hour chunks from oldest to newest
        current_line=1
        while [ $current_line -le $total_lines ]; do
            end_line=$((current_line + 11))
            
            # Don't go past the end
            if [ $end_line -gt $total_lines ]; then
                end_line=$total_lines
            fi
            
            # Aggregate this 12-hour block
            aggregated=$(aggregate_twelvehour $current_line $end_line)
            
            if [ -n "$aggregated" ]; then
                if [ "$first" = true ]; then
                    json_array="${json_array}${aggregated}"
                    first=false
                else
                    json_array="${json_array},${aggregated}"
                fi
            fi
            
            # Move to next 12-hour block
            current_line=$((current_line + 12))
        done
        
        json_array="${json_array}]"
        
        # Return the array wrapped in success
        echo "{\"status\":\"success\",\"data\":${json_array}}"
    else
        echo "{\"status\":\"success\",\"data\":[],\"message\":\"Collecting data... Need at least 12 hours of data (currently have $total_lines hours)\"}"
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
