#!/bin/sh
# Get Speedtest Status
# Location: /www/cgi-bin/quecmanager/home/speedtest/speedtest_status_ws.sh

PID_FILE="/tmp/quecmanager/speedtest_daemon.pid"

echo "Content-Type: application/json"
echo "Cache-Control: no-cache, no-store, must-revalidate"
echo "Pragma: no-cache"
echo "Expires: 0"
echo ""

# Check if speedtest is running
if [ ! -f "$PID_FILE" ]; then
    echo '{"status":"not_running","is_running":false}'
    exit 0
fi

# Get PID and check if process is actually running
pid=$(cat "$PID_FILE" 2>/dev/null)

if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    # Not running, clean up stale PID file
    rm -f "$PID_FILE" 2>/dev/null || true
    echo '{"status":"not_running","is_running":false}'
    exit 0
fi

# Speedtest is running
echo '{"status":"running","is_running":true,"pid":'$pid'}'
