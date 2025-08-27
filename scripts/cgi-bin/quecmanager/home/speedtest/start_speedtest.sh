#!/bin/sh
# Location: /www/cgi-bin/quecmanager/home/speedtest/start_speedtest.sh

# Configuration
STATUS_FILE="/tmp/speedtest_status.json"
FINAL_RESULT="/tmp/speedtest_final.json"
PID_FILE="/tmp/speedtest.pid"
LOG_FILE="/tmp/speedtest.log"
TIMEOUT=300  # 5 minutes timeout

# Set content type header
echo "Content-Type: application/json"
echo ""

# Function to cleanup on exit
cleanup() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$PID" ]; then
            kill "$PID" 2>/dev/null
            wait "$PID" 2>/dev/null
        fi
        rm -f "$PID_FILE"
    fi
    rm -f "$STATUS_FILE"
}

# Check if speedtest is already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE" 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo '{"status":"error","message":"Speedtest already running"}'
        exit 1
    fi
    # Clean up stale PID file
    rm -f "$PID_FILE"
fi

# Remove any existing files
rm -f "$STATUS_FILE" "$FINAL_RESULT" "$LOG_FILE"

# Check if speedtest binary exists
if ! command -v speedtest >/dev/null 2>&1; then
    echo '{"status":"error","message":"Speedtest binary not found"}'
    exit 1
fi

# Create directories if they don't exist
mkdir -p /tmp/home 2>/dev/null

# Initialize status file
echo '{"status":"starting","timestamp":'$(date +%s)'}' > "$STATUS_FILE"
chmod 644 "$STATUS_FILE"

# Start speedtest in background with proper error handling
(
    # Set environment
    export HOME=/tmp/home
    export PATH="/usr/bin:/bin:/usr/sbin:/sbin"
    
    # Log start time
    echo "Starting speedtest at $(date)" > "$LOG_FILE"
    
    # Run speedtest with timeout and error handling
    timeout "$TIMEOUT" speedtest --accept-license --accept-gdpr --format=json --progress=yes --progress-update-interval=500ms 2>>"$LOG_FILE" | \
    while IFS= read -r line; do
        # Validate JSON before writing
        if echo "$line" | grep -q '^{.*}$'; then
            # Write the line as-is (speedtest already includes timestamp)
            echo "$line" > "$STATUS_FILE"
            
            # Check if this is the final result
            if echo "$line" | grep -q '"type":"result"'; then
                echo "$line" > "$FINAL_RESULT"
                chmod 644 "$FINAL_RESULT"
                echo "Speedtest completed at $(date)" >> "$LOG_FILE"
                echo "Final result written to $FINAL_RESULT" >> "$LOG_FILE"
                break
            fi
        else
            # Log non-JSON output
            echo "Non-JSON output: $line" >> "$LOG_FILE"
        fi
    done
    
    # Check if we have a result after the loop
    if [ ! -f "$FINAL_RESULT" ] && [ -f "$STATUS_FILE" ]; then
        # Check if the last status was actually a result
        if grep -q '"type":"result"' "$STATUS_FILE" 2>/dev/null; then
            cp "$STATUS_FILE" "$FINAL_RESULT"
            chmod 644 "$FINAL_RESULT"
            echo "Copied result from status file to final result" >> "$LOG_FILE"
        fi
    fi
    
    # Handle timeout or error cases
    if [ $? -ne 0 ]; then
        ERROR_MSG="Speedtest failed or timed out"
        echo "Error: $ERROR_MSG at $(date)" >> "$LOG_FILE"
        echo "{\"status\":\"error\",\"message\":\"$ERROR_MSG\",\"timestamp\":$(date +%s)}" > "$STATUS_FILE"
    fi
    
    # Keep PID file for a moment to let status script detect completion
    sleep 2
    
    # Cleanup PID file
    rm -f "$PID_FILE"
    
) &

# Save the background process PID
echo $! > "$PID_FILE"

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Return immediate success response
echo '{"status":"started","timestamp":'$(date +%s)'}'