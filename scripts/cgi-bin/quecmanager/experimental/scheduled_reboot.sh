#!/bin/sh

# Scheduled Reboot Configuration Script
# Manages device reboot scheduling using cron
# Author: dr-dolomite
# Date: 2025-08-10

# Set content type and CORS headers
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Configuration
CONFIG_DIR="/etc/quecmanager/settings"
CONFIG_FILE="$CONFIG_DIR/scheduled_reboot.conf"
LOG_FILE="/tmp/scheduled_reboot.log"
CRON_FILE="/etc/crontabs/root"

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
        mkdir -p "$CONFIG_DIR"
        if [ $? -ne 0 ]; then
            CONFIG_DIR="/tmp/quecmanager/settings"
            CONFIG_FILE="$CONFIG_DIR/scheduled_reboot.conf"
            mkdir -p "$CONFIG_DIR"
            if [ $? -ne 0 ]; then
                send_error "DIRECTORY_ERROR" "Failed to create configuration directory"
            fi
        fi
        chmod 755 "$CONFIG_DIR"
    fi
}

# Update cron entry
update_cron() {
    local enabled="$1"
    local time="$2"
    local days="$3"
    
    # Create a temporary file for the new crontab
    local temp_cron=$(mktemp)
    
    # If crontab exists, copy all non-QuecManager reboot entries
    if [ -f "$CRON_FILE" ]; then
        grep -v "# QuecManager scheduled reboot$" "$CRON_FILE" > "$temp_cron"
    fi
    
    if [ "$enabled" = "true" ]; then
        # Extract hours and minutes from time (HH:MM format)
        local minutes=$(echo "$time" | cut -d':' -f2)
        local hours=$(echo "$time" | cut -d':' -f1)
        
        # Convert days array to cron format (0-6, where 0 is Sunday)
        local cron_days=""
        echo "$days" | grep -q '"sunday"' && cron_days="${cron_days}0,"
        echo "$days" | grep -q '"monday"' && cron_days="${cron_days}1,"
        echo "$days" | grep -q '"tuesday"' && cron_days="${cron_days}2,"
        echo "$days" | grep -q '"wednesday"' && cron_days="${cron_days}3,"
        echo "$days" | grep -q '"thursday"' && cron_days="${cron_days}4,"
        echo "$days" | grep -q '"friday"' && cron_days="${cron_days}5,"
        echo "$days" | grep -q '"saturday"' && cron_days="${cron_days}6,"
        
        # Remove trailing comma
        cron_days=$(echo "$cron_days" | sed 's/,$//')
        
        if [ -n "$cron_days" ]; then
            # Add new cron entry to our temporary file
            echo "$minutes $hours * * $cron_days /sbin/reboot # QuecManager scheduled reboot" >> "$temp_cron"
        fi
    fi
    
    # Ensure the crontabs directory exists
    if [ ! -d "/etc/crontabs" ]; then
        mkdir -p /etc/crontabs
        chmod 755 /etc/crontabs
    fi
    
    # Move the temporary file to the actual crontab and set permissions
    mv "$temp_cron" "$CRON_FILE"
    chmod 600 "$CRON_FILE"
    
    # Always restart cron to ensure changes take effect
    /etc/init.d/cron restart
}

# Save reboot configuration
save_config() {
    local enabled="$1"
    local time="$2"
    local days="$3"
    
    ensure_config_directory
    
    # Validate days is a proper JSON array
    if ! echo "$days" | grep -q '^\[.*\]$'; then
        days='["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]'
    fi
    
    # Create or update config file with proper JSON handling
    cat > "$CONFIG_FILE" << EOF
REBOOT_ENABLED=$enabled
REBOOT_TIME=$time
REBOOT_DAYS=$days
EOF
    
    chmod 644 "$CONFIG_FILE"
    
    # Update cron entry
    update_cron "$enabled" "$time" "$days"
}

# Get current configuration
get_config() {
    local enabled="false"
    local time="03:00"
    local days='["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]'
    
    if [ -f "$CONFIG_FILE" ]; then
        # Read the config file line by line to handle JSON properly
        while IFS='=' read -r key value; do
            case "$key" in
                REBOOT_ENABLED)
                    enabled="$value"
                    ;;
                REBOOT_TIME)
                    time="$value"
                    ;;
                REBOOT_DAYS)
                    # Only update days if the value is a valid JSON array
                    if echo "$value" | grep -q '^\[.*\]$'; then
                        days="$value"
                    fi
                    ;;
            esac
        done < "$CONFIG_FILE"
    fi
    
    # Ensure proper JSON formatting
    echo "{\"enabled\":$enabled,\"time\":\"$time\",\"days\":$days}"
}

# Handle GET request
handle_get() {
    local config=$(get_config)
    send_success "Configuration retrieved" "$config"
}

# Handle POST request
handle_post() {
    # Read POST data
    local content_length=${CONTENT_LENGTH:-0}
    if [ "$content_length" -gt 0 ]; then
        local post_data=$(dd bs=$content_length count=1 2>/dev/null)
        
        # Extract values using grep and sed
        local enabled=$(echo "$post_data" | grep -o '"enabled":\s*\(true\|false\)' | cut -d':' -f2 | tr -d ' ')
        local time=$(echo "$post_data" | grep -o '"time":"[^"]*"' | cut -d'"' -f4)
        local days=$(echo "$post_data" | grep -o '"days":\s*\[[^]]*\]' | cut -d':' -f2 | tr -d ' ')
        
        # Validate input
        if [ -z "$enabled" ] || [ -z "$time" ] || [ -z "$days" ]; then
            send_error "INVALID_INPUT" "Missing required fields"
            return
        fi
        
        # Validate time format (HH:MM)
        if ! echo "$time" | grep -qE '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'; then
            send_error "INVALID_TIME" "Invalid time format. Use HH:MM (24-hour)"
            return
        fi
        
        # Save configuration
        save_config "$enabled" "$time" "$days"
        send_success "Configuration updated successfully" "$(get_config)"
        
    else
        send_error "NO_DATA" "No data provided"
    fi
}

# Handle DELETE request
handle_delete() {
    if [ -f "$CONFIG_FILE" ]; then
        # Remove cron entry first
        update_cron "false" "00:00" "[]"
        
        # Remove config file
        rm -f "$CONFIG_FILE"
        send_success "Configuration reset to default" "$(get_config)"
    else
        send_error "NOT_FOUND" "Configuration not found"
    fi
}

# Handle OPTIONS request
handle_options() {
    echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
    echo "Access-Control-Allow-Headers: Content-Type"
    echo "Access-Control-Max-Age: 86400"
    exit 0
}

# Main execution
log_message "Scheduled reboot script called with method: ${REQUEST_METHOD:-GET}"

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