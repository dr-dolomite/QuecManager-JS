#!/bin/sh

# Alert System Update Script
# Updates existing email configuration without sending test email

echo -n ""
echo "Content-type: application/json"
echo ""

# Source centralized logging
. "/www/cgi-bin/services/quecmanager_logger.sh"

LOG_CATEGORY="service"
SCRIPT_NAME="alerts_update"

# Read POST data
CONTENT_LENGTH="${CONTENT_LENGTH:-0}"
if [ "$CONTENT_LENGTH" -eq 0 ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "No POST data received"
    printf '{"status":"error","message":"No configuration data received"}\n'
    exit 1
fi

POST_DATA=$(dd bs=1 count=$CONTENT_LENGTH 2>/dev/null)

if [ -z "$POST_DATA" ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Empty POST data"
    printf '{"status":"error","message":"Empty configuration data"}\n'
    exit 1
fi

# Function to extract JSON values
get_json_value() {
    local key=$1
    local json=$2
    echo "$json" | grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed "s/\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\"/\1/"
}

# Extract values from JSON
EMAIL=$(get_json_value "email" "$POST_DATA")
APP_PASSWORD=$(get_json_value "app_password" "$POST_DATA")
RECIPIENT=$(get_json_value "recipient" "$POST_DATA")
THRESHOLD=$(echo "$POST_DATA" | grep -o '"threshold"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"threshold"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')

# Validate required fields
if [ -z "$EMAIL" ] || [ -z "$APP_PASSWORD" ] || [ -z "$RECIPIENT" ] || [ -z "$THRESHOLD" ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Missing required fields"
    printf '{"status":"error","message":"Missing required configuration fields"}\n'
    exit 1
fi

qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Updating email configuration for $EMAIL"

# Create msmtprc configuration
cat > /etc/msmtprc << EOF
defaults
auth           on
tls            on
tls_starttls   on
tls_trust_file /etc/ssl/certs/ca-certificates.crt

account        gmail
host           smtp.gmail.com
port           587
from           $EMAIL
user           $EMAIL
password       $APP_PASSWORD

account default : gmail
EOF

if [ $? -ne 0 ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to create msmtprc file"
    printf '{"status":"error","message":"Failed to create email configuration file"}\n'
    exit 1
fi

# Set proper permissions
chmod 600 /etc/msmtprc 2>/dev/null

# Save recipient
echo "$RECIPIENT" > /etc/quecmanager_alert_recipient
chmod 600 /etc/quecmanager_alert_recipient 2>/dev/null

# Handle UCI lock file if it exists
if [ -f /var/lock/uci ]; then
    rm -f /var/lock/uci
fi

# Update threshold in UCI
# Check if section exists before deleting
if uci -q get quecmanager.connection_monitor >/dev/null 2>&1; then
    uci delete quecmanager.connection_monitor 2>/dev/null
fi

uci set quecmanager.connection_monitor=connection_monitor 2>/dev/null
uci set quecmanager.connection_monitor.threshold="$THRESHOLD" 2>/dev/null

uci commit quecmanager 2>/dev/null

if [ $? -ne 0 ]; then
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to update UCI configuration"
    printf '{"status":"error","message":"Failed to update system configuration"}\n'
    exit 1
fi

qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Configuration updated successfully"
printf '{"status":"success","message":"Configuration updated successfully","email":"%s","recipient":"%s","threshold":%s}\n' "$EMAIL" "$RECIPIENT" "$THRESHOLD"
