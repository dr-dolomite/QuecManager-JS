#!/bin/sh

# Data Usage Cron Service Manager
# Manages automatic backups and monitoring for data usage tracking

CONFIG_DIR="/etc/quecmanager"
CONFIG_FILE="$CONFIG_DIR/data_usage"
CRON_FILE="/etc/crontabs/root"
BACKUP_SCRIPT="/usr/bin/quecmanager/experimental/data_usage_tracking/backup_service.sh"

# Logging
log_message() {
    local message="$1"
    local level="${2:-info}"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message" >> /tmp/data_usage_cron.log
}

# Read configuration
get_config() {
    local key="$1"
    if [ -f "$CONFIG_FILE" ]; then
        grep "^$key=" "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"'
    fi
}

# Add cron job for data usage backup
add_cron_job() {
    local interval="$1"
    local cron_expr
    
    case "$interval" in
        3)  cron_expr="0 */3 * * *" ;;   # Every 3 hours
        6)  cron_expr="0 */6 * * *" ;;   # Every 6 hours
        12) cron_expr="0 */12 * * *" ;;  # Every 12 hours
        24) cron_expr="0 2 * * *" ;;     # Daily at 2 AM
        *)  cron_expr="0 */12 * * *" ;;  # Default to 12 hours
    esac
    
    # Remove existing data usage cron jobs
    remove_cron_job
    
    # Add new cron job
    local cron_line="$cron_expr $BACKUP_SCRIPT"
    
    # Create backup of current crontab
    if [ -f "$CRON_FILE" ]; then
        cp "$CRON_FILE" "$CRON_FILE.backup"
    else
        touch "$CRON_FILE"
    fi
    
    # Add the new cron job
    echo "$cron_line" >> "$CRON_FILE"
    
    # Restart cron service
    /etc/init.d/cron restart 2>/dev/null || {
        # If cron service restart fails, try alternative methods
        killall crond 2>/dev/null
        sleep 1
        crond 2>/dev/null &
    }
    
    log_message "Added cron job: $cron_line"
}

# Remove data usage cron jobs
remove_cron_job() {
    if [ -f "$CRON_FILE" ]; then
        # Remove lines containing the backup script
        grep -v "$BACKUP_SCRIPT" "$CRON_FILE" > "$CRON_FILE.tmp" || touch "$CRON_FILE.tmp"
        mv "$CRON_FILE.tmp" "$CRON_FILE"
        
        # Restart cron service
        /etc/init.d/cron restart 2>/dev/null || {
            killall crond 2>/dev/null
            sleep 1
            crond 2>/dev/null &
        }
        
        log_message "Removed data usage cron jobs"
    fi
}

# Check if cron job exists
check_cron_job() {
    if [ -f "$CRON_FILE" ]; then
        grep -q "$BACKUP_SCRIPT" "$CRON_FILE"
        return $?
    fi
    return 1
}

# Update cron job based on current configuration
update_cron_job() {
    local enabled=$(get_config "ENABLED")
    local interval=$(get_config "BACKUP_INTERVAL")
    
    if [ "$enabled" = "true" ]; then
        if check_cron_job; then
            # Check if interval has changed
            local current_interval
            if grep -q "*/3" "$CRON_FILE" 2>/dev/null; then
                current_interval="3"
            elif grep -q "*/6" "$CRON_FILE" 2>/dev/null; then
                current_interval="6"
            elif grep -q "*/12" "$CRON_FILE" 2>/dev/null; then
                current_interval="12"
            elif grep -q "2 \* \*" "$CRON_FILE" 2>/dev/null; then
                current_interval="24"
            fi
            
            if [ "$current_interval" != "$interval" ]; then
                log_message "Interval changed from $current_interval to $interval, updating cron job"
                add_cron_job "$interval"
            fi
        else
            log_message "Data usage tracking enabled, adding cron job"
            add_cron_job "$interval"
        fi
    else
        if check_cron_job; then
            log_message "Data usage tracking disabled, removing cron job"
            remove_cron_job
        fi
    fi
}

# Get cron status
get_status() {
    local enabled=$(get_config "ENABLED")
    local interval=$(get_config "BACKUP_INTERVAL")
    local cron_active="false"
    
    if check_cron_job; then
        cron_active="true"
    fi
    
    cat << EOF
{
    "enabled": $enabled,
    "interval": $interval,
    "cronActive": $cron_active,
    "backupScript": "$BACKUP_SCRIPT"
}
EOF
}

# Install backup script to system location
install_backup_script() {
    local source_script="/cgi-bin/quecmanager/experimental/data_usage_tracking/backup_service.sh"
    local target_dir="/usr/bin/quecmanager/experimental/data_usage_tracking"
    
    # Create target directory
    mkdir -p "$target_dir"
    
    # Copy script if source exists
    if [ -f "$source_script" ]; then
        cp "$source_script" "$BACKUP_SCRIPT"
        chmod +x "$BACKUP_SCRIPT"
        log_message "Installed backup script to $BACKUP_SCRIPT"
    else
        log_message "Source backup script not found: $source_script" "error"
        return 1
    fi
}

# Main execution
case "${1:-update}" in
    "install")
        install_backup_script
        update_cron_job
        ;;
    "update")
        update_cron_job
        ;;
    "remove")
        remove_cron_job
        ;;
    "status")
        echo "Content-Type: application/json"
        echo ""
        get_status
        ;;
    "force-backup")
        # Run backup immediately
        if [ -x "$BACKUP_SCRIPT" ]; then
            "$BACKUP_SCRIPT" force
        else
            echo "Backup script not found or not executable"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {install|update|remove|status|force-backup}"
        echo ""
        echo "Commands:"
        echo "  install      - Install backup script and setup cron"
        echo "  update       - Update cron job based on current config"
        echo "  remove       - Remove all data usage cron jobs"
        echo "  status       - Show current cron status"
        echo "  force-backup - Run backup immediately"
        exit 1
        ;;
esac
