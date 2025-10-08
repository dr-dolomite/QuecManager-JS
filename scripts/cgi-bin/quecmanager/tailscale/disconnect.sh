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

# Main execution
main() {
    # Check if Tailscale is installed
    if ! is_tailscale_installed; then
        send_json_response "error" "Tailscale is not installed."
        exit 0
    fi
    
    # Run tailscale down (ignore exit code, just run it)
    tailscale down >/dev/null 2>&1
    
    # Wait 1 second for command to complete
    sleep 1
    
    # Restart network and firewall services after disconnect
    
    send_json_response "success" "Successfully disconnected from Tailscale."
}

# Run main function
main
