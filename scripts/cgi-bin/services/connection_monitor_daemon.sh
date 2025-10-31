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
        log "Network disconnected at $DISCONNECT_TIME" "warn"
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
        return 1
    fi
    
    # Restore the disconnect state
    DISCONNECT_TIME="$disconnect_time"
    echo "$DISCONNECT_TIME" > "$DISCONNECT_LOG"
    IS_DISCONNECTED=true
    
    log "Restored disconnect state: network was down since $DISCONNECT_TIME (QuecWatch rebooted at $reboot_time)" "info"
    
    # Remove the persistent state file
    rm -f "$PERSISTENT_STATE_FILE"
    
    return 0
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
        log "Downtime (${DURATION_MIN}m ${DURATION_SEC}s) is less than threshold ($THRESHOLD minutes), skipping email" "info"
        # Remove the disconnect log
        rm -f "$DISCONNECT_LOG"
        return
    fi
    
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
    # Use a single HEREDOC for headers and body, piping directly to msmtp
    # This is more robust for sh/ash than grouping { ... } commands
    cat <<EOF | msmtp "$RECIPIENT" 2>&1
Subject: =?UTF-8?Q?=F0=9F=9F=A2?= Connection Restored - $HOSTNAME
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
                        <td align="center" style="padding: 30px 20px; border-bottom: 1px solid #eee; background-color: #004a99; color: #ffffff; border-top-left-radius: 8px; border-top-right-radius: 8px;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">&#128226; Connection Restored</h1>
                        </td>
                    </tr>
                    
                    <!-- Content Body -->
                    <tr>
                        <td style="padding: 35px 40px;">
                            <p style="font-size: 16px; color: #333; line-height: 1.6;">
                                This is an automated alert to notify you that network connectivity on your device <strong>$HOSTNAME</strong> has been successfully restored.
                            </p>
                            
                            <!-- Info Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 25px; border: 1px solid #ddd; border-radius: 8px; background-color: #fafafa;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <p style="margin: 0 0 18px 0; font-size: 18px; font-weight: 600; color: #004a99;">Alert Details</p>
                                        
                                        <p style="font-size: 16px; color: #d9534f; margin: 14px 0; line-height: 1.5;">
                                            <strong style="color: #555; min-width: 140px; display: inline-block;">&#128308; Connection Lost:</strong>
                                            <strong>$DISCONNECT_TIME</strong>
                                        </p>
                                        
                                        <p style="font-size: 16px; color: #5cb85c; margin: 14px 0; line-height: 1.5;">
                                            <strong style="color: #555; min-width: 140px; display: inline-block;">&#128994; Connection Restored:</strong>
                                            <strong>$RECONNECT_TIME</strong>
                                        </p>
                                        
                                        <p style="font-size: 16px; color: #333; margin: 14px 0; line-height: 1.5;">
                                            <strong style="color: #555; min-width: 140px; display: inline-block;">&#8986; Total Downtime:</strong>
                                            <strong>$DURATION_TEXT</strong>
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
                                $(date '+%Y-%m-%d %H:%M:%S %Z')
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
                log "Network reconnected, sending notification" "info"
                send_email_alert
                IS_DISCONNECTED=false
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