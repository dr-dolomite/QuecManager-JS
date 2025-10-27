#!/bin/sh

# Tailscale Uninstall Script
# Uninstalls luci-app-tailscale package and reboots the system

echo "Content-type: application/json"
echo ""

# Check if opkg is available
if ! command -v opkg >/dev/null 2>&1; then
    echo '{"status":"error","message":"Package manager not found","error":"opkg command not available"}'
    exit 1
fi

# Check if luci-app-tailscale is installed
if ! opkg list-installed | grep -q "luci-app-tailscale"; then
    echo '{"status":"error","message":"Tailscale not installed","error":"luci-app-tailscale package is not installed"}'
    exit 1
fi

# Uninstall luci-app-tailscale
opkg remove luci-app-tailscale >/dev/null 2>&1

if [ $? -eq 0 ]; then
    echo '{"status":"success","message":"Tailscale has been uninstalled successfully. Device will reboot in 3 seconds...","rebooting":true}'
    
    # Reboot after 3 seconds
    (sleep 3 && reboot) &
else
    echo '{"status":"error","message":"Failed to uninstall Tailscale","error":"opkg remove command failed"}'
    exit 1
fi
