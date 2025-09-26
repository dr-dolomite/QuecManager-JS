#!/bin/sh

# Simple bandwidth data sender
# Usage: ./send_bandwidth_data.sh [download_speed] [upload_speed]

DOWNLOAD_SPEED=${1:-1048576}  # Default 1MB/s
UPLOAD_SPEED=${2:-262144}     # Default 256KB/s
WEBSOCKET_URL="ws://localhost:8838"

# Create JSON message matching your TypeScript interface
JSON_DATA=$(cat << EOF
{
  "type": "bandwidth",
  "data": {
    "timestamp": "$(date -Iseconds)",
    "downloadSpeed": $DOWNLOAD_SPEED,
    "uploadSpeed": $UPLOAD_SPEED,
    "totalDownload": 0,
    "totalUpload": 0
  }
}
EOF
)

# Send to WebSocket
echo "$JSON_DATA" | websocat --one-message "$WEBSOCKET_URL"

if [ $? -eq 0 ]; then
    echo "Successfully sent bandwidth data"
else
    echo "Failed to send data to WebSocket"
    exit 1
fi