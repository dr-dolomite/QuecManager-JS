#!/bin/sh
# Stop Running Speedtest
# Location: /www/cgi-bin/quecmanager/home/speedtest/stop_speedtest_ws.sh

PID_FILE="/tmp/quecmanager/speedtest_daemon.pid"

# Set content type header
echo "Content-Type: application/json"
echo ""

# Check if speedtest is running
if [ ! -f "$PID_FILE" ]; then
    echo '{"status":"success","message":"No speedtest is currently running"}'
    exit 0
fi

# Get PID
pid=$(cat "$PID_FILE" 2>/dev/null)

if [ -z "$pid" ]; then
    # Invalid PID file
    rm -f "$PID_FILE" 2>/dev/null || true
    echo '{"status":"success","message":"Invalid PID file, cleaned up"}'
    exit 0
fi

# Check if process is actually running
if ! kill -0 "$pid" 2>/dev/null; then
    # Process not running, remove stale PID file
    rm -f "$PID_FILE" 2>/dev/null || true
    echo '{"status":"success","message":"Speedtest was not running, cleaned up stale PID file"}'
    exit 0
fi

# Send SIGTERM to gracefully stop the daemon
kill -TERM "$pid" 2>/dev/null

# Wait a moment for graceful shutdown
sleep 1

# Check if it's still running
if kill -0 "$pid" 2>/dev/null; then
    # Force kill if still running
    kill -9 "$pid" 2>/dev/null
    sleep 0.5
fi

# Clean up PID file
rm -f "$PID_FILE" 2>/dev/null || true

echo '{"status":"success","message":"Speedtest stopped successfully","pid":'$pid'}'
