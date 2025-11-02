#!/bin/sh

# Connection Monitoring Daemon
# Monitors network connectivity and sends email alerts on disconnection/reconnection

# Load centralized logging
LOGGER_SCRIPT="/www/cgi-bin/services/quecmanager_logger.sh"
if [ -f "$LOGGER_SCRIPT" ]; then
    . "$LOGGER_SCRIPT"
    USE_CENTRALIZED_LOGGING=1
else
    USE_CENTRALIZED_LOGGING=0
fi

TMP_DIR="/tmp/quecmanager"
PID_FILE="$TMP_DIR/connection_monitor_daemon.pid"
DISCONNECT_LOG="$TMP_DIR/connection_disconnect.log"
PING_DATA="/tmp/quecmanager/ping_realtime.json"
RECIPIENT_FILE="/etc/quecmanager_alert_recipient"
PERSISTENT_STATE_FILE="/etc/quecmanager_connection_monitor_state"
SCRIPT_NAME="connection_monitor_daemon"

# State variables
FAIL_COUNT=0
IS_DISCONNECTED=false
DISCONNECT_TIME=""
THRESHOLD_REACHED=false
THRESHOLD_LOGGED=false

# Ensure directories exist
ensure_tmp_dir() { 
    [ -d "$TMP_DIR" ] || mkdir -p "$TMP_DIR" 2>/dev/null || true
}

log() { 
    local message="$1"
    local level="${2:-info}"
    
    # Use centralized logging if available
    if [ "$USE_CENTRALIZED_LOGGING" -eq 1 ]; then
        case "$level" in
            error)
                qm_log_error "service" "$SCRIPT_NAME" "$message"
                ;;
            warn)
                qm_log_warn "service" "$SCRIPT_NAME" "$message"
                ;;
            debug)
                qm_log_debug "service" "$SCRIPT_NAME" "$message"
                ;;
            *)
                qm_log_info "service" "$SCRIPT_NAME" "$message"
                ;;
        esac
    else
        # Fallback to logger
        logger -t "$SCRIPT_NAME" "[$level] $message"
    fi
}

# Check if daemon is already running
check_running() {
    if [ -f "$PID_FILE" ]; then
        local old_pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            log "Daemon already running with PID $old_pid" "warn"
            exit 1
        else
            rm -f "$PID_FILE"
        fi
    fi
}

# Check if ping data indicates success or failure
is_ping_ok() {
    if [ ! -f "$PING_DATA" ]; then
        echo "0"
        return
    fi
    
    # Read the last ping entry
    local last_entry=$(tail -n 1 "$PING_DATA" 2>/dev/null)
    
    if [ -z "$last_entry" ]; then
        echo "0"
        return
    fi
    
    # Check if ok:true or ok:1
    if echo "$last_entry" | grep -q '"ok":[[:space:]]*true\|"ok":[[:space:]]*1'; then
        echo "1"
    else
        echo "0"
    fi
}

# Mark network as disconnected
mark_disconnected() {
    if [ "$IS_DISCONNECTED" = "false" ]; then
        DISCONNECT_TIME=$(date '+%Y-%m-%d %H:%M:%S')
        echo "$DISCONNECT_TIME" > "$DISCONNECT_LOG"
        IS_DISCONNECTED=true
        THRESHOLD_REACHED=false
        THRESHOLD_LOGGED=false
        
        # Read threshold from UCI
        local THRESHOLD=$(uci get quecmanager.connection_monitor.threshold 2>/dev/null || echo "1")
        if ! echo "$THRESHOLD" | grep -qE '^[0-9]+$'; then
            THRESHOLD=1
        fi
        
        log "Network disconnected at $DISCONNECT_TIME - Threshold countdown started ($THRESHOLD minute(s))" "warn"
    fi
}

