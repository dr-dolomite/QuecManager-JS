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
# if [ -f "$CONFIG_FILE" ]; then
#     qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backing up existing configuration"
#     cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%s)"
# fi

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
uci set quecmanager.connection_monitor.threshold="$THRESHOLD" 2>/dev/null
uci commit quecmanager 2>/dev/null

qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Configuration created successfully with threshold: $THRESHOLD minutes"

# Send test email to verify configuration
qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Sending test email to verify configuration"

HOSTNAME=$(uci get system.@system[0].hostname 2>/dev/null || echo "OpenWRT-Router")
CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S %Z')

# Send test email
cat <<EOF | msmtp "$RECIPIENT" 2>&1
Subject: =?UTF-8?Q?=E2=9C=85?= Quecmanager Alert System Configuration Successful
From: Quecmanager Monitor <$EMAIL>
To: $RECIPIENT
Content-Type: text/html; charset=UTF-8
MIME-Version: 1.0

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuration Success</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
    <!-- Main email container table -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <!-- Content table -->
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #ddd;">
                    
                    <!-- Header -->
                    <tr>
                        <td align="center" style="padding: 30px 20px; border-bottom: 1px solid #eee; background-color: #5cb85c; color: #ffffff; border-top-left-radius: 8px; border-top-right-radius: 8px;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">&#127881; Configuration Successful</h1>
                        </td>
                    </tr>
                    
                    <!-- Content Body -->
                    <tr>
                        <td style="padding: 35px 40px;">
                            <p style="font-size: 16px; color: #333; line-height: 1.6;">
                                Congratulations! Your email alert system has been successfully configured on <strong>$HOSTNAME</strong> and is now ready to monitor your network connection.
                            </p>
                            
                            <!-- Info Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 25px; border: 1px solid #ddd; border-radius: 8px; background-color: #fafafa;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <p style="margin: 0 0 18px 0; font-size: 18px; font-weight: 600; color: #5cb85c;">Configuration Details</p>
                                        
                                        <p style="font-size: 16px; color: #333; margin: 14px 0; line-height: 1.5;">
                                            <strong style="color: #555; min-width: 140px; display: inline-block;">&#128241; Device:</strong>
                                            <strong>$HOSTNAME</strong>
                                        </p>
                                        
                                        <p style="font-size: 16px; color: #333; margin: 14px 0; line-height: 1.5;">
                                            <strong style="color: #555; min-width: 140px; display: inline-block;">&#128231; Sender Email:</strong>
                                            <strong>$EMAIL</strong>
                                        </p>
                                        
                                        <p style="font-size: 16px; color: #333; margin: 14px 0; line-height: 1.5;">
                                            <strong style="color: #555; min-width: 140px; display: inline-block;">&#128236; Recipient:</strong>
                                            <strong>$RECIPIENT</strong>
                                        </p>
                                        
                                        <p style="font-size: 16px; color: #333; margin: 14px 0; line-height: 1.5;">
                                            <strong style="color: #555; min-width: 140px; display: inline-block;">&#8986; Alert Threshold:</strong>
                                            <strong>$THRESHOLD minute(s)</strong>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Alert Information -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 25px; border-left: 4px solid #5cb85c; background-color: #f0f9ff; border-radius: 4px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="font-size: 14px; color: #333; margin: 0; line-height: 1.6;">
                                            <strong>&#9432; What happens next?</strong><br>
                                            You will receive an email notification when your network connection is restored after a disconnection that lasts longer than <strong>$THRESHOLD minute(s)</strong>.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 25px 40px; border-top: 1px solid #eee; background-color: #f9f9f9; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                            <p style="font-size: 12px; color: #888; margin: 0;">
                                Generated by Quecmanager Connection Monitor
                                <br>
                                $CURRENT_TIME
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
EOF
EMAIL_STATUS=$?

if [ $EMAIL_STATUS -eq 0 ]; then
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Test email sent successfully to $RECIPIENT"
    printf '{"status":"success","message":"Email configuration saved and test email sent successfully","email":"%s","recipient":"%s","threshold":%s,"test_email_sent":true}\n' "$EMAIL" "$RECIPIENT" "$THRESHOLD"
else
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to send test email"
    printf '{"status":"success","message":"Email configuration saved but test email failed to send. Please check your credentials.","email":"%s","recipient":"%s","threshold":%s,"test_email_sent":false}\n' "$EMAIL" "$RECIPIENT" "$THRESHOLD"
fi

exit 0