#!/bin/bash

# websocat connection management and cleanup script
PORT=8838
TARGET_HOST="192.168.224.1"

echo "websocat Connection Manager"
echo "=========================="

show_connections() {
    echo ""
    echo "Active connections to $TARGET_HOST:$PORT:"
    netstat -an 2>/dev/null | grep "$TARGET_HOST:$PORT" | grep -v LISTEN || echo "No connections found"
    echo ""
    local count=$(netstat -an 2>/dev/null | grep "$TARGET_HOST:$PORT.*ESTABLISHED" | wc -l)
    echo "Total established connections: $count"
}

kill_connections() {
    echo ""
    echo "Killing all connections to $TARGET_HOST:$PORT..."
    
    # Find PIDs with connections to the target
    local pids=$(netstat -anp 2>/dev/null | grep "$TARGET_HOST:$PORT.*ESTABLISHED" | awk '{print $7}' | cut -d'/' -f1 | sort -u | grep -E '^[0-9]+$')
    
    if [ -z "$pids" ]; then
        echo "No processes found with connections to kill"
    else
        for pid in $pids; do
            if [ "$pid" != "0" ] && [ -n "$pid" ]; then
                echo "Killing process $pid"
                kill -9 "$pid" 2>/dev/null
            fi
        done
        sleep 2
        echo "Cleanup complete"
    fi
}

restart_websocat() {
    echo ""
    echo "Restarting websocat server..."
    
    # Kill existing websocat
    pkill -f "websocat.*:$PORT" 2>/dev/null
    sleep 2
    
    # Kill anything still on the port
    local port_pid=$(lsof -ti:$PORT 2>/dev/null)
    if [ -n "$port_pid" ]; then
        echo "Killing process $port_pid using port $PORT"
        kill -9 "$port_pid" 2>/dev/null
    fi
    
    sleep 2
    
    # Start new server
    echo "Starting new websocat server..."
    nohup websocat -t \
        --max-messages 500 \
        --ping-interval 30 \
        ws-l:0.0.0.0:$PORT \
        broadcast:mirror: \
        > /tmp/websocat-restart.log 2>&1 &
    
    local new_pid=$!
    sleep 2
    
    if kill -0 "$new_pid" 2>/dev/null; then
        echo "✓ websocat server restarted successfully (PID: $new_pid)"
        echo $new_pid > /tmp/websocat.pid
    else
        echo "✗ Failed to restart websocat server"
        echo "Check log: /tmp/websocat-restart.log"
    fi
}

monitor_server() {
    echo ""
    echo "Monitoring websocat server (Ctrl+C to stop)..."
    echo "Checking every 10 seconds for I/O errors and connection count"
    
    while true; do
        # Check if server is running
        if ! pgrep -f "websocat.*:$PORT" > /dev/null; then
            echo "[$(date '+%H:%M:%S')] ⚠️  websocat server not running!"
        fi
        
        # Count connections
        local conn_count=$(netstat -an 2>/dev/null | grep ":$PORT.*ESTABLISHED" | wc -l)
        
        # Check for recent I/O errors
        if [ -f "/tmp/websocat-restart.log" ]; then
            local errors=$(tail -n 20 /tmp/websocat-restart.log 2>/dev/null | grep -i "i/o failure\|error" | wc -l)
            if [ "$errors" -gt 0 ]; then
                echo "[$(date '+%H:%M:%S')] ⚠️  Detected $errors I/O errors, connections: $conn_count"
                if [ "$conn_count" -gt 20 ]; then
                    echo "[$(date '+%H:%M:%S')] 🔄 Too many connections, restarting server..."
                    restart_websocat
                fi
            else
                echo "[$(date '+%H:%M:%S')] ✓ Server healthy, connections: $conn_count"
            fi
        else
            echo "[$(date '+%H:%M:%S')] 📊 Connections: $conn_count"
        fi
        
        sleep 10
    done
}

# Main menu
echo ""
echo "1) Show connections"
echo "2) Kill all connections"  
echo "3) Restart websocat server"
echo "4) Monitor server"
echo "5) Exit"
echo ""

read -p "Choose option (1-5): " option

case $option in
    1) show_connections ;;
    2) kill_connections ;;
    3) restart_websocat ;;
    4) monitor_server ;;
    5) echo "Goodbye!"; exit 0 ;;
    *) echo "Invalid option" ;;
esac