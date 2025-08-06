#!/bin/sh

# Keep-Alive Scheduling Script
# This script allows scheduling of keep-alive requests to prevent the connection from being closed.
# It supports setting a time interval during which the keep-alive requests will be made.
# It uses a worker script to perform the actual keep-alive requests by downloading a test file.

# Configuration
CONFIG_FILE="/etc/keep_alive_schedule.conf"
STATUS_FILE="/tmp/keep_alive_status"
KEEP_ALIVE_SCRIPT="/www/cgi-bin/quecmanager/experimental/keep_alive_worker.sh"
TEST_URL="https://ash-speed.hetzner.com/100MB.bin"
TEMP_FILE="/tmp/keep_alive_test.bin"

# Function to convert HH:MM to minutes since midnight
time_to_minutes() {
    echo "$1" | awk -F: '{print $1 * 60 + $2}'
}

# Function to validate time interval
validate_interval() {
    START_TIME=$1
    END_TIME=$2
    INTERVAL_MINUTES=$3

    # Convert times to minutes
    START_MINUTES=$(time_to_minutes "$START_TIME")
    END_MINUTES=$(time_to_minutes "$END_TIME")

    # Calculate duration between start and end time
    if [ $END_MINUTES -lt $START_MINUTES ]; then
        # Handle case where end time is on the next day
        DURATION=$((1440 - START_MINUTES + END_MINUTES))
    else
        DURATION=$((END_MINUTES - START_MINUTES))
    fi

    # Check if interval is longer than duration
    if [ $INTERVAL_MINUTES -gt $DURATION ]; then
        return 1
    fi
    return 0
}

# Function to create the keep-alive worker script
create_worker_script() {
    cat > "$KEEP_ALIVE_SCRIPT" << 'EOF'
#!/bin/sh

TEST_URL="https://ash-speed.hetzner.com/100MB.bin"
TEMP_FILE="/tmp/keep_alive_test.bin"

# Function to perform keep-alive test
perform_keep_alive() {
    # Download the test file in background
    wget -q -O "$TEMP_FILE" "$TEST_URL" &
    WGET_PID=$!
    
    # Wait for download to complete or timeout after 30 seconds
    COUNTER=0
    while [ $COUNTER -lt 30 ]; do
        if ! kill -0 $WGET_PID 2>/dev/null; then
            break
        fi
        sleep 1
        COUNTER=$((COUNTER + 1))
    done
    
    # If download is still running, kill it
    if kill -0 $WGET_PID 2>/dev/null; then
        kill $WGET_PID 2>/dev/null
    fi
    
    # Wait 3 seconds then delete the file
    sleep 3
    #rm -f "$TEMP_FILE"
    
    # Log the activity
    echo "$(date): Keep-alive test performed" >> /tmp/keep_alive.log
}

# Execute the keep-alive test
perform_keep_alive
EOF
    chmod +x "$KEEP_ALIVE_SCRIPT"
}

# Function to generate cron time expression
generate_cron_time() {
    START_TIME=$1
    END_TIME=$2
    INTERVAL=$3

    START_HOUR=$(echo "$START_TIME" | cut -d: -f1 | sed 's/^0//')
    START_MIN=$(echo "$START_TIME" | cut -d: -f2)
    END_HOUR=$(echo "$END_TIME" | cut -d: -f1 | sed 's/^0//')
    END_MIN=$(echo "$END_TIME" | cut -d: -f2)

    # If end time is less than start time, it means we cross midnight
    if [ $(time_to_minutes "$END_TIME") -lt $(time_to_minutes "$START_TIME") ]; then
        # Create two cron entries for before and after midnight
        echo "*/$INTERVAL $START_HOUR-23 * * * $KEEP_ALIVE_SCRIPT"
        echo "*/$INTERVAL 0-$((END_HOUR - 1)) * * * $KEEP_ALIVE_SCRIPT"
    else
        echo "*/$INTERVAL $START_HOUR-$((END_HOUR - 1)) * * * $KEEP_ALIVE_SCRIPT"
    fi
}

# Function to urldecode
urldecode() {
    echo -e "$(echo "$1" | sed 's/+/ /g;s/%\([0-9A-F][0-9A-F]\)/\\x\1/g')"
}

# Function to save configuration
save_config() {
    echo "START_TIME=$1" >"$CONFIG_FILE"
    echo "END_TIME=$2" >>"$CONFIG_FILE"
    echo "INTERVAL=$3" >>"$CONFIG_FILE"
    echo "ENABLED=1" >>"$CONFIG_FILE"
}

# Function to disable scheduling
disable_scheduling() {
    if [ -f "$CONFIG_FILE" ]; then
        sed -i 's/ENABLED=1/ENABLED=0/' "$CONFIG_FILE"
    fi
    # Remove any existing cron jobs
    crontab -l | grep -v "$KEEP_ALIVE_SCRIPT" | crontab -
    # Clean up temporary files
    rm -f "$TEMP_FILE"
    rm -f "$KEEP_ALIVE_SCRIPT"
}

