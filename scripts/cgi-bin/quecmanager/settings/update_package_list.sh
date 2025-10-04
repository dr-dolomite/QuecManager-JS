#!/bin/sh

# QuecManager Package Update Script
# Updates the package list from repositories

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

# Set content type for JSON response
echo "Content-type: application/json"
echo ""

SCRIPT_NAME="update_package_list"

# Log script start
qm_log_info "settings" "$SCRIPT_NAME" "Update package list script started"
qm_log_debug "settings" "$SCRIPT_NAME" "Running: opkg update"

# Run opkg update
UPDATE_OUTPUT=$(opkg update 2>&1)
UPDATE_EXIT_CODE=$?

qm_log_debug "settings" "$SCRIPT_NAME" "Update exit code: $UPDATE_EXIT_CODE"
qm_log_debug "settings" "$SCRIPT_NAME" "Update output: $UPDATE_OUTPUT"

if [ $UPDATE_EXIT_CODE -eq 0 ]; then
    qm_log_info "settings" "$SCRIPT_NAME" "Package list updated successfully"
    cat << EOF
{
    "status": "success",
    "message": "Package list updated successfully",
    "timestamp": "$(date -Iseconds)",
    "output": "$UPDATE_OUTPUT"
}
EOF
else
    qm_log_error "settings" "$SCRIPT_NAME" "Failed to update package list: $UPDATE_OUTPUT"
    cat << EOF
{
    "status": "error",
    "message": "Failed to update package list",
    "exit_code": $UPDATE_EXIT_CODE,
    "error": "$UPDATE_OUTPUT",
    "timestamp": "$(date -Iseconds)"
}
EOF
fi

qm_log_info "settings" "$SCRIPT_NAME" "Update package list script completed"
