#!/bin/sh

# Improved websocat server for bandwidth monitoring with error handling
# This script provides a more robust websocat server setup

LOG_FILE="/tmp/websocat-$(date +%Y%m%d-%H%M%S).log"
PID_FILE="/tmp/websocat.pid"
PORT=8838
BIND_ADDRESS="0.0.0.0"

echo "Starting robust websocat bandwidth monitoring server..."
echo "Log file: $LOG_FILE"
echo "PID file: $PID_FILE"

# Function to cleanup on exit
cleanup() {
    echo "Cleaning up websocat server..."
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        kill "$pid" 2>/dev/null
        rm -f "$PID_FILE"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Check if websocat is available
if ! command -v websocat &> /dev/null; then
    echo "Error: websocat not found. Please install it:"
    echo "  - Ubuntu/Debian: sudo apt install websocat"
    echo "  - Manual: https://github.com/vi/websocat/releases"
    exit 1
fi

# Kill any existing websocat processes on this port
echo "Checking for existing websocat processes on port $PORT..."
existing_pid=$(lsof -ti:$PORT)
if [ -n "$existing_pid" ]; then
    echo "Killing existing process $existing_pid on port $PORT"
    kill -9 "$existing_pid" 2>/dev/null
    sleep 2
fi

# Increase system limits for better connection handling
echo "Configuring system limits..."
ulimit -n 4096  # Increase file descriptor limit
ulimit -u 2048  # Increase process limit

# Option 1: Basic broadcast server (most stable)
echo "Starting websocat server - Basic broadcast mode..."
websocat -E -t \
    --max-messages-rev 1000 \
    --max-messages 1000 \
    --ping-interval 10 \
    --ping-timeout 30 \
    ws-l:$BIND_ADDRESS:$PORT \
    broadcast:mirror: \
    2>&1 | tee "$LOG_FILE" &

WEBSOCAT_PID=$!
echo $WEBSOCAT_PID > "$PID_FILE"
echo "websocat server started with PID: $WEBSOCAT_PID"

# Wait for server to start
sleep 2

# Test if server is running
if ! kill -0 "$WEBSOCAT_PID" 2>/dev/null; then
    echo "Error: websocat server failed to start"
    cat "$LOG_FILE"
    exit 1
fi

echo "✓ websocat server is running on ws://$BIND_ADDRESS:$PORT"
echo "✓ Broadcasting enabled - messages sent to one client are mirrored to all"
echo "✓ Ping/pong enabled with 30s interval"
echo "✓ Connection limits: 1000 messages per direction"

# Monitor the server
echo ""
echo "Monitoring server (Ctrl+C to stop)..."
while kill -0 "$WEBSOCAT_PID" 2>/dev/null; do
    # Show connection count every 30 seconds
    conn_count=$(netstat -an 2>/dev/null | grep ":$PORT.*ESTABLISHED" | wc -l)
    echo "[$(date '+%H:%M:%S')] Active connections: $conn_count"
    
    # Check log for errors
    if tail -n 5 "$LOG_FILE" | grep -i "error\|fail" > /dev/null; then
        echo "⚠️  Recent errors detected in log:"
        tail -n 3 "$LOG_FILE" | grep -i "error\|fail"
    fi
    
    sleep 30
done

echo "websocat server stopped"
cleanup