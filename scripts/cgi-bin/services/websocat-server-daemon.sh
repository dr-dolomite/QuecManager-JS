#!/bin/sh

# Websocat server daemon for bandwidth monitoring
# This script starts websocat as a daemon for procd init system
# Designed for OpenWrt with BusyBox compatibility

# Load centralized logging
LOGGER_SCRIPT="/www/cgi-bin/services/quecmanager_logger.sh"
if [ -f "$LOGGER_SCRIPT" ]; then
    . "$LOGGER_SCRIPT"
    USE_CENTRALIZED_LOGGING=1
else
    USE_CENTRALIZED_LOGGING=0
fi

SCRIPT_NAME="websocat_server"
LOG_CATEGORY="service"

# Legacy log file (for websocat stderr/stdout)
LOG_FILE="/tmp/websocat-$(date +%Y%m%d-%H%M%S).log"
PID_FILE="/tmp/websocat.pid"
PORT=8838
BIND_ADDRESS="0.0.0.0"

# Log helper function
log() {
    if [ "$USE_CENTRALIZED_LOGGING" = "1" ]; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "$1"
    else
        echo "$1"
    fi
}

log "Starting websocat bandwidth monitoring server daemon..."
log "Log file: $LOG_FILE"
log "PID file: $PID_FILE"

# Function to cleanup on exit
cleanup() {
    log "Cleaning up websocat server..."
    if [ -f "$PID_FILE" ]; then
        pid=$(cat "$PID_FILE")
        kill "$pid" 2>/dev/null
        rm -f "$PID_FILE"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Check if UCI configuration exists for bridge_monitor, if not create it
log "Checking UCI configuration..."
if ! uci get quecmanager.bridge_monitor >/dev/null 2>&1; then
    if [ "$USE_CENTRALIZED_LOGGING" = "1" ]; then
        qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "UCI configuration not found. Running setup script..."
    else
        echo "UCI configuration not found. Running setup script..."
    fi
    
    # Run the setup script
    SETUP_SCRIPT="/www/cgi-bin/quecmanager/bandwidth-monitoring/setup_uci_config.sh"
    if [ -f "$SETUP_SCRIPT" ]; then
        /bin/sh "$SETUP_SCRIPT"
        
        # Restart quecmanager_services to apply configuration
        log "Restarting quecmanager_services to apply UCI configuration..."
        /etc/init.d/quecmanager_services restart
        
        # Exit this instance since the service is being restarted
        exit 0
    else
        if [ "$USE_CENTRALIZED_LOGGING" = "1" ]; then
            qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Setup script not found at $SETUP_SCRIPT"
            qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Continuing without UCI configuration..."
        else
            echo "Warning: Setup script not found at $SETUP_SCRIPT"
            echo "Continuing without UCI configuration..."
        fi
    fi
else
    log "UCI configuration found. Proceeding..."
fi

# Check if websocat is available
if ! command -v websocat >/dev/null 2>&1; then
    if [ "$USE_CENTRALIZED_LOGGING" = "1" ]; then
        qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "websocat not found. Please install it."
    else
        echo "Error: websocat not found. Please install it."
    fi
    exit 1
fi

# Kill any existing websocat processes on this port
log "Checking for existing websocat processes on port $PORT..."
# OpenWrt compatible process detection
existing_pid=$(netstat -tunlp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | head -n1)
if [ -n "$existing_pid" ] && [ "$existing_pid" != "-" ]; then
    log "Killing existing process $existing_pid on port $PORT"
    kill -9 "$existing_pid" 2>/dev/null
    sleep 2
fi

# Increase system limits for better connection handling (if supported)
log "Configuring system limits..."
ulimit -n 4096 2>/dev/null || true  # Increase file descriptor limit
ulimit -u 2048 2>/dev/null || true  # Increase process limit

# Write our PID (shell's PID, websocat will replace it via exec)
echo "$$" > "$PID_FILE"

# Default to wss with self-signed certificate
WS_PROTOCOL="wss"
WS_CERT_PATH="/root/output.pkcs12"
WS_CERT_PASSWORD="password"

log "Starting websocat server - Basic broadcast mode..."
log "Protocol: $WS_PROTOCOL"
log "Binding to ${WS_PROTOCOL}://$BIND_ADDRESS:$PORT"
log "Broadcasting enabled - messages sent to one client are mirrored to all"
log "Ping/pong enabled with 30s timeout"
log "Connection limits: 1000 messages per direction"
log "Using secure WebSocket (wss) with certificate: $WS_CERT_PATH"

# Start websocat server with wss and self-signed certificate
exec websocat -E -k -t \
    --pkcs12-der="$WS_CERT_PATH" \
    --pkcs12-passwd "$WS_CERT_PASSWORD" \
    --max-messages-rev 1000 \
    --max-messages 1000 \
    --ping-interval 10 \
    --ping-timeout 30 \
    wss-l:$BIND_ADDRESS:$PORT \
    broadcast:mirror: \
    2>&1 | tee "$LOG_FILE"