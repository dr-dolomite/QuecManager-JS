#!/bin/sh

# Data Usage Backup Service
# Runs periodically to backup current usage data

CONFIG_DIR="/etc/quecmanager"
CONFIG_FILE="$CONFIG_DIR/data_usage"
BACKUP_DIR="/tmp/data_usage_backups"
LOG_FILE="/tmp/data_usage_backup.log"

# Logging function
log_message() {
    local message="$1"
    local level="${2:-info}"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message" >> "$LOG_FILE"
}

# Read configuration value
get_config() {
    local key="$1"
    if [ -f "$CONFIG_FILE" ]; then
        grep "^$key=" "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"'
    fi
}

# Set configuration value
set_config() {
    local key="$1"
    local value="$2"
    
    if [ -f "$CONFIG_FILE" ]; then
        if grep -q "^$key=" "$CONFIG_FILE"; then
            sed -i "s/^$key=.*/$key=$value/" "$CONFIG_FILE"
        else
            echo "$key=$value" >> "$CONFIG_FILE"
        fi
    fi
}

# Get current data usage from modem counters
get_modem_usage() {
    local logfile="/www/signal_graphs/data_usage.json"
    
    if [ ! -f "$logfile" ]; then
        echo "0 0"
        return
    fi
    
    # Get the latest entry
    local latest_entry=$(tail -n 1 "$logfile" | jq -r '.output' 2>/dev/null)
    
    if [ -z "$latest_entry" ] || [ "$latest_entry" = "null" ]; then
        echo "0 0"
        return
    fi
    
    # Parse LTE data (QGDCNT)
    local lte_received=$(echo "$latest_entry" | grep "+QGDCNT:" | sed 's/.*+QGDCNT: *\([0-9]*\),.*/\1/')
    local lte_sent=$(echo "$latest_entry" | grep "+QGDCNT:" | sed 's/.*+QGDCNT: *[0-9]*,\([0-9]*\).*/\1/')
    
    # Parse NR data (QGDNRCNT)
    local nr_sent=$(echo "$latest_entry" | grep "+QGDNRCNT:" | sed 's/.*+QGDNRCNT: *\([0-9]*\),.*/\1/')
    local nr_received=$(echo "$latest_entry" | grep "+QGDNRCNT:" | sed 's/.*+QGDNRCNT: *[0-9]*,\([0-9]*\).*/\1/')
    
    # Calculate totals
    local total_upload=$((${lte_sent:-0} + ${nr_sent:-0}))
    local total_download=$((${lte_received:-0} + ${nr_received:-0}))
    
    echo "$total_upload $total_download"
}

# Store current usage as baseline for next reboot
store_current_usage() {
    local current_usage=$(get_modem_usage)
    local current_upload=$(echo "$current_usage" | cut -d' ' -f1)
    local current_download=$(echo "$current_usage" | cut -d' ' -f2)
    
    # Get previously stored values
    local stored_upload=$(get_config "STORED_UPLOAD")
    local stored_download=$(get_config "STORED_DOWNLOAD")
    
    # Add current to stored (cumulative)
    local new_stored_upload=$((${stored_upload:-0} + ${current_upload:-0}))
    local new_stored_download=$((${stored_download:-0} + ${current_download:-0}))
    
    # Update stored values
    set_config "STORED_UPLOAD" "$new_stored_upload"
    set_config "STORED_DOWNLOAD" "$new_stored_download"
    set_config "LAST_BACKUP" "$(date +%s)"
    
    log_message "Stored usage - Upload: $new_stored_upload bytes, Download: $new_stored_download bytes"
}

# Check if backup is needed
should_backup() {
    local enabled=$(get_config "ENABLED")
    
    # Return early if disabled
    if [ "$enabled" != "true" ]; then
        return 1
    fi
    
    local backup_interval=$(get_config "BACKUP_INTERVAL")
    local last_backup=$(get_config "LAST_BACKUP")
    local current_time=$(date +%s)
    
    # Default interval if not set
    backup_interval=${backup_interval:-12}
    
    # Calculate interval in seconds
    local interval_seconds=$((backup_interval * 3600))
    
    # Check if enough time has passed
    if [ -z "$last_backup" ] || [ $((current_time - last_backup)) -ge $interval_seconds ]; then
        return 0
    fi
    
    return 1
}

# Main execution
main() {
    # Ensure directories exist
    mkdir -p "$CONFIG_DIR" "$BACKUP_DIR"
    
    log_message "Data usage backup service started"
    
    # Check if backup is needed
    if should_backup; then
        log_message "Backup interval reached, storing current usage"
        store_current_usage
        
        # Create timestamped backup file
        local timestamp=$(date +%s)
        local backup_file="$BACKUP_DIR/backup_$timestamp.json"
        local current_usage=$(get_modem_usage)
        local upload=$(echo "$current_usage" | cut -d' ' -f1)
        local download=$(echo "$current_usage" | cut -d' ' -f2)
        
        cat > "$backup_file" << EOF
{
    "timestamp": $timestamp,
    "datetime": "$(date)",
    "upload": $upload,
    "download": $download,
    "total": $((upload + download))
}
EOF
        
        # Keep only last 48 backup files (2 days worth if running hourly)
        ls -t "$BACKUP_DIR"/backup_*.json 2>/dev/null | tail -n +49 | xargs rm -f 2>/dev/null
        
        log_message "Backup created: $backup_file"
    else
        log_message "Backup not needed at this time"
    fi
}

# Handle different execution modes
case "${1:-main}" in
    "force")
        store_current_usage
        echo "Backup forced successfully"
        ;;
    "status")
        local enabled=$(get_config "ENABLED")
        local last_backup=$(get_config "LAST_BACKUP")
        local next_backup_time=$((${last_backup:-0} + $(get_config "BACKUP_INTERVAL" | head -c 2)00))
        
        cat << EOF
Data Usage Backup Status:
- Enabled: $enabled
- Last Backup: $(date -d "@${last_backup:-0}" 2>/dev/null || echo "Never")
- Next Backup: $(date -d "@$next_backup_time" 2>/dev/null || echo "Unknown")
- Backup Files: $(ls "$BACKUP_DIR"/backup_*.json 2>/dev/null | wc -l)
EOF
        ;;
    *)
        main
        ;;
esac
