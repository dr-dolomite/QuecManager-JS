#!/bin/sh
# Location: /www/cgi-bin/quecmanager/home/speedtest/speedtest_status.sh

# Configuration
STATUS_FILE="/tmp/speedtest_status.json"
FINAL_RESULT="/tmp/speedtest_final.json"
PID_FILE="/tmp/speedtest.pid"

# Set headers
echo "Content-Type: application/json"
echo "Cache-Control: no-cache, no-store, must-revalidate"
echo "Pragma: no-cache"
echo "Expires: 0"
echo ""

# Function to return file content if it's a valid result
return_if_result() {
    local file="$1"
    if [ -f "$file" ] && [ -r "$file" ] && [ -s "$file" ]; then
        if grep -q '"type":"result"' "$file" 2>/dev/null; then
            cat "$file"
            return 0
        fi
    fi
    return 1
}

# Function to check if process is running
is_process_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Priority 1: Check FINAL_RESULT file first
if return_if_result "$FINAL_RESULT"; then
    exit 0
fi

# Priority 2: Check STATUS_FILE for completed result
if return_if_result "$STATUS_FILE"; then
    # Copy to final result for future requests
    cp "$STATUS_FILE" "$FINAL_RESULT" 2>/dev/null
    chmod 644 "$FINAL_RESULT" 2>/dev/null
    exit 0
fi

# Priority 3: If process is running, return current status
if is_process_running; then
    if [ -f "$STATUS_FILE" ] && [ -r "$STATUS_FILE" ] && [ -s "$STATUS_FILE" ]; then
        cat "$STATUS_FILE"
    else
        echo '{"status":"running","message":"Test in progress...","timestamp":'$(date +%s)'}'
    fi
    exit 0
fi

# Priority 4: Check for error status
if [ -f "$STATUS_FILE" ] && [ -r "$STATUS_FILE" ] && [ -s "$STATUS_FILE" ]; then
    if grep -q '"status":"error"' "$STATUS_FILE" 2>/dev/null; then
        cat "$STATUS_FILE"
        exit 0
    fi
fi

# Default: No test running
echo '{"status":"not_running","timestamp":'$(date +%s)'}'