#!/bin/sh

# Memory Settings Configuration Script
# Manages memory service (enable/disable) and daemon settings with dynamic service management
# Uses UCI configuration for OpenWRT integration
# Date: 2025-10-03

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

# Configuration
LOG_FILE="/tmp/memory_settings.log"
SERVICES_INIT="/etc/init.d/quecmanager_services"
UCI_CONFIG="quecmanager"
UCI_SECTION="memory_daemon"

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

# Initialize UCI configuration
init_uci_config() {
    # Ensure quecmanager config exists
    touch /etc/config/quecmanager 2>/dev/null || true
    
    # Create section if it doesn't exist
    if ! uci -q get quecmanager.memory_daemon >/dev/null 2>&1; then
        uci set quecmanager.memory_daemon=service
        uci commit quecmanager
        log_message "Initialized UCI config section"
    fi
}

# Get current configuration from UCI
get_config() {
    # Defaults
    ENABLED="false"
    INTERVAL="1"

    # Initialize UCI if needed
    init_uci_config

    # Read from UCI
    local uci_enabled=$(uci -q get quecmanager.memory_daemon.enabled)
    if [ -n "$uci_enabled" ]; then
        case "$uci_enabled" in
            1|true|on|yes|enabled) ENABLED="true" ;;
            *) ENABLED="false" ;;
        esac
    fi

    local uci_interval=$(uci -q get quecmanager.memory_daemon.interval)
    if [ -n "$uci_interval" ] && echo "$uci_interval" | grep -qE '^[0-9]+$'; then
        if [ "$uci_interval" -ge 1 ] && [ "$uci_interval" -le 10 ]; then
            INTERVAL="$uci_interval"
        fi
    fi
}

# Save configuration to UCI
save_config() {
    local enabled="$1"
    local interval="$2"

    # Initialize UCI if needed
    init_uci_config

    # Convert boolean to UCI format (1/0)
    local uci_enabled="0"
    [ "$enabled" = "true" ] && uci_enabled="1"

    # Set UCI values
    uci set quecmanager.memory_daemon.enabled="$uci_enabled"
    uci set quecmanager.memory_daemon.interval="$interval"

    # Commit changes
    if ! uci commit quecmanager; then
        log_message "ERROR: Failed to commit UCI changes"
        return 1
    fi

    log_message "Saved config via UCI: enabled=$enabled, interval=$interval"
    return 0
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
        # First, kill any running memory daemon processes
        if is_memory_daemon_running; then
            log_message "Stopping running memory daemon..."
            pkill -f "memory_daemon.sh" 2>/dev/null || true
            sleep 1
        fi
        # Remove from services and restart
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
    
    # Kill any running memory daemon processes
    if is_memory_daemon_running; then
        log_message "Stopping running memory daemon..."
        pkill -f "memory_daemon.sh" 2>/dev/null || true
        sleep 1
    fi
    
    # Remove memory daemon from services and restart
    remove_memory_daemon_from_services
    restart_services
    
    # Remove UCI configuration
    if uci -q get quecmanager.memory_daemon >/dev/null 2>&1; then
        uci delete quecmanager.memory_daemon
        uci commit quecmanager
        log_message "Deleted memory_daemon UCI section"
    fi
    
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
