#!/bin/sh

# Ping Settings Configuration Script
# Manages ping service (enable/disable) and daemon settings with dynamic service management
# Uses UCI configuration for OpenWRT integration
# Author: dr-dolomite
# Date: 2025-10-03

# Handle OPTIONS request first (before any headers)
if [ "${REQUEST_METHOD:-GET}" = "OPTIONS" ]; then
    echo "Content-Type: text/plain"
    echo "Access-Control-Allow-Origin: *"
    echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
    echo "Access-Control-Allow-Headers: Content-Type"
    echo "Access-Control-Max-Age: 86400"
    echo ""
    exit 0
fi

# Set content type and CORS headers for other requests
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Configuration
LOG_FILE="/tmp/ping_settings.log"
SERVICES_INIT="/etc/init.d/quecmanager_services"
UCI_CONFIG="quecmanager"
UCI_SECTION="ping_daemon"

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
    if ! uci -q get quecmanager.ping_daemon >/dev/null 2>&1; then
        uci set quecmanager.ping_daemon=service
        uci commit quecmanager
        log_message "Initialized UCI config section"
    fi
}

# Check if ping daemon is running
is_ping_daemon_running() {
    pgrep -f "ping_daemon.sh" >/dev/null 2>&1
}

# Get current ping setting from UCI
get_config_values() {
    # Defaults
    ENABLED="false"
    HOST="8.8.8.8"
    INTERVAL="5"
    IS_DEFAULT="true"

    # Initialize UCI if needed
    init_uci_config

    # Read from UCI
    local uci_enabled=$(uci -q get quecmanager.ping_daemon.enabled)
    if [ -n "$uci_enabled" ]; then
        case "$uci_enabled" in
            1|true|on|yes|enabled) ENABLED="true" ;;
            *) ENABLED="false" ;;
        esac
        IS_DEFAULT="false"
    fi

    local uci_host=$(uci -q get quecmanager.ping_daemon.host)
    if [ -n "$uci_host" ]; then
        HOST="$uci_host"
        IS_DEFAULT="false"
    fi

    local uci_interval=$(uci -q get quecmanager.ping_daemon.interval)
    if [ -n "$uci_interval" ] && echo "$uci_interval" | grep -qE '^[0-9]+$'; then
        INTERVAL="$uci_interval"
        IS_DEFAULT="false"
    fi
}

# Save ping setting to UCI
save_config() {
    local enabled="$1"
    local host="$2"
    local interval="$3"

    # Initialize UCI if needed
    init_uci_config

    # Convert boolean to UCI format (1/0)
    local uci_enabled="0"
    [ "$enabled" = "true" ] && uci_enabled="1"

    # Set UCI values
    uci set quecmanager.ping_daemon.enabled="$uci_enabled"
    uci set quecmanager.ping_daemon.host="$host"
    uci set quecmanager.ping_daemon.interval="$interval"

    # Commit changes
    if ! uci commit quecmanager; then
        log_message "ERROR: Failed to commit UCI changes"
        return 1
    fi

    log_message "Saved ping config via UCI: enabled=$enabled host=$host interval=$interval"
    return 0
}

# Add ping daemon to services init script (remove the static version and add dynamic version)
add_ping_daemon_to_services() {
    if [ ! -f "$SERVICES_INIT" ]; then
        log_message "Services init file not found: $SERVICES_INIT"
        return 1
    fi

    # First, remove any existing ping daemon block (both static and dynamic)
    remove_ping_daemon_from_services

    # Add the dynamic ping daemon block before "All QuecManager services Started"
    local temp_file="/tmp/services_temp_$$"
    
    awk '
    /echo "All QuecManager services Started"/ {
        print "    # Start ping daemon"
        print "    echo \"Starting Ping Daemon...\""
        print "    procd_open_instance"
        print "    procd_set_param command /www/cgi-bin/services/ping_daemon.sh"
        print "    procd_set_param respawn"
        print "    procd_set_param stdout 1"
        print "    procd_set_param stderr 1"
        print "    procd_close_instance"
        print "    echo \"Ping Daemon started\""
        print ""
    }
    { print }
    ' "$SERVICES_INIT" > "$temp_file"

    if [ -s "$temp_file" ]; then
        mv "$temp_file" "$SERVICES_INIT"
        chmod +x "$SERVICES_INIT"
        log_message "Added ping daemon to services init script"
        return 0
    else
        rm -f "$temp_file"
        log_message "Failed to add ping daemon to services"
        return 1
    fi
}

