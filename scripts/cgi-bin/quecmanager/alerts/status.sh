#!/bin/sh

# Alert System Status Script
# Checks if required packages are installed

echo "Content-type: application/json"
echo ""

# Source centralized logging
. "/www/cgi-bin/services/quecmanager_logger.sh"

LOG_CATEGORY="service"
SCRIPT_NAME="alerts_status"

REQUIRED_PACKAGES="ca-certificates msmtp"
CONFIG_FILE="/etc/msmtprc"
RECIPIENT_FILE="/etc/quecmanager_alert_recipient"
LAST_NOTIFICATION_FILE="/tmp/quecmanager/last_notification.log"

# Check if a package is installed
is_package_installed() {
    local package_name=$1
    opkg list-installed | grep -q "^${package_name} "
}

# Get package version
get_package_version() {
    local package_name=$1
    opkg list-installed | grep "^${package_name} " | awk '{print $3}'
}

# Main status check
main() {
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Checking alert system status"
    
    local all_installed=true
    local installed_packages=""
    local missing_packages=""
    local package_details="["
    local first=true
    
    # Check if configuration exists
    local config_exists=false
    local recipient_exists=false
    local threshold_value=""
    local is_running=false
    local recipient_email=""
    local sender_email=""
    local last_notification=""
    
    if [ -f "$CONFIG_FILE" ] && [ -r "$CONFIG_FILE" ]; then
        config_exists=true
        # Extract sender email from msmtprc
        sender_email=$(grep "^from" "$CONFIG_FILE" 2>/dev/null | awk '{print $2}')
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Email configuration file exists"
    fi
    
    if [ -f "$RECIPIENT_FILE" ] && [ -r "$RECIPIENT_FILE" ]; then
        recipient_exists=true
        recipient_email=$(cat "$RECIPIENT_FILE" 2>/dev/null || echo "")
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Recipient configuration file exists"
    fi
    
    # Read last notification info if exists
    if [ -f "$LAST_NOTIFICATION_FILE" ] && [ -r "$LAST_NOTIFICATION_FILE" ]; then
        last_notification=$(cat "$LAST_NOTIFICATION_FILE" 2>/dev/null | sed 's/"/\\"/g' | awk '{printf "%s\\n", $0}' | sed '$ s/\\n$//')
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Last notification data exists"
    fi
    
    # Read threshold value from UCI (default to 1 if not set)
    threshold_value=$(uci get quecmanager.connection_monitor.threshold 2>/dev/null || echo "1")
    
    local configured=false
    if $config_exists && $recipient_exists; then
        configured=true
    fi
    
    # Check if monitoring is enabled via UCI state (primary source of truth)
    local enabled_state=$(uci get quecmanager.connection_monitor.enabled 2>/dev/null || echo "0")
    
    if [ "$enabled_state" = "1" ]; then
        is_running=true
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Connection monitoring is enabled (UCI state: enabled=1)"
    else
        is_running=false
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Connection monitoring is disabled (UCI state: enabled=0)"
    fi
    
    for package in $REQUIRED_PACKAGES; do
        if ! $first; then
            package_details="$package_details,"
        fi
        first=false
        
        if is_package_installed "$package"; then
            local version=$(get_package_version "$package")
            package_details="$package_details{\"name\":\"$package\",\"installed\":true,\"version\":\"$version\"}"
            
            if [ -z "$installed_packages" ]; then
                installed_packages="$package"
            else
                installed_packages="$installed_packages, $package"
            fi
        else
            package_details="$package_details{\"name\":\"$package\",\"installed\":false}"
            all_installed=false
            
            if [ -z "$missing_packages" ]; then
                missing_packages="$package"
            else
                missing_packages="$missing_packages, $package"
            fi
        fi
    done
    
    package_details="$package_details]"
    
    # Determine ready_to_monitor status
    local ready_to_monitor=false
    if $all_installed && $configured; then
        ready_to_monitor=true
    fi
    
    # Build response
    if $all_installed; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "All alert system packages are installed"
        if $configured; then
            echo "{\"status\":\"success\",\"all_installed\":true,\"configured\":true,\"ready_to_monitor\":true,\"is_running\":$is_running,\"threshold\":$threshold_value,\"recipient\":\"$recipient_email\",\"sender\":\"$sender_email\",\"last_notification\":\"$last_notification\",\"packages\":$package_details,\"message\":\"Alert system is ready to monitor\"}"
        else
            echo "{\"status\":\"success\",\"all_installed\":true,\"configured\":false,\"ready_to_monitor\":false,\"is_running\":false,\"threshold\":$threshold_value,\"packages\":$package_details,\"message\":\"Packages installed, but email configuration is missing\"}"
        fi
    else
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Missing packages: $missing_packages"
        echo "{\"status\":\"success\",\"all_installed\":false,\"configured\":false,\"ready_to_monitor\":false,\"is_running\":false,\"threshold\":$threshold_value,\"packages\":$package_details,\"missing\":\"$missing_packages\",\"message\":\"Some alert system packages are not installed\"}"
    fi
}

# Run main function
main