# Restore persistent state from QuecWatch reboot
restore_persistent_state() {
    if [ ! -f "$PERSISTENT_STATE_FILE" ]; then
        return 0
    fi
    
    log "Found persistent state file from QuecWatch reboot, restoring disconnect tracking" "info"
    
    # Source the state file
    . "$PERSISTENT_STATE_FILE"
    
    # Validate we have the required data
    if [ -z "$disconnect_time" ] || [ -z "$quecwatch_reboot" ]; then
        log "Invalid persistent state file, ignoring" "warn"
        rm -f "$PERSISTENT_STATE_FILE"
        return 0
    fi
    
    # Restore the disconnect state
    DISCONNECT_TIME="$disconnect_time"
    echo "$DISCONNECT_TIME" > "$DISCONNECT_LOG"
    IS_DISCONNECTED=true
    THRESHOLD_REACHED=false
    THRESHOLD_LOGGED=false
    
    log "Restored disconnect state: network was down since $DISCONNECT_TIME (QuecWatch rebooted at $reboot_time)" "info"
    
    # Check if threshold was already reached before reboot
    local THRESHOLD=$(uci get quecmanager.connection_monitor.threshold 2>/dev/null || echo "1")
    if ! echo "$THRESHOLD" | grep -qE '^[0-9]+$'; then
        THRESHOLD=1
    fi
    local DISCONNECT_EPOCH=$(date -d "$DISCONNECT_TIME" +%s 2>/dev/null || date +%s)
    local CURRENT_EPOCH=$(date +%s)
    local ELAPSED_SECONDS=$((CURRENT_EPOCH - DISCONNECT_EPOCH))
    local THRESHOLD_SECONDS=$((THRESHOLD * 60))
    
    if [ "$ELAPSED_SECONDS" -ge "$THRESHOLD_SECONDS" ]; then
        THRESHOLD_REACHED=true
        log "Threshold was already reached before reboot (elapsed: ${ELAPSED_SECONDS}s, threshold: ${THRESHOLD_SECONDS}s)" "info"
    fi
    
    # Remove the persistent state file
    rm -f "$PERSISTENT_STATE_FILE"
    
    return 0
}

# Check if threshold has been reached while disconnected
check_threshold_reached() {
    if [ "$IS_DISCONNECTED" = "false" ] || [ "$THRESHOLD_REACHED" = "true" ]; then
        return
    fi
    
    if [ ! -f "$DISCONNECT_LOG" ]; then
        return
    fi
    
    # Read threshold from UCI
    local THRESHOLD=$(uci get quecmanager.connection_monitor.threshold 2>/dev/null || echo "1")
    if ! echo "$THRESHOLD" | grep -qE '^[0-9]+$'; then
        THRESHOLD=1
    fi
    
    local DISCONNECT_EPOCH=$(date -d "$DISCONNECT_TIME" +%s 2>/dev/null || echo "0")
    local CURRENT_EPOCH=$(date +%s)
    local ELAPSED_SECONDS=$((CURRENT_EPOCH - DISCONNECT_EPOCH))
    local THRESHOLD_SECONDS=$((THRESHOLD * 60))
    
    if [ "$ELAPSED_SECONDS" -ge "$THRESHOLD_SECONDS" ]; then
        THRESHOLD_REACHED=true
        local DURATION_MIN=$((ELAPSED_SECONDS / 60))
        local DURATION_SEC=$((ELAPSED_SECONDS % 60))
        log "Threshold reached! Network has been down for ${DURATION_MIN}m ${DURATION_SEC}s (threshold: $THRESHOLD minute(s)). Waiting for reconnection to send email alert." "warn"
    fi
}

