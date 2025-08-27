#!/bin/sh

# Memory Settings Configuration Script
# Manages memory service (enable/disable) and daemon settings with dynamic service management

# Handle OPTIONS request first
if [ "${REQUEST_METHOD:-GET}" = "OPTIONS" ]; then
    echo "Content-Type: text/plain"
    echo "Access-Control-Allow-Origin: *"
    echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
    echo "Access-Control-Allow-Headers: Content-Type"
    echo "Access-Control-Max-Age: 86400"
    echo ""
    exit 0
fi

# Set content type and CORS headers
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Configuration paths
CONFIG_DIR="/etc/quecmanager/settings"
CONFIG_FILE="$CONFIG_DIR/memory_settings.conf"
FALLBACK_CONFIG_DIR="/tmp/quecmanager/settings"
FALLBACK_CONFIG_FILE="$FALLBACK_CONFIG_DIR/memory_settings.conf"
LOG_FILE="/tmp/memory_settings.log"
SERVICES_INIT="/etc/init.d/quecmanager_services"

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

# Get current configuration
get_config() {
    # Defaults
    ENABLED="false"
    INTERVAL="1"

    # Try primary config first, then fallback
    local config_to_read=""
    if [ -f "$CONFIG_FILE" ]; then
        config_to_read="$CONFIG_FILE"
    elif [ -f "$FALLBACK_CONFIG_FILE" ]; then
        config_to_read="$FALLBACK_CONFIG_FILE"
    fi

    if [ -n "$config_to_read" ]; then
        local enabled_val=$(grep "^MEMORY_ENABLED=" "$config_to_read" 2>/dev/null | tail -n1 | cut -d'=' -f2)
        local interval_val=$(grep "^MEMORY_INTERVAL=" "$config_to_read" 2>/dev/null | tail -n1 | cut -d'=' -f2)
        
        case "$enabled_val" in
            true|1|on|yes|enabled) ENABLED="true" ;;
            *) ENABLED="false" ;;
        esac
        
        if echo "$interval_val" | grep -qE '^[0-9]+$' && [ "$interval_val" -ge 1 ] && [ "$interval_val" -le 10 ]; then
            INTERVAL="$interval_val"
        fi
    fi
}

# Save configuration
save_config() {
    local enabled="$1"
    local interval="$2"

    # Try primary location first
    if mkdir -p "$CONFIG_DIR" 2>/dev/null && [ -w "$CONFIG_DIR" ]; then
        {
            echo "MEMORY_ENABLED=$enabled"
            echo "MEMORY_INTERVAL=$interval"
        } > "$CONFIG_FILE" && chmod 644 "$CONFIG_FILE" 2>/dev/null
        log_message "Saved config to primary location: enabled=$enabled, interval=$interval"
        return 0
    fi

    # Fallback to tmp
    mkdir -p "$FALLBACK_CONFIG_DIR" 2>/dev/null
    {
        echo "MEMORY_ENABLED=$enabled"
        echo "MEMORY_INTERVAL=$interval"  
    } > "$FALLBACK_CONFIG_FILE" && chmod 644 "$FALLBACK_CONFIG_FILE" 2>/dev/null
    log_message "Saved config to fallback location: enabled=$enabled, interval=$interval"
}

# Add memory daemon to services init script
add_memory_daemon_to_services() {
    if [ ! -f "$SERVICES_INIT" ]; then
        log_message "Services init file not found: $SERVICES_INIT"
        return 1
    fi

    # Check if memory daemon is already present
    if grep -q "memory_daemon.sh" "$SERVICES_INIT" 2>/dev/null; then
        log_message "Memory daemon already present in services"
        return 0
    fi

    # Create a temporary file with the memory daemon block
    local temp_file="/tmp/services_temp_$$"
    
    # Find the line before "echo \"All QuecManager services Started\"" and insert memory daemon
    awk '
    /echo "All QuecManager services Started"/ {
        print "    # Start memory daemon"
        print "    echo \"Starting Memory Daemon...\""
        print "    procd_open_instance"
        print "    procd_set_param command /www/cgi-bin/services/memory_daemon.sh"
        print "    procd_set_param respawn"
        print "    procd_set_param stdout 1"
        print "    procd_set_param stderr 1"
        print "    procd_close_instance"
        print "    echo \"Memory Daemon started\""
        print ""
    }
    { print }
    ' "$SERVICES_INIT" > "$temp_file"

    if [ -s "$temp_file" ]; then
        mv "$temp_file" "$SERVICES_INIT"
        chmod +x "$SERVICES_INIT"
        log_message "Added memory daemon to services init script"
        return 0
    else
        rm -f "$temp_file"
        log_message "Failed to add memory daemon to services"
        return 1
    fi
}

