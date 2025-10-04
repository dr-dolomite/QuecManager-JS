#!/bin/sh

# QuecManager Package Update Script
# Updates the package list from repositories

# Set content type for JSON response
echo "Content-type: application/json"
echo ""

# Run opkg update
UPDATE_OUTPUT=$(opkg update 2>&1)
UPDATE_EXIT_CODE=$?

if [ $UPDATE_EXIT_CODE -eq 0 ]; then
    cat << EOF
{
    "status": "success",
    "message": "Package list updated successfully",
    "timestamp": "$(date -Iseconds)"
}
EOF
else
    cat << EOF
{
    "status": "error",
    "message": "Failed to update package list",
    "error": "$UPDATE_OUTPUT",
    "timestamp": "$(date -Iseconds)"
}
EOF
fi
