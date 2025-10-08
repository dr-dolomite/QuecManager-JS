#!/bin/sh
# Tailscale Installation Script - Install luci-app-tailscale and dependencies

# Set proper content type
echo "Content-Type: application/json"
echo ""

# Function to send JSON response
send_json_response() {
    local status="$1"
    local message="$2"
    local progress="${3:-0}"
    local details="${4:-}"
    
    cat <<EOF
{
    "status": "$status",
    "message": "$message",
    "progress": $progress,
    "details": "$details"
}
EOF
}

# Function to log installation steps
log_step() {
    local step="$1"
    logger -t "tailscale-install" "$step"
}

# Function to check if package is installed
is_package_installed() {
    local package="$1"
    opkg list-installed "$package" 2>/dev/null | grep -q "^$package"
}

# Function to check internet connectivity
check_internet() {
    if ping -c 1 -W 3 8.8.8.8 >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Function to check if package lists are fresh (updated within last hour)
are_package_lists_fresh() {
    local lists_dir="/var/opkg-lists"
    
    # Check if lists directory exists
    if [ ! -d "$lists_dir" ]; then
        return 1
    fi
    
    # Check if any list files exist
    local list_count
    list_count=$(find "$lists_dir" -type f 2>/dev/null | wc -l)
    if [ "$list_count" -eq 0 ]; then
        return 1
    fi
    
    # Find the newest list file
    local newest_file
    newest_file=$(find "$lists_dir" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n1 | cut -d' ' -f2-)
    
    if [ -z "$newest_file" ]; then
        return 1
    fi
    
    # Get file modification time (seconds since epoch)
    local file_time
    file_time=$(stat -c %Y "$newest_file" 2>/dev/null)
    
    if [ -z "$file_time" ]; then
        return 1
    fi
    
    # Get current time
    local current_time
    current_time=$(date +%s)
    
    # Calculate age in seconds
    local age=$((current_time - file_time))
    
    # Consider fresh if updated within last hour (3600 seconds)
    if [ "$age" -lt 3600 ]; then
        log_step "Package lists are fresh (${age}s old), skipping update"
        return 0
    fi
    
    return 1
}

# Function to update package lists
update_package_lists() {
    # Check if lists are already fresh
    if are_package_lists_fresh; then
        return 0
    fi
    
    log_step "Updating package lists..."
    
    if ! opkg update >/dev/null 2>&1; then
        return 1
    fi
    
    return 0
}

# Function to install package
install_package() {
    local package="$1"
    
    log_step "Installing $package..."
    
    # Install the package
    local output
    output=$(opkg install "$package" 2>&1)
    local result=$?
    
    if [ $result -ne 0 ]; then
        # Check if package is already installed (not an error)
        if echo "$output" | grep -q "already installed"; then
            return 0
        fi
        return 1
    fi
    
    return 0
}

# Function to get available storage space
get_available_space() {
    # Get available space in /tmp or root filesystem (in KB)
    df / | tail -n 1 | awk '{print $4}'
}

# Main installation function
main() {
    log_step "Starting Tailscale installation process"
    
    # Check if already installed
    if is_package_installed "tailscale"; then
        log_step "Tailscale is already installed"
        send_json_response "success" "Tailscale is already installed." "100" "Package tailscale found"
        exit 0
    fi
    
    # Check internet connectivity
    if ! check_internet; then
        log_step "No internet connection"
        send_json_response "error" "No internet connection. Please check your network connection." "0" "Failed to reach internet"
        exit 1
    fi
    
    # Check available storage space (need at least 10MB = 10240KB)
    local available_space
    available_space=$(get_available_space)
    
    if [ "$available_space" -lt 10240 ]; then
        log_step "Insufficient storage space: ${available_space}KB available"
        send_json_response "error" "Insufficient storage space. At least 10MB required." "0" "Only ${available_space}KB available"
        exit 1
    fi
    
    log_step "Available storage: ${available_space}KB"
    
    # Update package lists
    if ! update_package_lists; then
        log_step "Failed to update package lists"
        send_json_response "error" "Failed to update package lists. Please try again." "20" "opkg update failed"
        exit 1
    fi
    
    log_step "Package lists updated successfully"
    
    # Install luci-app-tailscale (this will also install tailscale as a dependency)
    if ! install_package "luci-app-tailscale"; then
        log_step "Failed to install luci-app-tailscale package"
        send_json_response "error" "Failed to install Tailscale package. Check system logs for details." "50" "opkg install luci-app-tailscale failed"
        exit 1
    fi
    
    log_step "Tailscale and LuCI app installed successfully (with dependencies)"
    
    # Verify installation
    if is_package_installed "tailscale" && command -v tailscale >/dev/null 2>&1; then
        log_step "Tailscale installation completed successfully"
        send_json_response "success" "Tailscale installed successfully! Use the toggle to enable and configure it." "100" "Installation complete. Ready to use."
        exit 0
    else
        log_step "Installation verification failed"
        send_json_response "error" "Installation completed but verification failed. Please check system logs." "90" "Verification failed"
        exit 1
    fi
}

# Run main function
main
