#!/bin/sh

# Simple Data Usage Backup Daemon
# Periodically compares latest data_usage.json with stored config values

CONFIG_FILE="/etc/quecmanager/data_usage"
DATA_FILE="/www/signal_graphs/data_usage.json"
LOG_FILE="/tmp/data_usage_daemon.log"
PID_FILE="/var/run/data_usage_backup.pid"

# Store PID
echo $$ > "$PID_FILE"

# Simple logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$$] $1" >> "$LOG_FILE"
}

# Clean exit
cleanup() {
    log "Backup daemon shutting down"
    rm -f "$PID_FILE"
    exit 0
}
trap cleanup TERM INT

# Get config value
get_config() {
    grep "^$1=" "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"'
}

# Set config value  
set_config() {
    local key="$1" value="$2"
    if grep -q "^$key=" "$CONFIG_FILE" 2>/dev/null; then
        sed -i "s/^$key=.*/$key=$value/" "$CONFIG_FILE"
    else
        echo "$key=$value" >> "$CONFIG_FILE"
    fi
}

# Parse latest modem data with robust logic
get_latest_usage() {
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
        log "No complete JSON entries found in data file"
        echo "0 0"
        return
    fi
    
    # Extract the output field from the JSON entry
    local output_data=$(echo "$last_entry" | sed 's/.*"output"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    
    if [ -z "$output_data" ] || [ "$output_data" = "$last_entry" ]; then
        log "Failed to extract output data from JSON entry"
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

# Perform backup logic
do_backup() {
    log "Performing backup check..."
    
    # Get current modem usage
    local current=$(get_latest_usage)
    local curr_tx=$(echo "$current" | cut -d' ' -f1)
    local curr_rx=$(echo "$current" | cut -d' ' -f2)
    
    # Get stored values
    local stored_tx=$(get_config "STORED_UPLOAD")
    local stored_rx=$(get_config "STORED_DOWNLOAD")
    stored_tx=${stored_tx:-0}
    stored_rx=${stored_rx:-0}
    
    log "Current modem: tx=$curr_tx rx=$curr_rx, Stored: tx=$stored_tx rx=$stored_rx"
    
        # Compare and update logic
    local new_tx new_rx
    
    if [ "$stored_tx" -gt "$curr_tx" ]; then
        # Counter reset detected (reboot) - preserve stored + add new session
        new_tx=$((stored_tx + curr_tx))
        log "TX counter reset detected, preserving stored value: $stored_tx + $curr_tx = $new_tx"
    else
        # Normal case - just store current session total
        new_tx=$curr_tx
        log "TX normal update: $curr_tx"
    fi
    
    if [ "$stored_rx" -gt "$curr_rx" ]; then
        # Counter reset detected (reboot) - preserve stored + add new session
        new_rx=$((stored_rx + curr_rx))
        log "RX counter reset detected, preserving stored value: $stored_rx + $curr_rx = $new_rx"
    else
        # Normal case - just store current session total
        new_rx=$curr_rx
        log "RX normal update: $curr_rx"
    fi
    
    # Update config
    set_config "STORED_UPLOAD" "$new_tx"
    set_config "STORED_DOWNLOAD" "$new_rx"
    set_config "LAST_BACKUP" "$(date +%s)"
    
    log "Backup completed: stored tx=$new_tx rx=$new_rx"
}

# Main loop
main() {
    log "Backup daemon started"
    
    # Check if data usage tracking is enabled
    local enabled=$(get_config "ENABLED")
    if [ "$enabled" != "true" ]; then
        log "Data usage tracking disabled, exiting"
        exit 0
    fi
    
    # Check if automated backup is enabled
    local auto_backup_enabled=$(get_config "AUTO_BACKUP_ENABLED")
    if [ "$auto_backup_enabled" != "true" ]; then
        log "Automated backup disabled, exiting"
        exit 0
    fi
    
    # Initial backup
    do_backup
    
    while true; do
        # Get current interval from config
        local interval=$(get_config "BACKUP_INTERVAL")
        interval=${interval:-12}
        
        local sleep_seconds=$((interval * 3600))
        log "Sleeping for ${interval}h (${sleep_seconds}s)"
        
        sleep "$sleep_seconds"
        
        # Check if still enabled
        local enabled=$(get_config "ENABLED")
        if [ "$enabled" != "true" ]; then
            log "Service disabled, exiting"
            break
        fi
        
        # Check if automated backup is enabled
        local auto_backup_enabled=$(get_config "AUTO_BACKUP_ENABLED")
        if [ "$auto_backup_enabled" != "true" ]; then
            log "Automated backup disabled, exiting"
            break
        fi
        
        do_backup
    done
    
    log "Daemon exiting"
}

# Create config directory if needed
mkdir -p "$(dirname "$CONFIG_FILE")"

# Start main loop
main