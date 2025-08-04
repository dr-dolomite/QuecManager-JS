#!/bin/sh

# Ping Settings Configuration Script
# Manages ping enable/disable preferences
# Author: dr-dolomite
# Date: 2025-08-04

# Set content type and CORS headers
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Configuration
CONFIG_DIR="/etc/quecmanager/settings"
CONFIG_FILE="$CONFIG_DIR/ping_settings.conf"
LOG_FILE="/tmp/ping_settings.log"

# Logging function
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Error response function
send_error() {
    local error_code="$1"
    local error_message="$2"
    log_message "ERROR: $error_message"
    echo "{\"status\":\"error\",\"code\":\"$error_code\",\"message\":\"$error_message\"}"
    exit 1
}

# Success response function
send_success() {
    local message="$1"
    local data="$2"
    log_message "SUCCESS: $message"
    if [ -n "$data" ]; then
        echo "{\"status\":\"success\",\"message\":\"$message\",\"data\":$data}"
    else
        echo "{\"status\":\"success\",\"message\":\"$message\"}"
    fi
}

# Ensure configuration directory exists
ensure_config_directory() {
    if [ ! -d "$CONFIG_DIR" ]; then
        log_message "Creating directory: $CONFIG_DIR"
        mkdir -p "$CONFIG_DIR"
        if [ $? -ne 0 ]; then
            # Try to use a fallback location in /tmp
            CONFIG_DIR="/tmp/quecmanager/settings"
            CONFIG_FILE="$CONFIG_DIR/ping_settings.conf"
            log_message "Fallback to alternative location: $CONFIG_DIR"
            mkdir -p "$CONFIG_DIR"
            if [ $? -ne 0 ]; then
                send_error "DIRECTORY_ERROR" "Failed to create configuration directory"
            fi
        fi
        chmod 755 "$CONFIG_DIR"
        log_message "Created configuration directory: $CONFIG_DIR"
    fi
}

# Get current ping setting
get_ping_setting() {
    # If config file exists, read from it
    if [ -f "$CONFIG_FILE" ]; then
        ping_enabled=$(grep "^PING_ENABLED=" "$CONFIG_FILE" | cut -d'=' -f2)
        if [ -n "$ping_enabled" ]; then
            if [ "$ping_enabled" = "true" ] || [ "$ping_enabled" = "1" ] || [ "$ping_enabled" = "on" ]; then
                echo "true"
            else
                echo "false"
            fi
            return
        fi
    fi
    
    # Default to enabled if no config exists
    echo "true"
}

# Save ping setting to config file
save_ping_setting() {
    local enabled="$1"
    ensure_config_directory
    
    # Create or update config file
    if [ -f "$CONFIG_FILE" ]; then
        # Update existing file
        sed -i "s/^PING_ENABLED=.*$/PING_ENABLED=$enabled/" "$CONFIG_FILE"
        if [ $? -ne 0 ]; then
            # If sed fails (e.g., no match), append the setting
            echo "PING_ENABLED=$enabled" >> "$CONFIG_FILE"
        fi
    else
        # Create new file
        echo "PING_ENABLED=$enabled" > "$CONFIG_FILE"
    fi
    
    chmod 644 "$CONFIG_FILE"
    log_message "Saved ping setting: $enabled"
}

# Delete ping configuration (reset to default)
delete_ping_setting() {
    if [ -f "$CONFIG_FILE" ]; then
        # Remove the PING_ENABLED line
        sed -i '/^PING_ENABLED=/d' "$CONFIG_FILE"
        log_message "Deleted ping configuration"
        
        # If file is empty after deletion, remove it
        if [ ! -s "$CONFIG_FILE" ]; then
            rm -f "$CONFIG_FILE"
            log_message "Removed empty config file"
        fi
        return 0
    else
        return 1
    fi
}

# Handle GET request - Retrieve ping setting
handle_get() {
    log_message "GET request received"
    
    # Get current setting (from config or default)
    local enabled=$(get_ping_setting)
    
    # Check if it's from config or default
    local is_default=true
    if [ -f "$CONFIG_FILE" ] && grep -q "^PING_ENABLED=" "$CONFIG_FILE"; then
        is_default=false
    fi
    
    send_success "Ping setting retrieved" "{\"enabled\":$enabled,\"isDefault\":$is_default}"
}

# Handle POST request - Update ping setting
handle_post() {
    log_message "POST request received"
    
    # Read POST data
    local content_length=${CONTENT_LENGTH:-0}
    if [ "$content_length" -gt 0 ]; then
        local post_data=$(dd bs=$content_length count=1 2>/dev/null)
        log_message "Received POST data: $post_data"
        
        # Parse JSON to extract enabled value
        local enabled=""
        
        # Approach 1: Simple regex extraction for boolean
        enabled=$(echo "$post_data" | sed -n 's/.*"enabled"[[:space:]]*:[[:space:]]*\([^,}]*\).*/\1/p' | tr -d ' ')
        
        # Approach 2: grep + cut extraction
        if [ -z "$enabled" ]; then
            enabled=$(echo "$post_data" | grep -o '"enabled":[^,}]*' | cut -d':' -f2 | tr -d ' ')
        fi
        
        # Approach 3: Look for true/false in the payload
        if [ -z "$enabled" ]; then
            if echo "$post_data" | grep -q '"enabled"[[:space:]]*:[[:space:]]*true'; then
                enabled="true"
            elif echo "$post_data" | grep -q '"enabled"[[:space:]]*:[[:space:]]*false'; then
                enabled="false"
            fi
        fi
        
        # Clean up the value (remove quotes if present)
        enabled=$(echo "$enabled" | sed 's/"//g')
        
        log_message "Received enabled: $enabled"
        
        # Validate setting
        if [ "$enabled" = "true" ] || [ "$enabled" = "false" ]; then
            save_ping_setting "$enabled"
            send_success "Ping setting updated successfully" "{\"enabled\":$enabled}"
        else
            send_error "INVALID_SETTING" "Invalid setting provided. Must be 'true' or 'false'."
        fi
    else
        send_error "NO_DATA" "No data provided"
    fi
}

# Handle DELETE request - Reset to default (delete configuration)
handle_delete() {
    log_message "DELETE request received"
    
    if delete_ping_setting; then
        # Default is enabled
        send_success "Ping setting reset to default" "{\"enabled\":true,\"isDefault\":true}"
    else
        send_error "NOT_FOUND" "Ping setting configuration not found"
    fi
}

# Handle OPTIONS request for CORS preflight
handle_options() {
    log_message "OPTIONS request received"
    echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
    echo "Access-Control-Allow-Headers: Content-Type"
    echo "Access-Control-Max-Age: 86400"
    exit 0
}

# Main execution
log_message "Ping settings script called with method: ${REQUEST_METHOD:-GET}"

# Handle different HTTP methods
case "${REQUEST_METHOD:-GET}" in
    GET)
        handle_get
        ;;
    POST)
        handle_post
        ;;
    DELETE)
        handle_delete
        ;;
    OPTIONS)
        handle_options
        ;;
    *)
        send_error "METHOD_NOT_ALLOWED" "HTTP method ${REQUEST_METHOD} not supported"
        ;;
esac
