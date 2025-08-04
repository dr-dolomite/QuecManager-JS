#!/bin/sh

echo "Content-Type: application/json"
echo "Cache-Control: no-cache, no-store, must-revalidate"
echo "Pragma: no-cache"
echo "Expires: 0"
echo ""

service socat-at-bridge restart &>/dev/null
SOCAT_RESET_STATUS=$?

# Basic response indicating the server is up
echo "{\"status\": \"$SOCAT_RESET_STATUS\"}"