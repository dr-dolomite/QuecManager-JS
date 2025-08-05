#!/bin/sh

DEBUG_LOG="/tmp/socat-at-bridge-reset.log"

echo "Content-Type: application/json"
echo "Cache-Control: no-cache, no-store, must-revalidate"
echo "Pragma: no-cache"
echo "Expires: 0"
echo ""



service socat-at-bridge restart &>/dev/null
SOCAT_RESET_STATUS=$?

touch $DEBUG_LOG
# Log the reset status
if [ $SOCAT_RESET_STATUS -eq 0 ]; then
    echo "$(date) - socat-at-bridge service restarted successfully." >> $DEBUG_LOG
else
    echo "$(date) - Failed to restart socat-at-bridge service. Status: $SOCAT_RESET_STATUS" >> $DEBUG_LOG
fi

# Basic response indicating the server is up
echo "{\"status\": \"$SOCAT_RESET_STATUS\"}"