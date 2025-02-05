#!/bin/sh

# Set headers for JSON response
echo "Content-type: application/json"
echo ""

# Load UCI functions
. /lib/functions.sh

# Function to log message
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

# Reset retry counter and re-enable the service
if uci -q get quecmanager.quecwatch >/dev/null; then
    # Reset retry counter
    uci set quecmanager.quecwatch.current_retries='0'
    # Re-enable the service
    uci set quecmanager.quecwatch.enabled='1'
    
    if uci commit quecmanager; then
        # Restart the service
        if /etc/init.d/quecwatch restart; then
            log_message "INFO" "Retry counter reset to 0 and service restarted"
            echo '{"status": "success", "message": "Retry counter reset and service restarted successfully"}'
        else
            log_message "ERROR" "Failed to restart service after reset"
            echo '{"status": "error", "message": "Failed to restart service after reset"}'
        fi
    else
        log_message "ERROR" "Failed to reset retry counter"
        echo '{"status": "error", "message": "Failed to reset retry counter"}'
    fi
else
    echo '{"status": "error", "message": "QuecWatch configuration not found"}'
fi