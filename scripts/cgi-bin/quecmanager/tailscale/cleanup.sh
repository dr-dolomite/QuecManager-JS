#!/bin/sh
# Tailscale Cleanup Script - Remove temp file and restart services after authentication

# Set proper content type
echo "Content-Type: application/json"
echo ""

# Function to restart network and firewall services
restart_services() {
    # Restart network service
    /etc/init.d/network restart >/dev/null 2>&1 &
    
    # Restart firewall service
    /etc/init.d/firewall restart >/dev/null 2>&1 &
}

# Remove the temp file
rm -f /tmp/tailscale_auth_url

# Restart network and firewall services after successful authentication
restart_services

# Return success
cat <<EOF
{
    "status": "success",
    "message": "Cleanup completed and services restarted."
}
EOF