# Remove memory daemon from services init script
remove_memory_daemon_from_services() {
    if [ ! -f "$SERVICES_INIT" ]; then
        log_message "Services init file not found: $SERVICES_INIT"
        return 1
    fi

    # Check if memory daemon is present
    if ! grep -q "memory_daemon.sh" "$SERVICES_INIT" 2>/dev/null; then
        log_message "Memory daemon not present in services"
        return 0
    fi

    # Remove the memory daemon block (from "# Start memory daemon" to the empty line after)
    local temp_file="/tmp/services_temp_$$"
    
    awk '
    /# Start memory daemon/ { skip=1; next }
    skip && /^$/ { skip=0; next }
    !skip { print }
    ' "$SERVICES_INIT" > "$temp_file"

    if [ -s "$temp_file" ]; then
        mv "$temp_file" "$SERVICES_INIT"
        chmod +x "$SERVICES_INIT"
        log_message "Removed memory daemon from services init script"
        return 0
    else
        rm -f "$temp_file"
        log_message "Failed to remove memory daemon from services"
        return 1
    fi
}

# Restart QuecManager services
restart_services() {
    log_message "Restarting QuecManager services..."
    
    # Stop services
    if [ -x "$SERVICES_INIT" ]; then
        "$SERVICES_INIT" stop >/dev/null 2>&1
        sleep 2
        "$SERVICES_INIT" start >/dev/null 2>&1
        log_message "Services restarted successfully"
        return 0
    else
        log_message "Cannot restart services - init script not found or not executable"
        return 1
    fi
}

# Check if memory daemon is running
is_memory_daemon_running() {
    pgrep -f "memory_daemon.sh" >/dev/null 2>&1
}

# Handle POST request - Update memory setting
handle_post() {
    log_message "POST request received"
    
    local content_length=${CONTENT_LENGTH:-0}
    if [ "$content_length" -eq 0 ]; then
        send_error "NO_DATA" "No data provided"
    fi

    # Read POST data
    local post_data=$(dd bs=$content_length count=1 2>/dev/null)
    log_message "Received POST data: $post_data"
    
    # Parse enabled and interval from JSON
    local enabled=$(echo "$post_data" | sed -n 's/.*"enabled"[[:space:]]*:[[:space:]]*\([^,}]*\).*/\1/p' | tr -d ' "')
    local interval=$(echo "$post_data" | sed -n 's/.*"interval"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p')

    # Set defaults if not provided
    [ -z "$enabled" ] && enabled="false"
    [ -z "$interval" ] && interval="1"

    # Validate input
    case "$enabled" in
        true|false) ;;
        *) send_error "INVALID_SETTING" "Invalid enabled value. Must be true or false." ;;
    esac

    if ! echo "$interval" | grep -qE '^[0-9]+$' || [ "$interval" -lt 1 ] || [ "$interval" -gt 10 ]; then
        send_error "INVALID_INTERVAL" "Interval must be a number between 1 and 10 seconds."
    fi

    # Get current config to compare
    get_config
    local prev_enabled="$ENABLED"
    local prev_interval="$INTERVAL"

    # Save new configuration
    save_config "$enabled" "$interval"

    # Handle service changes
    if [ "$enabled" = "true" ]; then
        # Enable memory daemon
        add_memory_daemon_to_services
        if [ "$prev_enabled" != "true" ] || [ "$prev_interval" != "$interval" ]; then
            restart_services
        fi
    else
        # Disable memory daemon
        remove_memory_daemon_from_services
        restart_services
    fi

    # Return current status
    sleep 1  # Give services time to start/stop
    local running="false"
    if is_memory_daemon_running; then
        running="true"
    fi

    send_success "Memory setting updated successfully" "{\"enabled\":$enabled,\"interval\":$interval,\"running\":$running}"
}

# Handle DELETE request - Reset to default
handle_delete() {
    log_message "DELETE request received"
    
    # Remove memory daemon from services and restart
    remove_memory_daemon_from_services
    restart_services
    
    # Remove config files
    rm -f "$CONFIG_FILE" "$FALLBACK_CONFIG_FILE" 2>/dev/null
    
    send_success "Memory setting reset to default (disabled)" "{\"enabled\":false,\"interval\":1,\"running\":false,\"isDefault\":true}"
}

# Main execution
log_message "Memory settings script called with method: ${REQUEST_METHOD:-GET}"

case "${REQUEST_METHOD:-GET}" in
    POST)
        handle_post
        ;;
    DELETE)
        handle_delete
        ;;
    *)
        send_error "METHOD_NOT_ALLOWED" "HTTP method ${REQUEST_METHOD} not supported."
        ;;
esac
