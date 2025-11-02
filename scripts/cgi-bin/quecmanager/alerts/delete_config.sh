#!/bin/sh
# Delete Email Alert Configuration
# Location: /www/cgi-bin/quecmanager/alerts/delete_config.sh

MSMTPRC="/etc/msmtprc"
RECIPIENT_FILE="/etc/quecmanager_alert_recipient"

echo "Content-Type: application/json"
echo ""

# Check if config files exist
if [ ! -f "$MSMTPRC" ] && [ ! -f "$RECIPIENT_FILE" ]; then
    echo '{"status":"error","message":"No configuration found to delete"}'
    exit 0
fi

# Empty the msmtprc file (preserve file for future configs)
if [ -f "$MSMTPRC" ]; then
    > "$MSMTPRC"
    if [ $? -ne 0 ]; then
        echo '{"status":"error","message":"Failed to empty msmtprc file"}'
        exit 0
    fi
fi

# Delete the recipient file
if [ -f "$RECIPIENT_FILE" ]; then
    rm -f "$RECIPIENT_FILE"
    if [ $? -ne 0 ]; then
        echo '{"status":"error","message":"Failed to delete recipient file"}'
        exit 0
    fi
fi

# Stop and disable the monitoring service
/etc/init.d/quecmanager_alerts stop 2>/dev/null
/etc/init.d/quecmanager_alerts disable 2>/dev/null

echo '{"status":"success","message":"Email alert configuration deleted successfully"}'
exit 0
