#!/bin/sh

# Connection Monitoring Daemon
# Monitors network connectivity and sends email alerts on disconnection/reconnection

# Ensure PATH for OpenWrt/BusyBox
export PATH="/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

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
    
    # Send beautifully formatted email
    {
        echo "Subject: ⚠️ Quecmanager Connection Monitoring Alert"
        echo "From: Quecmanager Monitor <$SENDER_EMAIL>"
        echo "To: $RECIPIENT"
        echo "Content-Type: text/plain; charset=UTF-8"
        echo ""
        echo "QUECMANAGER CONNECTION MONITORING"
        echo "================================================================"
        echo ""
        echo "📡 Device Information"
        echo "   Hostname: $HOSTNAME"
        echo ""
        echo "🔴 Connection Lost"
        echo "   $DISCONNECT_TIME"
        echo ""
        echo "🟢 Connection Restored"
        echo "   $RECONNECT_TIME"
        echo ""
        echo "⏱️  Total Downtime"
        echo "   $DURATION_TEXT"
        echo ""
        echo "================================================================"
        echo ""
        echo "Network connectivity has been successfully restored."
        echo ""
        echo "Generated: $(date '+%Y-%m-%d %H:%M:%S %Z')"
    } | msmtp "$RECIPIENT" 2>&1
    
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
    
    # Check if ping daemon is running
    if [ ! -f "$PING_DATA" ]; then
        log "Ping data file not found. Waiting for ping daemon..." "warn"
    fi
    
    # Main loop - check every 30 seconds
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
        
        # Sleep for 30 seconds
        sleep 30
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