# Remove ping daemon from services init script (both static and dynamic versions)
remove_ping_daemon_from_services() {
    if [ ! -f "$SERVICES_INIT" ]; then
        log_message "Services init file not found: $SERVICES_INIT"
        return 1
    fi

    local temp_file="/tmp/services_temp_$$"
    
    # Remove both the old static ping daemon block and any dynamic ping daemon block
    awk '
    # Skip the old static ping daemon block
    /# Start ping daemon if enabled in configuration/ { 
        skip_static=1
        next 
    }
    skip_static && /echo "Ping Daemon started"/ { 
        skip_static=0
        next 
    }
    skip_static && /echo "Ping configuration not found/ { 
        skip_static=0
        next 
    }
    skip_static { next }
    
    # Skip the new dynamic ping daemon block
    /# Start ping daemon$/ { 
        skip_dynamic=1
        next 
    }
    skip_dynamic && /^$/ { 
        skip_dynamic=0
        next 
    }
    skip_dynamic { next }
    
    # Print everything else
    !skip_static && !skip_dynamic { print }
    ' "$SERVICES_INIT" > "$temp_file"

    if [ -s "$temp_file" ]; then
        mv "$temp_file" "$SERVICES_INIT"
        chmod +x "$SERVICES_INIT"
        log_message "Removed ping daemon from services init script"
        return 0
    else
        rm -f "$temp_file"
        log_message "Failed to remove ping daemon from services"
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

# Delete ping configuration (reset to default) - removes UCI section
delete_ping_setting() {
    # Check if section exists
    if uci -q get quecmanager.ping_daemon >/dev/null 2>&1; then
        # Delete the entire section
        uci delete quecmanager.ping_daemon
        if uci commit quecmanager; then
            log_message "Deleted ping_daemon UCI section"
            return 0
        else
            log_message "ERROR: Failed to commit UCI deletion"
            return 1
        fi
    fi
    log_message "No ping_daemon UCI section to delete"
    return 0
}

# Handle GET request - Retrieve ping setting
handle_get() {
    log_message "GET request received"
    get_config_values
    local running=false
    if is_ping_daemon_running; then running=true; fi
    send_success "Ping configuration retrieved" "{\"enabled\":$ENABLED,\"host\":\"$HOST\",\"interval\":$INTERVAL,\"running\":$running,\"isDefault\":$IS_DEFAULT}"
}

# Handle POST request - Update ping setting
handle_post() {
    log_message "POST request received"
    
    # Read POST data
    local content_length=${CONTENT_LENGTH:-0}
    if [ "$content_length" -gt 0 ]; then
        local post_data=$(dd bs=$content_length count=1 2>/dev/null)
        log_message "Received POST data: $post_data"
        
        # Parse fields
        local enabled host interval
        enabled=$(echo "$post_data" | sed -n 's/.*"enabled"[[:space:]]*:[[:space:]]*\([^,}]*\).*/\1/p' | tr -d ' ' | sed 's/"//g')
        host=$(echo "$post_data" | sed -n 's/.*"host"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
        interval=$(echo "$post_data" | sed -n 's/.*"interval"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p')

        # Defaults when missing
        [ -z "$enabled" ] && enabled="true"
        [ -z "$host" ] && host="8.8.8.8"
        [ -z "$interval" ] && interval="5"

        # Validate
        case "$enabled" in
            true|false) : ;;
            *) send_error "INVALID_SETTING" "Invalid enabled value. Must be true or false." ;;
        esac
        if ! echo "$interval" | grep -qE '^[0-9]+$'; then
            send_error "INVALID_INTERVAL" "Interval must be a number (seconds)."
        fi
        if [ "$interval" -lt 1 ] || [ "$interval" -gt 3600 ]; then
            send_error "INVALID_INTERVAL" "Interval must be between 1 and 3600 seconds."
        fi

        # Get current config to compare
        get_config_values
        local prev_enabled="$ENABLED"
        local prev_host="$HOST"
        local prev_interval="$INTERVAL"

        # Save new configuration
        save_config "$enabled" "$host" "$interval" || send_error "WRITE_FAILED" "Failed to save configuration"

        # Handle service changes using dynamic management like memory
        if [ "$enabled" = "true" ]; then
            # Enable ping daemon
            add_ping_daemon_to_services
            if [ "$prev_enabled" != "true" ] || [ "$prev_host" != "$host" ] || [ "$prev_interval" != "$interval" ]; then
                restart_services
            fi
        else
            # Disable ping daemon
            # First, kill any running ping daemon processes
            if is_ping_daemon_running; then
                log_message "Stopping running ping daemon..."
                pkill -f "ping_daemon.sh" 2>/dev/null || true
                sleep 1
            fi
            # Remove from services and restart
            remove_ping_daemon_from_services
            restart_services
        fi

        # Return current status
        sleep 1  # Give services time to start/stop
        local running=false
        if is_ping_daemon_running; then running=true; fi

        send_success "Ping setting updated successfully" "{\"enabled\":$enabled,\"host\":\"$host\",\"interval\":$interval,\"running\":$running}"
    else
        send_error "NO_DATA" "No data provided"
    fi
}

# Handle DELETE request - Reset to default (delete configuration)
handle_delete() {
    log_message "DELETE request received"
    
    # Kill any running ping daemon processes
    if is_ping_daemon_running; then
        log_message "Stopping running ping daemon..."
        pkill -f "ping_daemon.sh" 2>/dev/null || true
        sleep 1
    fi
    
    # Remove ping daemon from services and restart
    remove_ping_daemon_from_services
    restart_services
    
    # Remove config files
    delete_ping_setting
    
    send_success "Ping setting reset to default (disabled)" "{\"enabled\":false,\"running\":false,\"isDefault\":true}"
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
    *)
        send_error "METHOD_NOT_ALLOWED" "HTTP method ${REQUEST_METHOD} not supported"
        ;;
esac 