# Send email notification
send_email_alert() {
    # Check if recipient is configured
    if [ ! -f "$RECIPIENT_FILE" ]; then
        log "No recipient configured, skipping email notification" "warn"
        return
    fi
    
    local RECIPIENT=$(cat "$RECIPIENT_FILE")
    
    if [ -z "$RECIPIENT" ]; then
        log "Empty recipient, skipping email notification" "warn"
        return
    fi
    
    # Check if we have disconnect info
    if [ ! -f "$DISCONNECT_LOG" ]; then
        log "No disconnect log found, skipping notification" "warn"
        return
    fi
    
    # Read threshold from UCI (default to 1 minute if not set)
    local THRESHOLD=$(uci get quecmanager.connection_monitor.threshold 2>/dev/null || echo "1")
    # Validate threshold is a number
    if ! echo "$THRESHOLD" | grep -qE '^[0-9]+$'; then
        THRESHOLD=1
    fi
    
    DISCONNECT_TIME=$(cat "$DISCONNECT_LOG")
    local HOSTNAME=$(uci get system.@system[0].hostname 2>/dev/null || echo "OpenWRT-Router")
    local RECONNECT_TIME=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Calculate downtime duration
    local DISCONNECT_EPOCH=$(date -d "$DISCONNECT_TIME" +%s 2>/dev/null || echo "0")
    local RECONNECT_EPOCH=$(date +%s)
    local DOWNTIME=$((RECONNECT_EPOCH - DISCONNECT_EPOCH))
    
    # Convert threshold from minutes to seconds
    local THRESHOLD_SECONDS=$((THRESHOLD * 60))
    
    # Check if downtime exceeds threshold
    if [ "$DOWNTIME" -lt "$THRESHOLD_SECONDS" ]; then
        local DURATION_MIN=$((DOWNTIME / 60))
        local DURATION_SEC=$((DOWNTIME % 60))
        log "Network reconnected but downtime (${DURATION_MIN}m ${DURATION_SEC}s) is less than threshold ($THRESHOLD minutes). Email not sent." "info"
        # Remove the disconnect log
        rm -f "$DISCONNECT_LOG"
        return
    fi
    
    log "Network reconnected after meeting threshold. Downtime: ${DOWNTIME}s (threshold: ${THRESHOLD_SECONDS}s). Sending email alert..." "info"
    
    if [ "$DOWNTIME" -gt 0 ]; then
        local DURATION_MIN=$((DOWNTIME / 60))
        local DURATION_SEC=$((DOWNTIME % 60))
        local DURATION_TEXT="${DURATION_MIN}m ${DURATION_SEC}s"
    else
        local DURATION_TEXT="Unknown"
    fi
    
    log "Sending email notification to $RECIPIENT (threshold: $THRESHOLD minutes)" "info"
    
    # Get sender email from msmtprc
    local SENDER_EMAIL=$(grep "^from" /etc/msmtprc 2>/dev/null | awk '{print $2}')
    if [ -z "$SENDER_EMAIL" ]; then
        SENDER_EMAIL="quecmanager@monitor.local"
    fi
    
# Send beautifully formatted HTML email
cat <<EOF | msmtp "$RECIPIENT" 2>&1
Subject: =?UTF-8?Q?=F0=9F=93=A2?= Network Status Alert
From: Quecmanager Monitor <$SENDER_EMAIL>
To: $RECIPIENT
Content-Type: text/html; charset=UTF-8
MIME-Version: 1.0

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connection Alert</title>
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
                        <td align="center" style="padding: 30px 20px; border-bottom: 1px solid #eee; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: #ffffff; border-top-left-radius: 8px; border-top-right-radius: 8px;">
                            <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600;">Connection Restored &#127881;</h1>
                            <p style="margin: 0; font-size: 14px; opacity: 0.9;">$HOSTNAME</p>
                        </td>
                    </tr>
                    
                    <!-- Content Body -->
                    <tr>
                        <td style="padding: 35px 40px;">
                            <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 25px 0;">
                                Your device <strong>$HOSTNAME</strong> has successfully reconnected to the network. The service disruption has been resolved and normal operations have resumed.
                            </p>
                            
                            <!-- Timeline Section -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #004a99; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">
                                            &#128337; Incident Timeline
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Disconnect Info Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 15px; border-left: 4px solid #dc3545; background-color: #fff5f5; border-radius: 4px;">
                                <tr>
                                    <td style="padding: 18px 20px;">
                                        <p style="margin: 0; font-size: 15px; color: #721c24;">
                                            <strong style="font-size: 16px;">&#128308; Connection Lost</strong><br>
                                            <span style="font-size: 18px; font-weight: 600; display: inline-block; margin-top: 8px;">$DISCONNECT_TIME</span>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Reconnect Info Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 15px; border-left: 4px solid #28a745; background-color: #f0f9ff; border-radius: 4px;">
                                <tr>
                                    <td style="padding: 18px 20px;">
                                        <p style="margin: 0; font-size: 15px; color: #155724;">
                                            <strong style="font-size: 16px;">&#128994; Connection Restored</strong><br>
                                            <span style="font-size: 18px; font-weight: 600; display: inline-block; margin-top: 8px;">$RECONNECT_TIME</span>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Downtime Summary Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 20px; border: 2px solid #ffc107; border-radius: 8px; background: linear-gradient(to bottom, #fffbf0 0%, #fff9e6 100%);">
                                <tr>
                                    <td style="padding: 25px; text-align: center;">
                                        <p style="margin: 0 0 8px 0; font-size: 14px; color: #856404; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                                            Total Downtime
                                        </p>
                                        <p style="margin: 0; font-size: 32px; font-weight: 700; color: #ff6b00;">
                                            $DURATION_TEXT
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Additional Info -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 30px; background-color: #f8f9fa; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #6c757d; line-height: 1.6;">
                                            <strong style="color: #495057;">&#9432; Note:</strong> This notification was triggered because the downtime exceeded your configured threshold of <strong>$THRESHOLD minute(s)</strong>.
                                        </p>
                                        <p style="margin: 0; font-size: 14px; color: #6c757d; line-height: 1.6;">
                                            If you continue to experience connectivity issues, please check your network configuration or contact your service provider.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 25px 40px; border-top: 1px solid #eee; background-color: #f9f9f9; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                            <p style="font-size: 13px; color: #6c757d; margin: 0 0 5px 0; font-weight: 500;">
                                Quecmanager Connection Monitor
                            </p>
                            <p style="font-size: 12px; color: #adb5bd; margin: 0;">
                                Generated: $(date '+%Y-%m-%d %H:%M:%S %Z')
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
    
    if [ $? -eq 0 ]; then
        log "Email notification sent successfully" "info"
        # Store notification details for UI display
        {
            echo "Disconnect Time: $DISCONNECT_TIME"
            echo "Reconnect Time: $RECONNECT_TIME"
            echo "Downtime: $DURATION_TEXT"
            echo "Recipient: $RECIPIENT"
            echo "Sent At: $(date '+%Y-%m-%d %H:%M:%S')"
        } > "$TMP_DIR/last_notification.log"
        # Remove the disconnect log
        rm -f "$DISCONNECT_LOG"
    else
        log "Failed to send email notification" "error"
    fi
}

