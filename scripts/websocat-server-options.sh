#!/bin/bash

# Alternative websocat server configurations for maximum stability
PORT=8838
BIND_ADDRESS="0.0.0.0"

echo "websocat Server Options for Bandwidth Monitoring"
echo "================================================"

# Check websocat version
websocat --version 2>/dev/null || { echo "websocat not found!"; exit 1; }

echo ""
echo "Choose server configuration:"
echo ""
echo "1) MINIMAL - Most stable, basic broadcast"
echo "2) BUFFERED - With connection limits and buffers" 
echo "3) ROBUST - Full monitoring with recovery"
echo "4) DEBUG - Verbose logging for troubleshooting"
echo ""

read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo "Starting MINIMAL websocat server..."
        exec websocat -t ws-l:$BIND_ADDRESS:$PORT broadcast:mirror:
        ;;
    
    2) 
        echo "Starting BUFFERED websocat server..."
        exec websocat -t \
            --max-messages 500 \
            --max-messages-rev 500 \
            --buffer-size 65536 \
            ws-l:$BIND_ADDRESS:$PORT \
            broadcast:mirror: \
            2>/tmp/websocat-buffered.log
        ;;
    
    3)
        echo "Starting ROBUST websocat server with monitoring..."
        
        # Set system limits
        ulimit -n 2048
        
        # Start with full monitoring
        websocat -v -t \
            --max-messages 1000 \
            --max-messages-rev 1000 \
            --ping-interval 30 \
            --ping-timeout 15 \
            --buffer-size 32768 \
            ws-l:$BIND_ADDRESS:$PORT \
            broadcast:mirror: \
            2>&1 | while IFS= read -r line; do
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] $line"
                # Log errors to separate file
                if echo "$line" | grep -qi "error\|fail\|disconnect"; then
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $line" >> /tmp/websocat-errors.log
                fi
            done
        ;;
    
    4)
        echo "Starting DEBUG websocat server..."
        echo "All traffic will be logged to /tmp/websocat-debug.log"
        
        exec websocat -vv -t \
            --text-prefix "[TEXT] " \
            --binary-prefix "[BIN] " \
            ws-l:$BIND_ADDRESS:$PORT \
            log:/tmp/websocat-debug.log:broadcast:mirror: \
            2>&1 | tee /tmp/websocat-console.log
        ;;
    
    *)
        echo "Invalid choice. Starting MINIMAL configuration..."
        exec websocat -t ws-l:$BIND_ADDRESS:$PORT broadcast:mirror:
        ;;
esac