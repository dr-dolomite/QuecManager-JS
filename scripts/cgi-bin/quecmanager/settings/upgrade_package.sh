#!/bin/sh

# QuecManager Package Upgrade Script
# Upgrades the installed QuecManager package

# Set content type for JSON response
echo "Content-type: application/json"
echo ""

STABLE_PACKAGE="sdxpinn-quecmanager"
BETA_PACKAGE="sdxpinn-quecmanager-beta"

# Function to check if package is installed
is_package_installed() {
    opkg list-installed | grep -q "^$1 "
}

# Determine which package to upgrade
if is_package_installed "$STABLE_PACKAGE"; then
    PACKAGE_TO_UPGRADE="$STABLE_PACKAGE"
elif is_package_installed "$BETA_PACKAGE"; then
    PACKAGE_TO_UPGRADE="$BETA_PACKAGE"
else
    cat << EOF
{
    "status": "error",
    "message": "No QuecManager package found to upgrade"
}
EOF
    exit 0
fi

# Perform the upgrade
UPGRADE_OUTPUT=$(opkg upgrade "$PACKAGE_TO_UPGRADE" 2>&1)
UPGRADE_EXIT_CODE=$?

if [ $UPGRADE_EXIT_CODE -eq 0 ]; then
    # Get new version after upgrade
    NEW_VERSION=$(opkg list-installed | grep "^$PACKAGE_TO_UPGRADE - " | awk '{print $3}')
    
    cat << EOF
{
    "status": "success",
    "message": "QuecManager upgraded successfully",
    "package": "$PACKAGE_TO_UPGRADE",
    "new_version": "$NEW_VERSION",
    "timestamp": "$(date -Iseconds)"
}
EOF
else
    cat << EOF
{
    "status": "error",
    "message": "Failed to upgrade QuecManager",
    "package": "$PACKAGE_TO_UPGRADE",
    "error": "$UPGRADE_OUTPUT",
    "timestamp": "$(date -Iseconds)"
}
EOF
fi
