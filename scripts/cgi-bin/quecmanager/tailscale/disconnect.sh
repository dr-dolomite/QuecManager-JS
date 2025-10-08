#!/bin/sh
# filepath: scripts/cgi-bin/quecmanager/tailscale/disconnect.sh
# Tailscale Disconnect Script - Disconnect from Tailscale network

# Set proper content type
echo "Content-Type: application/json"
echo ""

# Function to send JSON response
send_json_response() {
    local status="$1"
    local message="$2"
    
    cat <<EOF
{
    "status": "$status",
    "message": "$message"
}
EOF
}

# Function to check if Tailscale is installed
is_tailscale_installed() {
    if command -v tailscale >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Function to restart network and firewall services
restart_services() {
    # Restart network service
    /etc/init.d/network restart >/dev/null 2>&1 &
    
    # Restart firewall service
    /etc/init.d/firewall restart >/dev/null 2>&1 &
}

# Main execution
main() {
    # Check if Tailscale is installed
    if ! is_tailscale_installed; then
        send_json_response "error" "Tailscale is not installed."
        exit 0
    fi
    
    # Run tailscale down
    if tailscale down 2>/dev/null; then
        # Restart network and firewall services after disconnect
        restart_services
        
        send_json_response "success" "Successfully disconnected from Tailscale."
    else
        send_json_response "error" "Failed to disconnect from Tailscale."
    fi
}

# Run main function
main
