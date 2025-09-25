#!/bin/sh

# QuecManager Log Cleanup Script
# Periodically clean up old log files to prevent /tmp from filling up

. /www/cgi-bin/services/quecmanager_logger.sh

# Configuration
MAX_LOG_AGE_DAYS=7      # Delete logs older than 7 days
MAX_BACKUP_FILES=2      # Keep maximum 2 backup files (.1, .2)
CLEANUP_LOG_SIZE=1000   # Run cleanup if any log exceeds 1MB

# Function to log cleanup activities
log_cleanup() {
    qm_log_info "system" "log_cleanup" "$1"
}

# Initialize
qm_init_logs
log_cleanup "Starting log cleanup process"

# Cleanup function
perform_cleanup() {
    local files_cleaned=0
    local space_freed=0
    
    # Clean up old backup files
    if [ -d "$QM_LOG_BASE" ]; then
        # Remove backup files older than specified days
        old_backups=$(find "$QM_LOG_BASE" -name "*.1" -o -name "*.2" -type f -mtime +$MAX_LOG_AGE_DAYS 2>/dev/null)
        for backup_file in $old_backups; do
            if [ -f "$backup_file" ]; then
                file_size=$(du -k "$backup_file" 2>/dev/null | cut -f1)
                rm -f "$backup_file" 2>/dev/null
                if [ $? -eq 0 ]; then
                    files_cleaned=$((files_cleaned + 1))
                    space_freed=$((space_freed + ${file_size:-0}))
                    log_cleanup "Removed old backup file: $(basename "$backup_file")"
                fi
            fi
        done
        
        # Force rotation for large log files
        for category_dir in "$QM_LOG_DAEMONS" "$QM_LOG_SERVICES" "$QM_LOG_SETTINGS" "$QM_LOG_SYSTEM"; do
            if [ -d "$category_dir" ]; then
                for logfile in "$category_dir"/*.log; do
                    if [ -f "$logfile" ]; then
                        # Check file size in KB
                        file_size_kb=$(du -k "$logfile" 2>/dev/null | cut -f1)
                        
                        if [ "${file_size_kb:-0}" -gt $CLEANUP_LOG_SIZE ]; then
                            log_cleanup "Rotating large log file: $(basename "$logfile") (${file_size_kb}KB)"
                            qm_rotate_log "$logfile"
                            files_cleaned=$((files_cleaned + 1))
                        fi
                    fi
                done
            fi
        done
        
        # Additional cleanup: remove empty log files
        empty_logs=$(find "$QM_LOG_BASE" -name "*.log" -type f -size 0 2>/dev/null)
        for empty_log in $empty_logs; do
            rm -f "$empty_log" 2>/dev/null
            if [ $? -eq 0 ]; then
                files_cleaned=$((files_cleaned + 1))
                log_cleanup "Removed empty log file: $(basename "$empty_log")"
            fi
        done
    fi
    
    # Log cleanup summary
    if [ $files_cleaned -gt 0 ]; then
        log_cleanup "Cleanup completed: $files_cleaned files processed, ${space_freed}KB freed"
    else
        log_cleanup "Cleanup completed: no files needed cleaning"
    fi
}

# Check if we should run cleanup based on disk usage
check_disk_usage() {
    # Check /tmp usage (OpenWrt compatible)
    local tmp_usage=""
    
    # Try df first (most common)
    if command -v df >/dev/null 2>&1; then
        tmp_usage=$(df /tmp 2>/dev/null | awk 'NR==2 {print $5}' | tr -d '%')
    fi
    
    # If we got a valid percentage and it's high, force cleanup
    if [ -n "$tmp_usage" ] && [ "$tmp_usage" -gt 80 ]; then
        log_cleanup "High /tmp usage detected (${tmp_usage}%), forcing cleanup"
        return 0
    fi
    
    # Always run periodic cleanup
    return 0
}

# Main execution
if check_disk_usage; then
    perform_cleanup
else
    log_cleanup "Disk usage check passed, skipping cleanup"
fi

# Clean up centralized log helper's old logs too
qm_cleanup_logs

log_cleanup "Log cleanup process completed"
