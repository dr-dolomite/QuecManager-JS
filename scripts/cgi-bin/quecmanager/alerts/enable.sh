#!/bin/sh

# Alert System Enable/Start Script
# Enables monitoring in UCI and starts the daemon

echo -n ""
echo "Content-type: application/json"
echo ""

# Source centralized logging
. "/www/cgi-bin/services/quecmanager_logger.sh"

LOG_CATEGORY="service"
SCRIPT_NAME="alerts_enable"

# Enable monitoring in UCI
uci set quecmanager.connection_monitor.enabled=1 2>/dev/null
uci commit quecmanager 2>/dev/null

if [ $? -ne 0 ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to enable monitoring in UCI"
    printf '{"status":"error","message":"Failed to enable monitoring configuration"}\n'
    exit 1
fi

qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Monitoring enabled in UCI"

# Enable the service (makes it start at boot)
/etc/init.d/quecmanager_connection_monitor enable >/dev/null 2>&1
ENABLE_RESULT=$?

if [ $ENABLE_RESULT -ne 0 ]; then
    qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to enable monitoring service for boot (exit code: $ENABLE_RESULT)"
fi

# Start the service and capture output
START_OUTPUT=$(/etc/init.d/quecmanager_connection_monitor start 2>&1)
START_RESULT=$?

if [ $START_RESULT -eq 0 ]; then
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Monitoring service enabled for boot and started successfully"
    printf '{"status":"success","message":"Connection monitoring enabled and will start on reboot"}\n'
else
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to start monitoring service (exit code: $START_RESULT). Output: $START_OUTPUT"
    # Return warning, not error, so the config is saved but user knows to check
    printf '{"status":"warning","message":"Monitoring enabled for boot. Service start returned code %s. You may need to start it manually: /etc/init.d/quecmanager_connection_monitor start"}\n' "$START_RESULT"
fi
