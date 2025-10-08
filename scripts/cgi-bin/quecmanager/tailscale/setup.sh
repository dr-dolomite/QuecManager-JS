#!/bin/sh
# filepath: scripts/cgi-bin/quecmanager/tailscale/setup.sh
# Tailscale Setup Script - Detect installation, start service, and get auth URL

# Set proper content type
echo "Content-Type: application/json"
echo ""

# Function to send JSON response
send_json_response() {
    local status="$1"
    local message="$2"
    local auth_url="${3:-}"
    local is_installed="${4:-false}"
    local is_running="${5:-false}"
    
    cat <<EOF
{
    "status": "$status",
    "message": "$message",
    "is_installed": $is_installed,
    "is_running": $is_running,
    "auth_url": "$auth_url"
}
EOF
}

# Function to check if Tailscale is installed
is_tailscale_installed() {
    # Check if tailscale binary exists
    if command -v tailscale >/dev/null 2>&1; then
        return 0
    fi
    
    # Check if luci-app-tailscale package is installed
    if opkg list-installed | grep -q "luci-app-tailscale"; then
        return 0
    fi
    
    return 1
}

# Function to check if user is logged out
is_logged_out() {
    local status_output
    status_output=$(tailscale status 2>&1)
    
    # Check if output contains "Logged out."
    if echo "$status_output" | grep -q "Logged out"; then
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
    # 1. Check if Tailscale is installed
    if ! is_tailscale_installed; then
        send_json_response "error" "Tailscale is not installed. Please install it first." "" "false" "false"
        exit 0
    fi
    
    # 2. Use a persistent temp file
    temp_file="/tmp/tailscale_auth_url"
    
    # Remove old temp file if exists
    rm -f "$temp_file"
    
    # 3. Check if user is logged out and use appropriate command
    # The luci-app-tailscale package handles service management automatically
    # No need to manually start tailscaled - it starts when needed
    if is_logged_out; then
        # User is logged out, use 'tailscale login'
        tailscale login --accept-routes > "$temp_file" 2>&1 &
    else
        # User is not logged out (might be needs re-auth), use 'tailscale up'
        tailscale up --reset --accept-routes > "$temp_file" 2>&1 &
    fi
    
    # 4. Wait for auth URL to appear in the file (max 5 seconds)
    count=0
    auth_url=""
    
    while [ $count -lt 10 ]; do
        # Check if file exists and has content
        if [ -f "$temp_file" ] && [ -s "$temp_file" ]; then
            # Try to extract auth URL
            auth_url=$(grep -o 'https://login.tailscale.com/a/[^[:space:]]*' "$temp_file" 2>/dev/null | head -n 1)
            
            # If found, break
            if [ -n "$auth_url" ]; then
                break
            fi
        fi
        
        sleep 0.5
        count=$((count + 1))
    done
    
    # 5. Return the auth URL to GUI
    if [ -n "$auth_url" ]; then
        # Restart network and firewall services after tailscale command
        restart_services
        
        # Leave tailscale up running in background for authentication
        # The temp file will be cleaned up by the cleanup script
        send_json_response "success" "Authentication required. Please use the provided URL." "$auth_url" "true" "true"
    else
        # No auth URL found - might already be authenticated
        # Restart services anyway
        restart_services
        
        rm -f "$temp_file"
        send_json_response "success" "Tailscale is running. Checking authentication status..." "" "true" "true"
    fi
}

# Run main function
main