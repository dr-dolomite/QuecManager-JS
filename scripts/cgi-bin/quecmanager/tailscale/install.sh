#!/bin/sh

# Tailscale Installation Script
# Installs luci-app-tailscale using opkg

echo "Content-type: application/json"
echo ""

# Source centralized logging
. "/www/cgi-bin/services/quecmanager_logger.sh"

LOG_CATEGORY="service"
SCRIPT_NAME="tailscale_install"

PACKAGE_NAME="luci-app-tailscale"
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

# Install the package
install_package() {
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Installing $PACKAGE_NAME"
    
    # Check if already installed
    if opkg list-installed | grep -q "^${PACKAGE_NAME} "; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "$PACKAGE_NAME is already installed"
        echo '{"status":"success","message":"Tailscale is already installed","already_installed":true}'
        exit 0
    fi
    
    # Install the package
    local install_output=$(opkg install "$PACKAGE_NAME" 2>&1)
    local install_status=$?
    
    if [ $install_status -ne 0 ]; then
        qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to install $PACKAGE_NAME: $install_output"
        echo "{\"status\":\"error\",\"message\":\"Failed to install Tailscale\",\"error\":\"$install_output\"}"
        exit 1
    fi
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "$PACKAGE_NAME installed successfully"
    echo '{"status":"success","message":"Tailscale installed successfully. Page will refresh shortly.","installed":true}'
}

# Main installation flow
main() {
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Starting Tailscale installation"
    
    # Check if opkg cache is fresh
    if check_opkg_cache; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Using cached package lists"
    else
        # Update package lists if cache is stale or missing
        update_opkg_lists
    fi
    
    # Install the package
    install_package
}

# Run main function
main
