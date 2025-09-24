#!/bin/sh
# WebSocket Real-time Speed Monitor
# This script monitors network interface speed and outputs JSON data via WebSocket

INTERFACE="rmnet_data0"  # Change to your interface
WEBSOCKET_PORT="8080"    # WebSocket port
WEBSOCKET_HOST="127.0.0.1"

# Function to check if interface exists
check_interface() {
    if [ ! -d "/sys/class/net/$INTERFACE" ]; then
        echo "{\"error\": \"Interface $INTERFACE not found\", \"timestamp\": $(date +%s)}"
        exit 1
    fi
}

# Function to get network stats
get_network_stats() {
    if [ -f "/sys/class/net/$INTERFACE/statistics/rx_bytes" ] && [ -f "/sys/class/net/$INTERFACE/statistics/tx_bytes" ]; then
        RX_BYTES=$(cat /sys/class/net/$INTERFACE/statistics/rx_bytes)
        TX_BYTES=$(cat /sys/class/net/$INTERFACE/statistics/tx_bytes)
        echo "$RX_BYTES,$TX_BYTES"
    else
        echo "0,0"
    fi
}

# Function to calculate and output speed data as JSON
monitor_speed() {
    local rx_bytes=$1
    local tx_bytes=$2
    local rx_bytes_new=$3
    local tx_bytes_new=$4
    local timestamp=$(date +%s)
    
    # Calculate rates in Kbps
    local rx_rate=$(( (rx_bytes_new - rx_bytes) * 8 / 1024 ))
    local tx_rate=$(( (tx_bytes_new - tx_bytes) * 8 / 1024 ))
    
    # Ensure non-negative values
    [ $rx_rate -lt 0 ] && rx_rate=0
    [ $tx_rate -lt 0 ] && tx_rate=0
    
    # Output JSON
    printf '{"download_kbps": %d, "upload_kbps": %d, "download_mbps": %.2f, "upload_mbps": %.2f, "interface": "%s", "timestamp": %d}\n' \
        $rx_rate $tx_rate \
        $(echo "scale=2; $rx_rate / 1024" | bc -l 2>/dev/null || echo "0") \
        $(echo "scale=2; $tx_rate / 1024" | bc -l 2>/dev/null || echo "0") \
        "$INTERFACE" $timestamp
}

# Function to start WebSocket server with websocat
start_websocket_server() {
    # Kill any existing websocat processes on this port
    pkill -f "websocat.*$WEBSOCKET_PORT" 2>/dev/null || true
    
    # Start the monitoring loop and pipe to websocat
    {
        check_interface
        
        # Get initial values
        STATS=$(get_network_stats)
        RX_BYTES=$(echo $STATS | cut -d',' -f1)
        TX_BYTES=$(echo $STATS | cut -d',' -f2)
        
        # Send initial status
        echo "{\"status\": \"connected\", \"interface\": \"$INTERFACE\", \"timestamp\": $(date +%s)}"
        
        while true; do
            sleep 1
            
            # Get new values
            STATS_NEW=$(get_network_stats)
            RX_BYTES_NEW=$(echo $STATS_NEW | cut -d',' -f1)
            TX_BYTES_NEW=$(echo $STATS_NEW | cut -d',' -f2)
            
            # Calculate and output speed
            monitor_speed $RX_BYTES $TX_BYTES $RX_BYTES_NEW $TX_BYTES_NEW
            
            # Update values for next iteration
            RX_BYTES=$RX_BYTES_NEW
            TX_BYTES=$TX_BYTES_NEW
        done
    } | websocat --binary -s $WEBSOCKET_HOST:$WEBSOCKET_PORT
}

# Function to stop WebSocket server
stop_websocket_server() {
    pkill -f "websocat.*$WEBSOCKET_PORT" 2>/dev/null
    echo "WebSocket speed monitor stopped"
}

# Function to get status
get_status() {
    if pgrep -f "websocat.*$WEBSOCKET_PORT" >/dev/null; then
        echo "{\"status\": \"running\", \"port\": $WEBSOCKET_PORT, \"interface\": \"$INTERFACE\"}"
    else
        echo "{\"status\": \"stopped\"}"
    fi
}

# Main script logic
case "${1:-start}" in
    "start")
        echo "Starting WebSocket speed monitor on port $WEBSOCKET_PORT..."
        start_websocket_server &
        echo $! > /tmp/speed_monitor.pid
        echo "Monitor started with PID $!"
        ;;
    "stop")
        stop_websocket_server
        rm -f /tmp/speed_monitor.pid
        ;;
    "status")
        get_status
        ;;
    "restart")
        stop_websocket_server
        sleep 2
        start_websocket_server &
        echo $! > /tmp/speed_monitor.pid
        echo "Monitor restarted with PID $!"
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        echo "Default action is 'start' if no argument provided"
        exit 1
        ;;
esac