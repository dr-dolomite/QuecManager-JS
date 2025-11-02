#!/bin/sh

# Websocat server daemon for bandwidth monitoring
# This script starts websocat as a daemon for procd init system
# Designed for OpenWrt with BusyBox compatibility

LOG_FILE="/tmp/websocat-$(date +%Y%m%d-%H%M%S).log"
PID_FILE="/tmp/websocat.pid"
PORT=8838
BIND_ADDRESS="0.0.0.0"

echo "Starting websocat bandwidth monitoring server daemon..."
echo "Log file: $LOG_FILE"
echo "PID file: $PID_FILE"

# Function to cleanup on exit
cleanup() {
    echo "Cleaning up websocat server..."
    if [ -f "$PID_FILE" ]; then
        pid=$(cat "$PID_FILE")
        kill "$pid" 2>/dev/null
        rm -f "$PID_FILE"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Check if websocat is available
if ! command -v websocat >/dev/null 2>&1; then
    echo "Error: websocat not found. Please install it."
    exit 1
fi

# Kill any existing websocat processes on this port
echo "Checking for existing websocat processes on port $PORT..."
# OpenWrt compatible process detection
existing_pid=$(netstat -tunlp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | head -n1)
if [ -n "$existing_pid" ] && [ "$existing_pid" != "-" ]; then
    echo "Killing existing process $existing_pid on port $PORT"
    kill -9 "$existing_pid" 2>/dev/null
    sleep 2
fi

# Increase system limits for better connection handling (if supported)
echo "Configuring system limits..."
ulimit -n 4096 2>/dev/null || true  # Increase file descriptor limit
ulimit -u 2048 2>/dev/null || true  # Increase process limit

# Write our PID (shell's PID, websocat will replace it via exec)
echo "$$" > "$PID_FILE"

echo "Starting websocat server - Basic broadcast mode..."
echo "? Binding to ws://$BIND_ADDRESS:$PORT"
echo "? Broadcasting enabled - messages sent to one client are mirrored to all"
echo "? Ping/pong enabled with 30s timeout"
echo "? Connection limits: 1000 messages per direction"

# Start websocat server using exec to replace the shell process
# This prevents the script from blocking and allows procd to manage it properly
exec websocat -E -t \
    --max-messages-rev 1000 \
    --max-messages 1000 \
    --ping-interval 10 \
    --ping-timeout 30 \
    ws-l:$BIND_ADDRESS:$PORT \
    broadcast:mirror: \
    2>&1 | tee "$LOG_FILE"
