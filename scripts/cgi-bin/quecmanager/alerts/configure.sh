#!/bin/sh

# Alert System Configuration Script
# Creates msmtprc configuration file with provided credentials

# Set content type to JSON
echo -n ""
echo "Content-type: application/json"
echo ""

# Source centralized logging
. "/www/cgi-bin/services/quecmanager_logger.sh"

LOG_CATEGORY="service"
SCRIPT_NAME="alerts_config"

CONFIG_FILE="/etc/msmtprc"

# Read POST data from stdin
if [ "$REQUEST_METHOD" = "POST" ]; then
    # Get content length
    CONTENT_LENGTH=$(echo "$CONTENT_LENGTH" | tr -cd '0-9')
    
    if [ -n "$CONTENT_LENGTH" ]; then
        # Read POST data using dd
        POST_DATA=$(dd bs=1 count=$CONTENT_LENGTH 2>/dev/null)
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Received POST data length: ${#POST_DATA}"
    else
        qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "No content length specified"
        printf '{"status":"error","message":"No content length specified"}\n'
        exit 1
    fi
else
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Invalid request method: $REQUEST_METHOD"
    printf '{"status":"error","message":"Invalid request method. POST required"}\n'
    exit 1
fi

# Parse JSON data (simple extraction for shell)
get_json_value() {
    echo "$POST_DATA" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed 's/.*:"\(.*\)"/\1/'
}

EMAIL=$(get_json_value "email")
APP_PASSWORD=$(get_json_value "app_password")
RECIPIENT=$(get_json_value "recipient")
THRESHOLD=$(get_json_value "threshold")

# Default threshold to 1 minute if not provided or invalid
if [ -z "$THRESHOLD" ] || ! echo "$THRESHOLD" | grep -qE '^[0-9]+$'; then
    THRESHOLD=1
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "No valid threshold provided, defaulting to 1 minute"
fi

# Validate inputs
if [ -z "$EMAIL" ] || [ -z "$APP_PASSWORD" ] || [ -z "$RECIPIENT" ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Missing required parameters"
    printf '{"status":"error","message":"Missing required parameters: email, app_password, and recipient are required"}\n'
    exit 1
fi

# Validate email format (basic check)
if ! echo "$EMAIL" | grep -qE '^[^@]+@[^@]+\.[^@]+$'; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Invalid email format: $EMAIL"
    printf '{"status":"error","message":"Invalid email format"}\n'
    exit 1
fi

if ! echo "$RECIPIENT" | grep -qE '^[^@]+@[^@]+\.[^@]+$'; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Invalid recipient email format: $RECIPIENT"
    printf '{"status":"error","message":"Invalid recipient email format"}\n'
    exit 1
fi

# Backup existing config if it exists
if [ -f "$CONFIG_FILE" ]; then
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backing up existing configuration"
    cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%s)"
fi

# Create msmtprc configuration
qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Creating msmtprc configuration for $EMAIL"

cat > "$CONFIG_FILE" << EOF
# Default settings
defaults
auth on
tls on
tls_trust_file /etc/ssl/certs/ca-certificates.crt
logfile /tmp/msmtp.log

# Gmail configuration
account gmail
host smtp.gmail.com
port 587
from $EMAIL
user $EMAIL
password $APP_PASSWORD

# Set default account
account default : gmail
EOF

# Set proper permissions
chmod 600 "$CONFIG_FILE"

if [ $? -ne 0 ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to set permissions on $CONFIG_FILE"
    printf '{"status":"error","message":"Failed to set configuration file permissions"}\n'
    exit 1
fi

# Store recipient email in a separate config file for the daemon
RECIPIENT_FILE="/etc/quecmanager_alert_recipient"
echo "$RECIPIENT" > "$RECIPIENT_FILE"
chmod 600 "$RECIPIENT_FILE"

# Store threshold in UCI configuration
# Check for UCI locks
if [ -f /var/lock/uci ]; then
    rm -f /var/lock/uci
fi

# Ensure quecmanager config exists
if ! uci -q show quecmanager >/dev/null 2>&1; then
    touch /etc/config/quecmanager
fi

# Check if section exists before deleting
if uci -q get quecmanager.connection_monitor >/dev/null 2>&1; then
    uci delete quecmanager.connection_monitor 2>/dev/null
fi

uci set quecmanager.connection_monitor=connection_monitor 2>/dev/null
uci set quecmanager.connection_monitor.enabled=0 2>/dev/null
uci set quecmanager.connection_monitor.threshold="$THRESHOLD" 2>/dev/null
uci commit quecmanager 2>/dev/null

qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Configuration created successfully with threshold: $THRESHOLD minutes"

# Send test email to verify configuration
qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Sending test email to verify configuration"

HOSTNAME=$(uci get system.@system[0].hostname 2>/dev/null || echo "OpenWRT-Router")
CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S %Z')

# Send test email
{
    echo "Subject: ✅ Quecmanager Alert System Configuration Successful"
    echo "From: Quecmanager Monitor <$EMAIL>"
    echo "To: $RECIPIENT"
    echo "Content-Type: text/plain; charset=UTF-8"
    echo ""
    echo "QUECMANAGER CONNECTION MONITORING"
    echo "================================================================"
    echo ""
    echo "🎉 Congratulations!"
    echo ""
    echo "Your email alert system has been successfully configured and is"
    echo "now ready to monitor your network connection."
    echo ""
    echo "📡 Device Information"
    echo "   Hostname: $HOSTNAME"
    echo ""
    echo "📧 Email Configuration"
    echo "   Sender: $EMAIL"
    echo "   Recipient: $RECIPIENT"
    echo ""
    echo "⏱️  Alert Threshold"
    echo "   $THRESHOLD minute(s)"
    echo ""
    echo "   You will receive an email notification when your network"
    echo "   connection is restored after a disconnection that lasts"
    echo "   longer than $THRESHOLD minute(s)."
    echo ""
    echo "================================================================"
    echo ""
    echo "This is an automated test message to confirm your email"
    echo "configuration is working correctly."
    echo ""
    echo "Generated: $CURRENT_TIME"
} | msmtp "$RECIPIENT" >/dev/null 2>&1
EMAIL_STATUS=$?

if [ $EMAIL_STATUS -eq 0 ]; then
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Test email sent successfully to $RECIPIENT"
    printf '{"status":"success","message":"Email configuration saved and test email sent successfully","email":"%s","recipient":"%s","threshold":%s,"test_email_sent":true}\n' "$EMAIL" "$RECIPIENT" "$THRESHOLD"
else
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to send test email"
    printf '{"status":"success","message":"Email configuration saved but test email failed to send. Please check your credentials.","email":"%s","recipient":"%s","threshold":%s,"test_email_sent":false}\n' "$EMAIL" "$RECIPIENT" "$THRESHOLD"
fi

exit 0