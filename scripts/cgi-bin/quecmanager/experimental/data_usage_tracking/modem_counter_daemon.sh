#!/bin/sh

# QuecManager Modem Counter Daemon
# Independent service that provides real-time data usage accumulation
# Updates /tmp/quecmanager/modem_counter.json every 65 seconds

CONFIG_FILE="/etc/quecmanager/data_usage"
DATA_FILE="/www/signal_graphs/data_usage.json"
OUTPUT_FILE="/tmp/quecmanager/modem_counter.json"
LOG_FILE="/tmp/quecmanager_modem_counter.log"

# Simple logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$$] $1" >> "$LOG_FILE"
}

# Get config value
get_config() {
    grep "^$1=" "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"'
}

# Parse latest modem data with robust logic
get_latest_session() {
    if [ ! -f "$DATA_FILE" ]; then
        echo "0 0"
        return
    fi
    
    # Get the last complete JSON entry - use robust AWK parsing
    local last_entry=$(awk '
        BEGIN { in_object = 0; object = ""; brace_count = 0 }
        /^\s*\{/ { 
            in_object = 1; 
            brace_count = 1; 
            object = $0; 
            next 
        }
        in_object == 1 {
            object = object "\n" $0
            # Count braces to find the end of the object
            for (i = 1; i <= length($0); i++) {
                char = substr($0, i, 1)
                if (char == "{") brace_count++
                if (char == "}") brace_count--
            }
            if (brace_count == 0) {
                last_object = object
                in_object = 0
                object = ""
            }
        }
        END { if (last_object) print last_object }
    ' "$DATA_FILE")
    
    if [ -z "$last_entry" ]; then
        echo "0 0"
        return
    fi
    
    # Extract the output field from the JSON entry
    local output_data=$(echo "$last_entry" | sed 's/.*"output"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    
    if [ -z "$output_data" ] || [ "$output_data" = "$last_entry" ]; then
        echo "0 0"
        return
    fi
    
    # Convert escaped newlines to actual newlines for parsing
    output_data=$(echo "$output_data" | sed 's/\\r\\n/\n/g')
    
    # Parse LTE data (QGDCNT) - format: +QGDCNT: received,sent
    local lte_line=$(echo "$output_data" | grep "+QGDCNT:" | head -1)
    local lte_rx=0
    local lte_tx=0
    
    if [ -n "$lte_line" ]; then
        local lte_numbers=$(echo "$lte_line" | sed 's/.*+QGDCNT:[[:space:]]*\([0-9,[:space:]]*\).*/\1/')
        lte_rx=$(echo "$lte_numbers" | cut -d',' -f1 | tr -d ' ')
        lte_tx=$(echo "$lte_numbers" | cut -d',' -f2 | tr -d ' ')
        lte_rx=${lte_rx:-0}
        lte_tx=${lte_tx:-0}
    fi
    
    # Parse NR data (QGDNRCNT) - format: +QGDNRCNT: sent,received  
    local nr_line=$(echo "$output_data" | grep "+QGDNRCNT:" | head -1)
    local nr_tx=0
    local nr_rx=0
    
    if [ -n "$nr_line" ]; then
        local nr_numbers=$(echo "$nr_line" | sed 's/.*+QGDNRCNT:[[:space:]]*\([0-9,[:space:]]*\).*/\1/')
        nr_tx=$(echo "$nr_numbers" | cut -d',' -f1 | tr -d ' ')
        nr_rx=$(echo "$nr_numbers" | cut -d',' -f2 | tr -d ' ')
        nr_tx=${nr_tx:-0}
        nr_rx=${nr_rx:-0}
    fi
    
    # Calculate totals
    local total_tx=$((${lte_tx:-0} + ${nr_tx:-0}))
    local total_rx=$((${lte_rx:-0} + ${nr_rx:-0}))
    
    echo "$total_tx $total_rx"
}

# Update modem counter JSON
update_counter() {
    # Check if data usage tracking is enabled
    local enabled=$(get_config "ENABLED")
    if [ "$enabled" != "true" ]; then
        log "Data usage tracking disabled, creating empty response"
        printf '{"enabled":false,"upload":0,"download":0,"total":0,"timestamp":%s}\n' "$(date +%s)" > "$OUTPUT_FILE"
        return
    fi
    
    # Get stored values from config
    local stored_upload=$(get_config "STORED_UPLOAD")
    local stored_download=$(get_config "STORED_DOWNLOAD")
    stored_upload=${stored_upload:-0}
    stored_download=${stored_download:-0}
    
    # Get current session data
    local session_data=$(get_latest_session)
    local session_upload=$(echo "$session_data" | cut -d' ' -f1)
    local session_download=$(echo "$session_data" | cut -d' ' -f2)
    session_upload=${session_upload:-0}
    session_download=${session_download:-0}
    
    log "Session: upload=$session_upload, download=$session_download"
    log "Stored: upload=$stored_upload, download=$stored_download"
    
    # Apply the accumulation logic: if stored > session then add, else replace
    local final_upload
    local final_download
    
    if [ "$stored_upload" -gt "$session_upload" ]; then
        # Counter reset detected - preserve stored + add session
        final_upload=$((stored_upload + session_upload))
        log "Upload reset detected: $stored_upload + $session_upload = $final_upload"
    else
        # Normal case - use session total
        final_upload=$session_upload
        log "Upload normal: $session_upload"
    fi
    
    if [ "$stored_download" -gt "$session_download" ]; then
        # Counter reset detected - preserve stored + add session
        final_download=$((stored_download + session_download))
        log "Download reset detected: $stored_download + $session_download = $final_download"
    else
        # Normal case - use session total
        final_download=$session_download
        log "Download normal: $session_download"
    fi
    
    local total_usage=$((final_upload + final_download))
    local timestamp=$(date +%s)
    
    # Create JSON output
    printf '{"enabled":true,"upload":%s,"download":%s,"total":%s,"timestamp":%s}\n' \
        "$final_upload" "$final_download" "$total_usage" "$timestamp" > "$OUTPUT_FILE"
    
    log "Updated counter: upload=$final_upload, download=$final_download, total=$total_usage"
}

# Main loop
main() {
    log "QuecManager modem counter daemon started"
    
    # Create output directory
    mkdir -p "$(dirname "$OUTPUT_FILE")"
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Initial update
    update_counter
    
    while true; do
        sleep 65
        update_counter
    done
}

# Signal handlers for clean shutdown
shutdown() {
    log "QuecManager modem counter daemon shutting down"
    rm -f "$OUTPUT_FILE"
    exit 0
}

trap shutdown TERM INT

# Start main loop
main