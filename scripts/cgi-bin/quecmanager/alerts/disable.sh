#!/bin/sh

# Alert System Disable/Stop Script
# Disables monitoring in UCI and stops the daemon

echo "Content-type: application/json"
echo ""

# Source centralized logging
. "/www/cgi-bin/services/quecmanager_logger.sh"

LOG_CATEGORY="service"
SCRIPT_NAME="alerts_disable"

# Stop the service first
/etc/init.d/quecmanager_connection_monitor stop 2>&1
STOP_RESULT=$?

if [ $STOP_RESULT -ne 0 ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to stop monitoring service (exit code: $STOP_RESULT)"
fi

# Disable monitoring in UCI
uci set quecmanager.connection_monitor.enabled=0
uci commit quecmanager

if [ $? -ne 0 ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to disable monitoring in UCI"
    echo '{"status":"error","message":"Failed to disable monitoring configuration"}'
    exit 1
fi

qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Monitoring disabled in UCI and service stopped"
echo '{"status":"success","message":"Connection monitoring disabled successfully"}'
