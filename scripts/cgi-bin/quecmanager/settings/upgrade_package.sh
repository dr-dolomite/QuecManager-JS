#!/bin/sh

# QuecManager Package Upgrade Script
# Upgrades the installed QuecManager package

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

# Set content type for JSON response
echo "Content-type: application/json"
echo ""

STABLE_PACKAGE="sdxpinn-quecmanager"
BETA_PACKAGE="sdxpinn-quecmanager-beta"
SCRIPT_NAME="upgrade_package"

# Log script start
qm_log_info "settings" "$SCRIPT_NAME" "Upgrade package script started"

# Function to check if package is installed
is_package_installed() {
    opkg list-installed | grep -q "^$1 "
}

# Log installed packages check
qm_log_debug "settings" "$SCRIPT_NAME" "Checking for installed QuecManager packages"
INSTALLED_PACKAGES=$(opkg list-installed | grep "sdxpinn-quecmanager" || echo "none")
qm_log_debug "settings" "$SCRIPT_NAME" "Found packages: $INSTALLED_PACKAGES"

# Determine which package to upgrade
if is_package_installed "$STABLE_PACKAGE"; then
    PACKAGE_TO_UPGRADE="$STABLE_PACKAGE"
    qm_log_info "settings" "$SCRIPT_NAME" "Detected stable package: $STABLE_PACKAGE"
elif is_package_installed "$BETA_PACKAGE"; then
    PACKAGE_TO_UPGRADE="$BETA_PACKAGE"
    qm_log_info "settings" "$SCRIPT_NAME" "Detected beta package: $BETA_PACKAGE"
else
    qm_log_error "settings" "$SCRIPT_NAME" "No QuecManager package found to upgrade"
    cat << EOF
{
    "status": "error",
    "message": "No QuecManager package found to upgrade",
    "debug": {
        "installed_packages": "$INSTALLED_PACKAGES"
    }
}
EOF
    exit 0
fi

# Get current version before upgrade
CURRENT_VERSION=$(opkg list-installed | grep "^$PACKAGE_TO_UPGRADE - " | awk '{print $3}')
qm_log_info "settings" "$SCRIPT_NAME" "Current version: $CURRENT_VERSION"

# Check available version
AVAILABLE_VERSION=$(opkg list | grep "^$PACKAGE_TO_UPGRADE - " | awk '{print $3}')
qm_log_info "settings" "$SCRIPT_NAME" "Available version: $AVAILABLE_VERSION"

# Check if upgrade is actually needed
if [ "$CURRENT_VERSION" = "$AVAILABLE_VERSION" ]; then
    qm_log_warn "settings" "$SCRIPT_NAME" "Package is already at latest version: $CURRENT_VERSION"
    cat << EOF
{
    "status": "info",
    "message": "Package is already at the latest version",
    "package": "$PACKAGE_TO_UPGRADE",
    "version": "$CURRENT_VERSION"
}
EOF
    exit 0
fi

# Perform the upgrade
qm_log_info "settings" "$SCRIPT_NAME" "Starting upgrade from $CURRENT_VERSION to $AVAILABLE_VERSION"
qm_log_debug "settings" "$SCRIPT_NAME" "Running: opkg upgrade $PACKAGE_TO_UPGRADE"

UPGRADE_OUTPUT=$(opkg upgrade "$PACKAGE_TO_UPGRADE" 2>&1)
UPGRADE_EXIT_CODE=$?

qm_log_debug "settings" "$SCRIPT_NAME" "Upgrade exit code: $UPGRADE_EXIT_CODE"
qm_log_debug "settings" "$SCRIPT_NAME" "Upgrade output: $UPGRADE_OUTPUT"

if [ $UPGRADE_EXIT_CODE -eq 0 ]; then
    # Get new version after upgrade
    NEW_VERSION=$(opkg list-installed | grep "^$PACKAGE_TO_UPGRADE - " | awk '{print $3}')
    qm_log_info "settings" "$SCRIPT_NAME" "Upgrade successful! New version: $NEW_VERSION"
    
    cat << EOF
{
    "status": "success",
    "message": "QuecManager upgraded successfully",
    "package": "$PACKAGE_TO_UPGRADE",
    "old_version": "$CURRENT_VERSION",
    "new_version": "$NEW_VERSION",
    "timestamp": "$(date -Iseconds)",
    "output": "$UPGRADE_OUTPUT"
}
EOF
else
    qm_log_error "settings" "$SCRIPT_NAME" "Upgrade failed with exit code $UPGRADE_EXIT_CODE"
    qm_log_error "settings" "$SCRIPT_NAME" "Error output: $UPGRADE_OUTPUT"
    
    cat << EOF
{
    "status": "error",
    "message": "Failed to upgrade QuecManager",
    "package": "$PACKAGE_TO_UPGRADE",
    "current_version": "$CURRENT_VERSION",
    "available_version": "$AVAILABLE_VERSION",
    "exit_code": $UPGRADE_EXIT_CODE,
    "error": "$UPGRADE_OUTPUT",
    "timestamp": "$(date -Iseconds)"
}
EOF
fi

qm_log_info "settings" "$SCRIPT_NAME" "Upgrade package script completed"