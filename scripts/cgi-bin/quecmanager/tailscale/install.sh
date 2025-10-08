#!/bin/sh
# Tailscale Installation Script - Fixed cache check

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
    ping -c 1 -W 3 8.8.8.8 >/dev/null 2>&1
}

# Fixed function to check if package lists are fresh (BusyBox compatible)
are_package_lists_fresh() {
    local lists_dir="/var/opkg-lists"
    
    # Check if directory exists
    if [ ! -d "$lists_dir" ]; then
        log_step "Package lists directory not found"
        return 1
    fi
    
    # Check if any files exist
    if ! ls "$lists_dir"/* >/dev/null 2>&1; then
        log_step "No package list files found"
        return 1
    fi
    
    # Get the newest file using ls -t (BusyBox compatible)
    local newest_file
    newest_file=$(ls -t "$lists_dir"/* 2>/dev/null | head -n 1)
    
    if [ -z "$newest_file" ] || [ ! -f "$newest_file" ]; then
        log_step "Could not find newest package list file"
        return 1
    fi
    
    # Get file modification time
    local file_time
    file_time=$(stat -c %Y "$newest_file" 2>/dev/null)
    
    if [ -z "$file_time" ]; then
        log_step "Could not read file timestamp"
        return 1
    fi
    
    # Get current time
    local current_time
    current_time=$(date +%s)
    
    # Calculate age in seconds
    local age=$((current_time - file_time))
    
    # Consider fresh if updated within last hour (3600 seconds)
    if [ "$age" -lt 3600 ]; then
        log_step "Package lists are fresh (${age}s old) - skipping update"
        return 0
    fi
    
    log_step "Package lists are stale (${age}s old) - will update"
    return 1
}

# Function to update package lists
update_package_lists() {
    # Check if lists are fresh first
    if are_package_lists_fresh; then
        log_step "Using cached package lists"
        return 0
    fi
    
    log_step "Updating package lists..."
    
    # Create temp file for exit status
    local tmp_status="/tmp/opkg_update_status.$$"
    
    # Run opkg update with real-time logging
    ( opkg update 2>&1 || echo $? > "$tmp_status" ) | logger -t "tailscale-install"
    
    # Check if error occurred
    if [ -f "$tmp_status" ]; then
        local exit_code
        exit_code=$(cat "$tmp_status")
        rm -f "$tmp_status"
        log_step "Package update failed with exit code: $exit_code"
        return 1
    fi
    
    log_step "Package lists updated successfully"
    return 0
}

# Optimized install function with real-time progress
install_package() {
    local package="$1"
    
    log_step "Preparing to install $package..."
    
    # Quick check if already installed
    if is_package_installed "$package"; then
        log_step "$package is already installed"
        return 0
    fi
    
    # Create temp file for exit status
    local tmp_status="/tmp/opkg_install_status.$$"
    
    log_step "Downloading and installing $package (this may take 2-5 minutes)..."
    log_step "=== Installation progress ==="
    
    # Install with real-time logging
    ( opkg install "$package" 2>&1 || echo $? > "$tmp_status" ) | while IFS= read -r line; do
        # Log everything
        logger -t "tailscale-install" "$line"
    done
    
    # Check exit status
    if [ -f "$tmp_status" ]; then
        local exit_code
        exit_code=$(cat "$tmp_status")
        rm -f "$tmp_status"
        
        # Double-check if actually installed despite error
        if is_package_installed "$package"; then
            log_step "$package installed successfully (ignored exit code $exit_code)"
            return 0
        fi
        
        log_step "Failed to install $package (exit code: $exit_code)"
        return 1
    fi
    
    log_step "=== Installation completed successfully ==="
    return 0
}

# Function to get available storage space
get_available_space() {
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
    
    # Check available storage
    local available_space
    available_space=$(get_available_space)
    log_step "Available storage: ${available_space}KB"
    
    if [ "$available_space" -lt 20480 ]; then
        log_step "Insufficient storage: ${available_space}KB (need at least 20MB)"
        send_json_response "error" "Insufficient storage space. At least 20MB required." "0" "Only ${available_space}KB available"
        exit 1
    fi
    
    # Update package lists (or use cache if fresh)
    log_step "Checking package lists..."
    if ! update_package_lists; then
        log_step "Failed to update package lists"
        send_json_response "error" "Failed to update package lists. Please try again." "20" "opkg update failed"
        exit 1
    fi
    
    log_step "Package lists ready"
    
    # Install luci-app-tailscale
    if ! install_package "luci-app-tailscale"; then
        log_step "Installation FAILED"
        send_json_response "error" "Failed to install Tailscale. Check logs: logread | grep tailscale-install" "50" "opkg install failed"
        exit 1
    fi
    
    # Verify installation
    if is_package_installed "tailscale" && command -v tailscale >/dev/null 2>&1; then
        log_step "Tailscale verified and ready to use"
        send_json_response "success" "Tailscale installed successfully!" "100" "Ready to configure"
        exit 0
    else
        log_step "Installation verification failed"
        send_json_response "error" "Installation completed but verification failed." "90" "Verification failed"
        exit 1
    fi
}

# Run main function
main