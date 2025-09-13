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
        sed -i "s/^$key=.*/$key=\"$value\"/" "$CONFIG_FILE"
    else
        echo "$key=\"$value\"" >> "$CONFIG_FILE"
    fi
}

# Parse latest modem data
get_latest_usage() {
    if [ ! -f "$DATA_FILE" ]; then
        echo "0 0"
        return
    fi
    
    # Get last complete JSON entry and extract modem data
    local entry=$(awk 'BEGIN{RS="}\n"} /^\s*\{/{print $0"}"}' "$DATA_FILE" | tail -1)
    local output=$(echo "$entry" | sed -n 's/.*"output"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    
    if [ -z "$output" ]; then
        echo "0 0"
        return
    fi
    
    # Convert escaped newlines and parse modem counters
    local data=$(echo "$output" | sed 's/\\r\\n/\n/g')
    
    # Parse LTE: +QGDCNT: received,sent
    local lte=$(echo "$data" | grep "+QGDCNT:" | head -1 | sed 's/.*+QGDCNT:[[:space:]]*\([0-9,[:space:]]*\).*/\1/')
    local lte_rx=$(echo "$lte" | cut -d',' -f1 | tr -d ' ')
    local lte_tx=$(echo "$lte" | cut -d',' -f2 | tr -d ' ')
    
    # Parse NR: +QGDNRCNT: sent,received  
    local nr=$(echo "$data" | grep "+QGDNRCNT:" | head -1 | sed 's/.*+QGDNRCNT:[[:space:]]*\([0-9,[:space:]]*\).*/\1/')
    local nr_tx=$(echo "$nr" | cut -d',' -f1 | tr -d ' ')
    local nr_rx=$(echo "$nr" | cut -d',' -f2 | tr -d ' ')
    
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
        # Counter reset detected - replace stored value
        new_tx="$curr_tx"
        log "TX counter reset detected, replacing stored value"
    else
        # Normal case - add current to stored
        new_tx=$((stored_tx + curr_tx))
        log "TX accumulating: $stored_tx + $curr_tx = $new_tx"
    fi
    
    if [ "$stored_rx" -gt "$curr_rx" ]; then
        # Counter reset detected - replace stored value  
        new_rx="$curr_rx"
        log "RX counter reset detected, replacing stored value"
    else
        # Normal case - add current to stored
        new_rx=$((stored_rx + curr_rx))
        log "RX accumulating: $stored_rx + $curr_rx = $new_rx"
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
        
        do_backup
    done
    
    log "Daemon exiting"
}

# Create config directory if needed
mkdir -p "$(dirname "$CONFIG_FILE")"

# Start main loop
main