# Function to get current status
get_status() {
    if [ -f "$CONFIG_FILE" ]; then
        ENABLED=$(grep "ENABLED=" "$CONFIG_FILE" | cut -d'=' -f2)
        START_TIME=$(grep "START_TIME=" "$CONFIG_FILE" | cut -d'=' -f2)
        END_TIME=$(grep "END_TIME=" "$CONFIG_FILE" | cut -d'=' -f2)
        INTERVAL=$(grep "INTERVAL=" "$CONFIG_FILE" | cut -d'=' -f2)

        # Check if log file exists and get last activity
        LAST_ACTIVITY=""
        if [ -f "/tmp/keep_alive.log" ]; then
            LAST_ACTIVITY=$(tail -n 1 /tmp/keep_alive.log | cut -d: -f1-3)
        fi

        echo "Status: 200 OK"
        echo "Content-Type: application/json"
        echo ""
        echo "{\"enabled\":$ENABLED,\"start_time\":\"$START_TIME\",\"end_time\":\"$END_TIME\",\"interval\":$INTERVAL,\"last_activity\":\"$LAST_ACTIVITY\"}"
    else
        echo "Status: 200 OK"
        echo "Content-Type: application/json"
        echo ""
        echo "{\"enabled\":0,\"start_time\":\"\",\"end_time\":\"\",\"interval\":0,\"last_activity\":\"\"}"
    fi
}

# Handle POST requests
if [ "$REQUEST_METHOD" = "POST" ]; then
    # Read POST data
    read -r POST_DATA

    # Check if disabling is requested
    echo "$POST_DATA" | grep -q "disable=true"
    if [ $? -eq 0 ]; then
        disable_scheduling
        echo "Status: 200 OK"
        echo "Content-Type: application/json"
        echo ""
        echo "{\"status\":\"success\",\"message\":\"Keep-alive scheduling disabled\"}"
        exit 0
    fi

    # Extract times and interval
    START_TIME=$(echo "$POST_DATA" | grep -o 'start_time=[^&]*' | cut -d'=' -f2)
    END_TIME=$(echo "$POST_DATA" | grep -o 'end_time=[^&]*' | cut -d'=' -f2)
    INTERVAL=$(echo "$POST_DATA" | grep -o 'interval=[^&]*' | cut -d'=' -f2)

    # Decode times
    START_TIME=$(urldecode "$START_TIME")
    END_TIME=$(urldecode "$END_TIME")
    INTERVAL=$(urldecode "$INTERVAL")

    # Validate times
    if [ -z "$START_TIME" ] || [ -z "$END_TIME" ] || [ -z "$INTERVAL" ]; then
        echo "Status: 400 Bad Request"
        echo "Content-Type: application/json"
        echo ""
        echo "{\"error\":\"Missing start time, end time, or interval\"}"
        exit 1
    fi

    # Validate interval is a number
    if ! echo "$INTERVAL" | grep -q '^[0-9]\+$'; then
        echo "Status: 400 Bad Request"
        echo "Content-Type: application/json"
        echo ""
        echo "{\"error\":\"Interval must be a number in minutes\"}"
        exit 1
    fi

    # Validate interval (minimum 5 minutes to avoid too frequent requests)
    if [ "$INTERVAL" -lt 5 ]; then
        echo "Status: 400 Bad Request"
        echo "Content-Type: application/json"
        echo ""
        echo "{\"error\":\"Interval must be at least 5 minutes\"}"
        exit 1
    fi

    # Validate interval
    if ! validate_interval "$START_TIME" "$END_TIME" "$INTERVAL"; then
        echo "Status: 400 Bad Request"
        echo "Content-Type: application/json"
        echo ""
        echo "{\"error\":\"Interval is longer than the time between start and end time\"}"
        exit 1
    fi

    # Create the worker script
    create_worker_script

    # Create temporary file for new crontab
    TEMP_CRON=$(mktemp)

    # Get existing crontab entries (excluding our script)
    crontab -l 2>/dev/null | grep -v "$KEEP_ALIVE_SCRIPT" >"$TEMP_CRON"

    # Generate and add cron entries
    generate_cron_time "$START_TIME" "$END_TIME" "$INTERVAL" >>"$TEMP_CRON"

    # Install new crontab
    crontab "$TEMP_CRON"
    rm "$TEMP_CRON"

    # Save configuration
    save_config "$START_TIME" "$END_TIME" "$INTERVAL"

    # Initialize log file
    echo "$(date): Keep-alive scheduling enabled" > /tmp/keep_alive.log

    echo "Status: 200 OK"
    echo "Content-Type: application/json"
    echo ""
    echo "{\"status\":\"success\",\"message\":\"Keep-alive scheduling enabled with download method\"}"
    exit 0
fi

# Parse query string for GET requests
if [ "$REQUEST_METHOD" = "GET" ]; then
    QUERY_STRING=$(echo "$QUERY_STRING" | sed 's/&/\n/g')
    for param in $QUERY_STRING; do
        case "$param" in
        status=*)
            get_status
            exit 0
            ;;
        esac
    done
fi

# If no valid request is made
echo "Status: 400 Bad Request"
echo "Content-Type: application/json"
echo ""
echo "{\"error\":\"Invalid request\"}"
exit 1