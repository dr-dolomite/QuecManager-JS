#!/bin/sh

# Alert System Enable/Start Script
# Enables monitoring and starts the daemon

echo -n ""
echo "Content-type: application/json"
echo ""

# Source centralized logging
. "/www/cgi-bin/services/quecmanager_logger.sh"

LOG_CATEGORY="service"
SCRIPT_NAME="alerts_enable"

qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Enabling connection monitoring"

# Enable the service (makes it start at boot)
/etc/init.d/quecmanager_connection_monitor enable >/dev/null 2>&1
ENABLE_RESULT=$?

if [ $ENABLE_RESULT -ne 0 ]; then
    qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to enable monitoring service for boot (exit code: $ENABLE_RESULT)"
fi

# Start the service and capture output
START_OUTPUT=$(/etc/init.d/quecmanager_connection_monitor start 2>&1)
START_RESULT=$?

# Set UCI state to enabled
uci set quecmanager.connection_monitor.enabled='1' >/dev/null 2>&1
uci commit quecmanager >/dev/null 2>&1
UCI_RESULT=$?

if [ $UCI_RESULT -ne 0 ]; then
    qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to update UCI state (exit code: $UCI_RESULT)"
else
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "UCI state updated: enabled=1"
fi

if [ $START_RESULT -eq 0 ]; then
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Monitoring service enabled for boot and started successfully"
    printf '{"status":"success","message":"Connection monitoring enabled and will start on reboot"}\n'
else
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to start monitoring service (exit code: $START_RESULT). Output: $START_OUTPUT"
    # Return warning, not error, so the config is saved but user knows to check
    printf '{"status":"warning","message":"Monitoring enabled for boot. Service start returned code %s. You may need to start it manually: /etc/init.d/quecmanager_connection_monitor start"}\n' "$START_RESULT"
fi
