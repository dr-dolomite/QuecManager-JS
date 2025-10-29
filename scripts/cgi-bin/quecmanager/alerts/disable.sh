#!/bin/sh

# Alert System Disable/Stop Script
# Disables monitoring and stops the daemon

echo -n ""
echo "Content-type: application/json"
echo ""

# Source centralized logging
. "/www/cgi-bin/services/quecmanager_logger.sh"

LOG_CATEGORY="service"
SCRIPT_NAME="alerts_disable"

# Stop the service first
/etc/init.d/quecmanager_connection_monitor stop >/dev/null 2>&1
STOP_RESULT=$?

if [ $STOP_RESULT -ne 0 ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to stop monitoring service (exit code: $STOP_RESULT)"
fi

# Disable the service (prevents it from starting at boot)
/etc/init.d/quecmanager_connection_monitor disable >/dev/null 2>&1
DISABLE_RESULT=$?

if [ $DISABLE_RESULT -ne 0 ]; then
    qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to disable monitoring service from boot (exit code: $DISABLE_RESULT)"
fi

qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Monitoring service stopped and disabled from boot"
printf '{"status":"success","message":"Connection monitoring disabled and will not start on reboot"}\n'
