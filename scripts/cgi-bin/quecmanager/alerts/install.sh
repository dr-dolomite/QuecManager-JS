#!/bin/sh

# Alert System Dependencies Installation Script
# Installs ca-certificates and msmtp packages using opkg

echo "Content-type: application/json"
echo ""

# Source centralized logging
. "/www/cgi-bin/services/quecmanager_logger.sh"

LOG_CATEGORY="service"
SCRIPT_NAME="alerts_install"

PACKAGES="ca-certificates msmtp"
OPKG_LISTS_DIR="/var/opkg-lists"
CACHE_MAX_AGE=3600  # 1 hour in seconds

# Check if opkg lists are cached and fresh
check_opkg_cache() {
    # Check if opkg lists directory exists and has files
    if [ ! -d "$OPKG_LISTS_DIR" ] || [ -z "$(ls -A $OPKG_LISTS_DIR 2>/dev/null)" ]; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "No opkg cache found"
        return 1
    fi
    
    # Get the modification time of the newest file in opkg-lists
    local newest_file=$(find "$OPKG_LISTS_DIR" -type f -exec stat -c '%Y' {} \; 2>/dev/null | sort -rn | head -n 1)
    
    if [ -z "$newest_file" ]; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "No valid opkg cache files found"
        return 1
    fi
    
    local current_time=$(date +%s)
    local cache_age=$((current_time - newest_file))
    
    if [ "$cache_age" -lt "$CACHE_MAX_AGE" ]; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Using cached opkg lists (age: ${cache_age}s)"
        return 0
    else
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Opkg cache is stale (age: ${cache_age}s)"
        return 1
    fi
}

# Update opkg package lists
update_opkg_lists() {
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Updating opkg package lists"
    
    if ! opkg update 2>&1; then
        qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to update opkg lists"
        echo '{"status":"error","message":"Failed to update package lists","error":"opkg update failed"}'
        exit 1
    fi
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Package lists updated successfully"
}

# Check if a package is installed
is_package_installed() {
    local package_name=$1
    opkg list-installed | grep -q "^${package_name} "
}

# Install packages
install_packages() {
    local packages_to_install=""
    local already_installed=""
    
    # Check which packages need to be installed
    for package in $PACKAGES; do
        if is_package_installed "$package"; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "$package is already installed"
            if [ -z "$already_installed" ]; then
                already_installed="$package"
            else
                already_installed="$already_installed, $package"
            fi
        else
            if [ -z "$packages_to_install" ]; then
                packages_to_install="$package"
            else
                packages_to_install="$packages_to_install $package"
            fi
        fi
    done
    
    # If all packages are already installed
    if [ -z "$packages_to_install" ]; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "All alert system packages are already installed"
        echo '{"status":"success","message":"All alert system packages are already installed","already_installed":true,"packages":"'"$already_installed"'"}'
        exit 0
    fi
    
    # Install packages that are not yet installed
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Installing packages: $packages_to_install"
    
    local install_output=$(opkg install $packages_to_install 2>&1)
    local install_status=$?
    
    if [ $install_status -ne 0 ]; then
        qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to install packages: $install_output"
        echo "{\"status\":\"error\",\"message\":\"Failed to install alert system packages\",\"error\":\"$install_output\"}"
        exit 1
    fi
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Packages installed successfully: $packages_to_install"
    
    # Build success message
    local message="Alert system packages installed successfully"
    if [ -n "$already_installed" ]; then
        message="$message. Already installed: $already_installed"
    fi
    
    echo "{\"status\":\"success\",\"message\":\"$message\",\"installed\":\"$packages_to_install\",\"already_installed\":\"$already_installed\"}"
}

# Main installation flow
main() {
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Starting alert system packages installation"
    
    # Check if opkg cache is fresh
    if check_opkg_cache; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Using cached package lists"
    else
        # Update package lists if cache is stale or missing
        update_opkg_lists
    fi
    
    # Install the packages
    install_packages
}

# Run main function
main
