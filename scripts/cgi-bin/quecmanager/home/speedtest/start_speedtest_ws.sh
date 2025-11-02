#!/bin/sh
# Start Speedtest via WebSocket Daemon
# Location: /www/cgi-bin/quecmanager/home/speedtest/start_speedtest_ws.sh

PID_FILE="/tmp/quecmanager/speedtest_daemon.pid"
DAEMON_SCRIPT="/www/cgi-bin/services/speedtest_daemon.sh"

# Set content type header
echo "Content-Type: application/json"
echo ""

# Check if speedtest is already running
if [ -f "$PID_FILE" ]; then
    old_pid=$(cat "$PID_FILE" 2>/dev/null)
    if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
        echo '{"status":"error","message":"Speedtest is already running","pid":'$old_pid'}'
        exit 0
    else
        # Stale PID file, remove it
        rm -f "$PID_FILE" 2>/dev/null || true
    fi
fi

# Check if daemon script exists
if [ ! -f "$DAEMON_SCRIPT" ]; then
    echo '{"status":"error","message":"Speedtest daemon script not found"}'
    exit 0
fi

# Check if speedtest CLI is available
if ! command -v speedtest >/dev/null 2>&1; then
    echo '{"status":"error","message":"speedtest CLI not installed"}'
    exit 0
fi

# Start the speedtest daemon in background
# Redirect all output to prevent CGI response pollution
/bin/sh "$DAEMON_SCRIPT" >/dev/null 2>&1 &

# Give it a moment to start
sleep 0.5

# Verify it started
if [ -f "$PID_FILE" ]; then
    new_pid=$(cat "$PID_FILE" 2>/dev/null)
    echo '{"status":"started","message":"Speedtest started successfully","pid":'$new_pid'}'
    exit 0
else
    echo '{"status":"error","message":"Failed to start speedtest daemon"}'
    exit 0
fi
