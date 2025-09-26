#!/bin/bash

# Test WebSocket connection using websocat
echo "Testing WebSocket connection to ws://192.168.224.1:8838/bandwidth-monitor"
echo "This will show WebSocket close codes and reasons..."
echo ""

# Install websocat if not available (uncomment if needed)
# curl -L https://github.com/vi/websocat/releases/latest/download/websocat-x86_64-pc-windows-msvc.exe -o websocat.exe

# Test connection with detailed output
websocat -v ws://192.168.224.1:8838/bandwidth-monitor 2>&1 | while read line; do
    echo "[$(date '+%H:%M:%S')] $line"
done