#!/bin/sh
# filepath: scripts/cgi-bin/quecmanager/tailscale/status.sh
# Tailscale Status Script - Check current Tailscale status

# Set proper content type
echo "Content-Type: application/json"
echo ""

# Function to send JSON response
send_json_response() {
    local status="$1"
    local message="$2"
    local is_installed="${3:-false}"
    local is_running="${4:-false}"
    local is_authenticated="${5:-false}"
    local backend_state="${6:-Unknown}"
    local ip_address="${7:-}"
    local hostname="${8:-}"
    local email="${9:-}"
    local dns_name="${10:-}"
    
    cat <<EOF
{
    "status": "$status",
    "message": "$message",
    "is_installed": $is_installed,
    "is_running": $is_running,
    "is_authenticated": $is_authenticated,
    "backend_state": "$backend_state",
    "ip_address": "$ip_address",
    "hostname": "$hostname",
    "email": "$email",
    "dns_name": "$dns_name"
}
EOF
}

# Function to check if Tailscale is installed
is_tailscale_installed() {
    if command -v tailscale >/dev/null 2>&1; then
        return 0
    fi
    
    if opkg list-installed | grep -q "luci-app-tailscale"; then
        return 0
    fi
    
    return 1
}

# Function to get Tailscale IP address
get_tailscale_ip() {
    tailscale ip -4 2>/dev/null | head -n 1
}

# Function to get Tailscale status
get_tailscale_status() {
    tailscale status --json 2>/dev/null || echo '{}'
}

# Function to get email for current device from CapMap
get_device_email() {
    local status_json="$1"
    
    # Extract email from CapMap["tailnet-display-name"][0]
    local email
    email=$(echo "$status_json" | jsonfilter -e '@.Self.CapMap["tailnet-display-name"][0]' 2>/dev/null)
    
    # If not found, try to get LoginName from User object using UserID
    if [ -z "$email" ]; then
        local user_id
        user_id=$(echo "$status_json" | jsonfilter -e '@.Self.UserID' 2>/dev/null)
        
        if [ -n "$user_id" ]; then
            email=$(echo "$status_json" | jsonfilter -e '@.User["'"$user_id"'"].LoginName' 2>/dev/null)
        fi
    fi
    
    echo "$email"
}

# Function to get DNS name for current device
get_device_dns_name() {
    local status_json="$1"
    
    # Extract DNS name from Self.DNSName
    local dns_name
    dns_name=$(echo "$status_json" | jsonfilter -e '@.Self.DNSName' 2>/dev/null)
    
    echo "$dns_name"
}

# Main execution
main() {
    # Check if Tailscale is installed
    if ! is_tailscale_installed; then
        send_json_response "error" "Tailscale is not installed." "false" "false" "false" "NotInstalled" "" ""
        exit 0
    fi
    
    local is_installed="true"
    local is_running="false"
    local is_authenticated="false"
    local backend_state="Stopped"
    local ip_address=""
    local hostname=""
    local email=""
    local dns_name=""
    
    # First, check if Tailscale is stopped by checking text output
    local status_text
    status_text=$(tailscale status 2>&1)
    
    if echo "$status_text" | grep -q "Tailscale is stopped"; then
        # Tailscale is explicitly stopped (after disconnect)
        send_json_response "success" "Tailscale is stopped." "$is_installed" "false" "false" "Stopped" "" "" "" ""
        exit 0
    fi
    
    # Primary check: If we can get an IP, Tailscale is authenticated and running
    ip_address=$(get_tailscale_ip)
    
    if [ -n "$ip_address" ]; then
        # Device has a Tailscale IP, so it's authenticated and connected
        is_running="true"
        is_authenticated="true"
        backend_state="Running"
        
        # Get detailed status for hostname, email, and DNS name
        local status_json
        status_json=$(get_tailscale_status)
        
        # Extract hostname from Self object
        hostname=$(echo "$status_json" | jsonfilter -e '@.Self.HostName' 2>/dev/null)
        
        # If hostname is empty, try to get it from status output
        if [ -z "$hostname" ]; then
            hostname=$(tailscale status 2>/dev/null | grep "^${ip_address}" | awk '{print $2}')
        fi
        
        # Get email and DNS name for the current device
        email=$(get_device_email "$status_json")
        dns_name=$(get_device_dns_name "$status_json")
        
        send_json_response "success" "Tailscale is running and authenticated." "$is_installed" "$is_running" "$is_authenticated" "$backend_state" "$ip_address" "$hostname" "$email" "$dns_name"
    else
        # No IP address, check if it needs authentication
        local status_json
        status_json=$(get_tailscale_status)
        
        backend_state=$(echo "$status_json" | jsonfilter -e '@.BackendState' 2>/dev/null)
        backend_state="${backend_state:-Stopped}"
        
        if [ "$backend_state" = "NeedsLogin" ]; then
            is_running="true"
            send_json_response "success" "Tailscale is running but needs authentication." "$is_installed" "$is_running" "$is_authenticated" "$backend_state" "" "" "" ""
        else
            send_json_response "success" "Tailscale is installed but not running." "$is_installed" "$is_running" "$is_authenticated" "$backend_state" "" "" "" ""
        fi
    fi
}

# Run main function
main