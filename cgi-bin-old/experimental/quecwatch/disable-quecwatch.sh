#!/bin/sh

# Set headers for JSON response
echo "Content-type: application/json"
echo ""

# Load UCI functions
. /lib/functions.sh

# Initialize error tracking
has_error=false
error_message=""

# Function to append to error message
append_error() {
    if [ -z "$error_message" ]; then
        error_message="$1"
    else
        error_message="$error_message; $1"
    fi
    has_error=true
}

# Function to log cleanup events
log_message() {
    local level="$1"
    local message="$2"
    local LOG_DIR="/tmp/log/quecwatch"
    local LOG_FILE="${LOG_DIR}/quecwatch.log"
    
    # Ensure log directory exists
    mkdir -p "${LOG_DIR}"
    
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "${timestamp} - [${level}] ${message}" >> "$LOG_FILE"
    logger -t quecwatch "${level}: ${message}"
}

# Function to cleanup QuecWatch
cleanup_quecwatch() {
    log_message "INFO" "Starting QuecWatch cleanup process"
    
    # Stop the service
    if /etc/init.d/quecwatch stop; then
        log_message "INFO" "QuecWatch service stopped"
    else
        append_error "Failed to stop QuecWatch service"
        log_message "ERROR" "Failed to stop QuecWatch service"
    fi
    
    # Disable and remove the init.d script
    if /etc/init.d/quecwatch disable; then
        log_message "INFO" "QuecWatch service disabled"
        
        # Remove the init.d script
        if [ -f "/etc/init.d/quecwatch" ]; then
            if rm -f "/etc/init.d/quecwatch"; then
                log_message "INFO" "Removed init.d script"
            else
                append_error "Failed to remove init.d script"
                log_message "ERROR" "Failed to remove init.d script"
            fi
        fi
        
        # Remove symlinks in rc.d if they exist
        for link in /etc/rc.d/S??quecwatch /etc/rc.d/K??quecwatch; do
            if [ -L "$link" ]; then
                if rm -f "$link"; then
                    log_message "INFO" "Removed rc.d symlink: $link"
                else
                    append_error "Failed to remove rc.d symlink: $link"
                    log_message "ERROR" "Failed to remove rc.d symlink: $link"
                fi
            fi
        done
    else
        append_error "Failed to disable QuecWatch service"
        log_message "ERROR" "Failed to disable QuecWatch service"
    fi
    
    # Kill any remaining QuecWatch processes
    if pkill -f "/www/cgi-bin/services/quecwatch.sh"; then
        log_message "INFO" "Killed remaining QuecWatch processes"
    fi
    
    # Update UCI configuration
    if uci -q get quecmanager.quecwatch >/dev/null; then
        uci set quecmanager.quecwatch.enabled='0'
        if ! uci commit quecmanager; then
            append_error "Failed to update UCI configuration"
            log_message "ERROR" "Failed to update UCI configuration"
        else
            log_message "INFO" "UCI configuration updated"
        fi
    fi
    
    # Remove the monitoring script
    if [ -f "/www/cgi-bin/services/quecwatch.sh" ]; then
        if rm -f "/www/cgi-bin/services/quecwatch.sh"; then
            log_message "INFO" "Removed monitoring script"
        else
            append_error "Failed to remove monitoring script"
            log_message "ERROR" "Failed to remove monitoring script"
        fi
    fi
    
    # Clean up temporary files
    local files_to_remove="
        /tmp/at_pipe.txt
        /var/run/quecwatch.pid
        /tmp/quecwatch_retry_count
    "
    
    for file in $files_to_remove; do
        if [ -f "$file" ]; then
            if rm -f "$file"; then
                log_message "INFO" "Removed temporary file: $file"
            else
                append_error "Failed to remove temporary file: $file"
                log_message "ERROR" "Failed to remove temporary file: $file"
            fi
        fi
    done
    
    log_message "INFO" "QuecWatch cleanup completed"
}

# Execute cleanup
cleanup_quecwatch

# Return appropriate JSON response
if [ "$has_error" = true ]; then
    echo "{\"status\": \"error\", \"message\": \"$error_message\"}"
else
    echo "{\"status\": \"success\", \"message\": \"QuecWatch disabled successfully\"}"
fi

exit 0