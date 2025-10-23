#!/bin/sh
# filepath: scripts/cgi-bin/quecmanager/tailscale/peers.sh
# Tailscale Peers Script - Get list of all peers in the network

# Set proper content type
echo "Content-Type: application/json"
echo ""

# Function to parse tailscale status output
get_peers_list() {
    # Get tailscale status output (non-JSON for easier parsing)
    local status_output
    status_output=$(tailscale status 2>/dev/null)
    
    # Check if output is empty
    if [ -z "$status_output" ]; then
        echo "[]"
        return
    fi
    
    # Parse each line and build JSON array
    echo "["
    
    local first=true
    echo "$status_output" | while IFS= read -r line; do
        # Skip lines starting with # (health checks)
        case "$line" in
            \#*) continue ;;
        esac
        
        # Skip empty lines
        [ -z "$line" ] && continue
        
        # Parse the line: IP HOSTNAME USER OS STATUS
        local ip hostname user os status
        
        # Extract fields using awk
        ip=$(echo "$line" | awk '{print $1}')
        hostname=$(echo "$line" | awk '{print $2}')
        user=$(echo "$line" | awk '{print $3}')
        os=$(echo "$line" | awk '{print $4}')
        status=$(echo "$line" | awk '{print $5}')
        
        # Convert status: "-" means online, anything else (offline, etc.) is the status
        if [ "$status" = "-" ]; then
            status="online"
        elif [ -z "$status" ]; then
            status="unknown"
        fi
        
        # Add comma before each entry except the first
        if [ "$first" = true ]; then
            first=false
        else
            echo ","
        fi
        
        # Build JSON object for this peer
        cat <<EOF
    {
        "ip": "$ip",
        "hostname": "$hostname",
        "user": "$user",
        "os": "$os",
        "status": "$status"
    }
EOF
    done
    
    echo "]"
}

# Main execution
main() {
    # Check if Tailscale is installed
    if ! command -v tailscale >/dev/null 2>&1; then
        echo '{"status": "error", "message": "Tailscale is not installed.", "peers": []}'
        exit 0
    fi
    
    # Get peers list
    local peers
    peers=$(get_peers_list)
    
    # Return JSON response
    cat <<EOF
{
    "status": "success",
    "message": "Peers retrieved successfully.",
    "peers": $peers
}
EOF
}

# Run main function
main
