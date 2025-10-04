#!/bin/sh

# QuecManager Package Information Script
# Returns information about installed QuecManager package (stable or beta)

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

# Set content type for JSON response
echo "Content-type: application/json"
echo ""

STABLE_PACKAGE="sdxpinn-quecmanager"
BETA_PACKAGE="sdxpinn-quecmanager-beta"
SCRIPT_NAME="check_package_info"

# Log script start
qm_log_info "settings" "$SCRIPT_NAME" "Check package info script started"

# Function to get package version
get_package_version() {
    opkg list-installed | grep "^$1 - " | awk '{print $3}'
}

# Function to get available package version
get_available_version() {
    opkg list | grep "^$1 - " | awk '{print $3}'
}

# Check which package is installed
qm_log_debug "settings" "$SCRIPT_NAME" "Checking for installed packages"
STABLE_VERSION=$(get_package_version "$STABLE_PACKAGE")
BETA_VERSION=$(get_package_version "$BETA_PACKAGE")
qm_log_debug "settings" "$SCRIPT_NAME" "Stable version: ${STABLE_VERSION:-none}, Beta version: ${BETA_VERSION:-none}"

if [ -n "$STABLE_VERSION" ]; then
    INSTALLED_PACKAGE="$STABLE_PACKAGE"
    INSTALLED_VERSION="$STABLE_VERSION"
    PACKAGE_TYPE="stable"
    qm_log_info "settings" "$SCRIPT_NAME" "Found stable package: $INSTALLED_PACKAGE v$INSTALLED_VERSION"
elif [ -n "$BETA_VERSION" ]; then
    INSTALLED_PACKAGE="$BETA_PACKAGE"
    INSTALLED_VERSION="$BETA_VERSION"
    PACKAGE_TYPE="beta"
    qm_log_info "settings" "$SCRIPT_NAME" "Found beta package: $INSTALLED_PACKAGE v$INSTALLED_VERSION"
else
    qm_log_error "settings" "$SCRIPT_NAME" "No QuecManager package found"
    cat << EOF
{
    "status": "error",
    "message": "No QuecManager package found"
}
EOF
    exit 0
fi

# Get available version for the installed package
qm_log_debug "settings" "$SCRIPT_NAME" "Checking for available version"
AVAILABLE_VERSION=$(get_available_version "$INSTALLED_PACKAGE")
qm_log_debug "settings" "$SCRIPT_NAME" "Available version: ${AVAILABLE_VERSION:-none}"

# Check if update is available
UPDATE_AVAILABLE="false"
if [ -n "$AVAILABLE_VERSION" ] && [ "$AVAILABLE_VERSION" != "$INSTALLED_VERSION" ]; then
    UPDATE_AVAILABLE="true"
    qm_log_info "settings" "$SCRIPT_NAME" "Update available: $INSTALLED_VERSION -> $AVAILABLE_VERSION"
else
    qm_log_info "settings" "$SCRIPT_NAME" "No update available, current version is latest"
fi

# Output JSON response
qm_log_info "settings" "$SCRIPT_NAME" "Returning package info"
cat << EOF
{
    "status": "success",
    "installed": {
        "package": "$INSTALLED_PACKAGE",
        "version": "$INSTALLED_VERSION",
        "type": "$PACKAGE_TYPE"
    },
    "available": {
        "version": "$AVAILABLE_VERSION",
        "update_available": $UPDATE_AVAILABLE
    }
}
EOF
