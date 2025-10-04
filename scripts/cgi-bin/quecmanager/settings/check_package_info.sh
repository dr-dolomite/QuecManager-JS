#!/bin/sh

# QuecManager Package Information Script
# Returns information about installed QuecManager package (stable or beta)

# Set content type for JSON response
echo "Content-type: application/json"
echo ""

STABLE_PACKAGE="sdxpinn-quecmanager"
BETA_PACKAGE="sdxpinn-quecmanager-beta"

# Function to get package version
get_package_version() {
    opkg list-installed | grep "^$1 - " | awk '{print $3}'
}

# Function to get available package version
get_available_version() {
    opkg list | grep "^$1 - " | awk '{print $3}'
}

# Check which package is installed
STABLE_VERSION=$(get_package_version "$STABLE_PACKAGE")
BETA_VERSION=$(get_package_version "$BETA_PACKAGE")

if [ -n "$STABLE_VERSION" ]; then
    INSTALLED_PACKAGE="$STABLE_PACKAGE"
    INSTALLED_VERSION="$STABLE_VERSION"
    PACKAGE_TYPE="stable"
elif [ -n "$BETA_VERSION" ]; then
    INSTALLED_PACKAGE="$BETA_PACKAGE"
    INSTALLED_VERSION="$BETA_VERSION"
    PACKAGE_TYPE="beta"
else
    cat << EOF
{
    "status": "error",
    "message": "No QuecManager package found"
}
EOF
    exit 0
fi

# Get available version for the installed package
AVAILABLE_VERSION=$(get_available_version "$INSTALLED_PACKAGE")

# Check if update is available
UPDATE_AVAILABLE="false"
if [ -n "$AVAILABLE_VERSION" ] && [ "$AVAILABLE_VERSION" != "$INSTALLED_VERSION" ]; then
    UPDATE_AVAILABLE="true"
fi

# Output JSON response
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
