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
    
    # Build response
    if $all_installed; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "All alert system packages are installed"
        echo "{\"status\":\"success\",\"all_installed\":true,\"packages\":$package_details,\"message\":\"All alert system packages are installed\"}"
    else
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Missing packages: $missing_packages"
        echo "{\"status\":\"success\",\"all_installed\":false,\"packages\":$package_details,\"missing\":\"$missing_packages\",\"message\":\"Some alert system packages are not installed\"}"
    fi
}

# Run main function
main