# Main monitoring loop
main() {
    ensure_tmp_dir
    check_running
    
    # Write PID file
    echo $$ > "$PID_FILE"
    
    log "Connection monitoring daemon started (PID: $$)"
    
    # Check for persistent state from QuecWatch reboot
    restore_persistent_state
    
    # Check if ping daemon is running
    if [ ! -f "$PING_DATA" ]; then
        log "Ping data file not found. Waiting for ping daemon..." "warn"
    fi
    
    # Main loop - check every 10 seconds
    while true; do
        ping_ok=$(is_ping_ok)
        
        if [ "$ping_ok" = "1" ]; then
            # Ping is successful
            if [ "$IS_DISCONNECTED" = "true" ]; then
                # Network came back up
                log "Network reconnected, checking if email alert should be sent" "info"
                send_email_alert
                IS_DISCONNECTED=false
                THRESHOLD_REACHED=false
                THRESHOLD_LOGGED=false
                FAIL_COUNT=0
            else
                # Network is stable
                FAIL_COUNT=0
            fi
        else
            # Ping failed
            if [ "$IS_DISCONNECTED" = "false" ]; then
                FAIL_COUNT=$((FAIL_COUNT + 1))
                log "Ping failure $FAIL_COUNT/5" "debug"
                
                if [ "$FAIL_COUNT" -ge 5 ]; then
                    # Reached 5 failures, mark as disconnected
                    log "5 consecutive ping failures - marking as disconnected" "warn"
                    mark_disconnected
                    FAIL_COUNT=0
                fi
            else
                # Already disconnected, check if threshold reached
                check_threshold_reached
            fi
        fi

        # Sleep for 10 seconds
        sleep 10
    done
}

# Cleanup on exit
cleanup() {
    log "Connection monitoring daemon stopping"
    rm -f "$PID_FILE"
    exit 0
}

# Trap signals
trap cleanup INT TERM EXIT

# Run daemon
main