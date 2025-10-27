#!/bin/sh

# Tailscale Toggle Script
# Enables or disables Tailscale connection

echo "Content-type: application/json"
echo ""

# Get the action parameter (up or down)
if [ "$REQUEST_METHOD" = "POST" ]; then
    read -r POST_DATA
    action=$(echo "$POST_DATA" | sed -n 's/.*"action"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
else
    action=$(echo "$QUERY_STRING" | sed -n 's/.*action=\([^&]*\).*/\1/p')
fi

# Validate action
if [ "$action" != "up" ] && [ "$action" != "down" ]; then
    echo '{"status":"error","message":"Invalid action","error":"Action must be either up or down"}'
    exit 1
fi

# Check if tailscale command is available
if ! command -v tailscale >/dev/null 2>&1; then
    echo '{"status":"error","message":"Tailscale command not found","error":"Tailscale is not installed or not in PATH"}'
    exit 1
fi

# Execute the action
if [ "$action" = "up" ]; then
    # Start Tailscale service
    if command -v service >/dev/null 2>&1; then
        service tailscale start >/dev/null 2>&1
    elif [ -f /etc/init.d/tailscale ]; then
        /etc/init.d/tailscale start >/dev/null 2>&1
    else
        echo '{"status":"error","action":"up","message":"Failed to start Tailscale","error":"Service command not found"}'
        exit 1
    fi
    
    if [ $? -eq 0 ]; then
        echo '{"status":"success","action":"up","message":"Tailscale service has been started successfully."}'
    else
        echo '{"status":"error","action":"up","message":"Failed to start Tailscale service","error":"service start command failed"}'
        exit 1
    fi
elif [ "$action" = "down" ]; then
    # Stop Tailscale service
    if command -v service >/dev/null 2>&1; then
        service tailscale stop >/dev/null 2>&1
    elif [ -f /etc/init.d/tailscale ]; then
        /etc/init.d/tailscale stop >/dev/null 2>&1
    else
        echo '{"status":"error","action":"down","message":"Failed to stop Tailscale","error":"Service command not found"}'
        exit 1
    fi
    
    if [ $? -eq 0 ]; then
        echo '{"status":"success","action":"down","message":"Tailscale service has been stopped successfully."}'
    else
        echo '{"status":"error","action":"down","message":"Failed to stop Tailscale service","error":"service stop command failed"}'
        exit 1
    fi
fi
