#!/bin/sh

# Bandwidth Monitor Script for WebSocket
# Sends bandwidth data to websocat ws://localhost:8838

# Configuration
WEBSOCKET_URL="ws://localhost:8838"
INTERFACE="eth0"  # Change to your network interface
INTERVAL=1        # Send data every second
LOG_FILE="/tmp/bandwidth_monitor.log"

# Initialize previous values for speed calculation
PREV_RX=0
PREV_TX=0
PREV_TIME=0

# Function to log messages
log_message() {
    echo "$(date): $1" >> "$LOG_FILE"
}

# Function to get network interface statistics
get_network_stats() {
    local interface=$1

    # Try different paths for network statistics
    if [ -f "/sys/class/net/$interface/statistics/rx_bytes" ]; then
        RX_BYTES=$(cat /sys/class/net/$interface/statistics/rx_bytes)
        TX_BYTES=$(cat /sys/class/net/$interface/statistics/tx_bytes)
    elif [ -f "/proc/net/dev" ]; then
        # Parse /proc/net/dev as fallback
        local stats=$(grep "$interface" /proc/net/dev | tr ':' ' ')
        RX_BYTES=$(echo $stats | awk '{print $2}')
        TX_BYTES=$(echo $stats | awk '{print $10}')
    else
        # Use dummy data if no stats available
        RX_BYTES=$(($(date +%s) * 1024 + RANDOM))
        TX_BYTES=$(($(date +%s) * 512 + RANDOM))
        log_message "WARNING: Using dummy data - no network stats found"
    fi

    # Ensure we have valid numbers
    RX_BYTES=${RX_BYTES:-0}
    TX_BYTES=${TX_BYTES:-0}
}

# Function to calculate speeds
calculate_speeds() {
    local current_time=$(date +%s)
    local time_diff=$((current_time - PREV_TIME))

    if [ $time_diff -gt 0 ] && [ $PREV_TIME -ne 0 ]; then
        local rx_diff=$((RX_BYTES - PREV_RX))
        local tx_diff=$((TX_BYTES - PREV_TX))

        DOWNLOAD_SPEED=$((rx_diff / time_diff))
        UPLOAD_SPEED=$((tx_diff / time_diff))
    else
        DOWNLOAD_SPEED=0
        UPLOAD_SPEED=0
    fi

    # Store current values for next iteration
    PREV_RX=$RX_BYTES
    PREV_TX=$TX_BYTES
    PREV_TIME=$current_time
}

# Function to create JSON message
create_json_message() {
    local timestamp=$(date -Iseconds)
    echo "{\"type\":\"bandwidth\",\"data\":{\"timestamp\":\"$timestamp\",\"downloadSpeed\":$DOWNLOAD_SPEED,\"uploadSpeed\":$UPLOAD_SPEED,\"totalDownload\":$RX_BYTES,\"totalUpload\":$TX_BYTES}}"
}

# Function to send status message
send_status() {
    local message=$1
    local timestamp=$(date -Iseconds)

    echo "{\"type\": \"status\", \"data\": \"$message\"}" | websocat --one-message "$WEBSOCKET_URL" 2>/dev/null
    log_message "Status: $message"
}

# Function to send error message
send_error() {
    local error=$1
    local timestamp=$(date -Iseconds)

    echo "{\"type\": \"error\", \"data\": \"$error\"}" | websocat --one-message "$WEBSOCKET_URL" 2>/dev/null
    log_message "Error: $error"
}

# Function to check if websocat is available
check_websocat() {
    if ! command -v websocat >/dev/null 2>&1; then
        echo "Error: websocat not found. Please install websocat."
        echo "Install with: cargo install websocat"
        exit 1
    fi
}

# Function to test WebSocket connection
test_connection() {
    echo '{"type": "status", "data": "Testing connection"}' | websocat --one-message "$WEBSOCKET_URL" 2>/dev/null
    if [ $? -eq 0 ]; then
        log_message "WebSocket connection test successful"
        return 0
    else
        log_message "WebSocket connection test failed"
        return 1
    fi
}

# Signal handlers for graceful shutdown
cleanup() {
    send_status "Bandwidth monitor stopping"
    log_message "Bandwidth monitor stopped"
    exit 0
}

trap cleanup INT TERM

# Main function
main() {
    log_message "Starting bandwidth monitor for interface: $INTERFACE"
    log_message "WebSocket URL: $WEBSOCKET_URL"

    # Check prerequisites
    check_websocat

    # Test connection
    if ! test_connection; then
        send_error "Failed to connect to WebSocket server"
        exit 1
    fi

    # Send startup status
    send_status "Bandwidth monitor started on interface $INTERFACE"

    # Initialize first measurement
    get_network_stats "$INTERFACE"
    PREV_RX=$RX_BYTES
    PREV_TX=$TX_BYTES
    PREV_TIME=$(date +%s)

    # Main monitoring loop
    while true; do
        # Get current network statistics
        get_network_stats "$INTERFACE"

        # Calculate speeds
        calculate_speeds

        # Create and send JSON message
        JSON_MESSAGE=$(create_json_message)

        # Send to WebSocket
        echo "$JSON_MESSAGE" | websocat --one-message "$WEBSOCKET_URL" 2>/dev/null

        if [ $? -ne 0 ]; then
            log_message "Failed to send data to WebSocket"
            # Try to reconnect after a brief pause
            sleep 5
            continue
        fi

        # Wait for next interval
        sleep $INTERVAL
    done
}

# Run main function
main "$@"