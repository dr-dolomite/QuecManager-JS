#!/bin/sh

# Alert System Enable/Start Script
# Enables monitoring in UCI and starts the daemon

echo "Content-type: application/json"
echo ""

# Source centralized logging
. "/www/cgi-bin/services/quecmanager_logger.sh"

LOG_CATEGORY="service"
SCRIPT_NAME="alerts_enable"

# Enable monitoring in UCI
uci set quecmanager.connection_monitor.enabled=1
uci commit quecmanager

if [ $? -ne 0 ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to enable monitoring in UCI"
    echo '{"status":"error","message":"Failed to enable monitoring configuration"}'
    exit 1
fi

qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Monitoring enabled in UCI"

# Enable the service (makes it start at boot)
/etc/init.d/quecmanager_connection_monitor enable 2>&1

# Start the service and capture output
START_OUTPUT=$(/etc/init.d/quecmanager_connection_monitor start 2>&1)
START_RESULT=$?

if [ $START_RESULT -eq 0 ]; then
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Monitoring service started successfully"
    echo '{"status":"success","message":"Connection monitoring enabled and started successfully"}'
else
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to start monitoring service (exit code: $START_RESULT). Output: $START_OUTPUT"
    # Return warning, not error, so the config is saved but user knows to check
    echo "{\"status\":\"warning\",\"message\":\"Monitoring enabled. Service start returned code $START_RESULT. You may need to start it manually: /etc/init.d/quecmanager_connection_monitor start\"}"
fi
