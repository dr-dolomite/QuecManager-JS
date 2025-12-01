#!/bin/sh

# Bandwidth Monitoring Settings Configuration Script
# Manages live bandwidth monitoring (enable/disable)
# Uses UCI configuration for OpenWRT integration
# Date: 2025-12-01

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
LOG_FILE="/tmp/bandwidth_settings.log"
SERVICES_INIT="/etc/init.d/quecmanager_services"
UCI_CONFIG="quecmanager"
UCI_SECTION="bridge_monitor"

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

# Initialize UCI configuration if needed
init_uci_config() {
    # Ensure quecmanager config exists
    touch /etc/config/quecmanager 2>/dev/null || true
    
    # Check if bridge_monitor section exists
    if ! uci -q get quecmanager.bridge_monitor >/dev/null 2>&1; then
        # Section doesn't exist, create it with defaults
        uci set quecmanager.bridge_monitor=bridge_monitor
        uci set quecmanager.bridge_monitor.output_path=/tmp/quecmanager/bridge_traffic_monitor
        uci set quecmanager.bridge_monitor.minimal_mode=no
        uci set quecmanager.bridge_monitor.json_mode=yes
        uci set quecmanager.bridge_monitor.channel=network-monitor
        uci set quecmanager.bridge_monitor.refresh_rate_ms=1000
        uci set quecmanager.bridge_monitor.required_interfaces=br-lan,eth0,rmnet_data0,rmnet_data1,rmnet_ipa0
        uci set quecmanager.bridge_monitor.websocat_enabled=yes
        uci set quecmanager.bridge_monitor.websocat_url=wss://localhost:8838
        uci commit quecmanager
        log_message "Initialized UCI config section with defaults"
    fi
}

# Get current configuration from UCI
get_config() {
    # Default to enabled
    ENABLED="true"
    IS_DEFAULT="true"

    # Initialize UCI if needed
    init_uci_config

    # Read from UCI
    local uci_enabled=$(uci -q get quecmanager.bridge_monitor.websocat_enabled)
    if [ -n "$uci_enabled" ]; then
        case "$uci_enabled" in
            1|true|on|yes|enabled) ENABLED="true" ;;
            0|false|off|no|disabled) ENABLED="false" ;;
            *) ENABLED="true" ;;
        esac
        IS_DEFAULT="false"
    fi
}

# Save configuration to UCI
save_config() {
    local enabled="$1"

    # Initialize UCI if needed
    init_uci_config

    # Convert boolean to UCI format
    local uci_enabled="yes"
    [ "$enabled" = "false" ] && uci_enabled="no"

    # Set UCI value
    uci set quecmanager.bridge_monitor.websocat_enabled="$uci_enabled"

    # Commit changes
    if ! uci commit quecmanager; then
        log_message "ERROR: Failed to commit UCI changes"
        return 1
    fi

    log_message "Saved config via UCI: enabled=$enabled"
    return 0
}

# Add bandwidth monitor to services init script
add_bandwidth_monitor_to_services() {
    if [ ! -f "$SERVICES_INIT" ]; then
        log_message "Services init file not found: $SERVICES_INIT"
        return 1
    fi

    # Check if bandwidth monitor is already present
    if grep -q "bridge_traffic_monitor" "$SERVICES_INIT" 2>/dev/null; then
        log_message "Bandwidth monitor already present in services"
        return 0
    fi

    local temp_file="/tmp/services_temp_$$"
    
    # Add bandwidth monitor block before "All QuecManager services Started"
    awk '
    /echo "All QuecManager services Started"/ {
        print "    # Start bandwidth monitor"
        print "    echo \"Starting Bandwidth Monitor...\""
        print "    procd_open_instance"
        print "    procd_set_param command /www/cgi-bin/services/bridge_traffic_monitor"
        print "    procd_set_param respawn"
        print "    procd_set_param stdout 1"
        print "    procd_set_param stderr 1"
        print "    procd_close_instance"
        print "    echo \"Bandwidth Monitor started\""
        print ""
    }
    { print }
    ' "$SERVICES_INIT" > "$temp_file"

    if [ -s "$temp_file" ]; then
        mv "$temp_file" "$SERVICES_INIT"
        chmod +x "$SERVICES_INIT"
        log_message "Added bandwidth monitor to services init script"
        return 0
    else
        rm -f "$temp_file"
        log_message "Failed to add bandwidth monitor to services"
        return 1
    fi
}

# Remove bandwidth monitor from services init script
remove_bandwidth_monitor_from_services() {
    if [ ! -f "$SERVICES_INIT" ]; then
        log_message "Services init file not found: $SERVICES_INIT"
        return 1
    fi

    # Check if bandwidth monitor is present
    if ! grep -q "bridge_traffic_monitor" "$SERVICES_INIT" 2>/dev/null; then
        log_message "Bandwidth monitor not present in services"
        return 0
    fi

    local temp_file="/tmp/services_temp_$$"
    
    # Remove the bandwidth monitor block
    awk '
    /# Start bandwidth monitor/ { skip=1; next }
    skip && /^$/ { skip=0; next }
    !skip { print }
    ' "$SERVICES_INIT" > "$temp_file"

    if [ -s "$temp_file" ]; then
        mv "$temp_file" "$SERVICES_INIT"
        chmod +x "$SERVICES_INIT"
        log_message "Removed bandwidth monitor from services init script"
        return 0
    else
        rm -f "$temp_file"
        log_message "Failed to remove bandwidth monitor from services"
        return 1
    fi
}

# Restart QuecManager services
restart_services() {
    log_message "Restarting QuecManager services..."
    
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

# Check if bandwidth monitor is running
is_bandwidth_monitor_running() {
    pgrep -f "bridge_traffic_monitor" >/dev/null 2>&1
}

# Handle GET request - Retrieve current settings
handle_get() {
    log_message "GET request received"
    get_config
    local running="false"
    if is_bandwidth_monitor_running; then
        running="true"
    fi
    send_success "Bandwidth monitoring configuration retrieved" "{\"enabled\":$ENABLED,\"running\":$running,\"isDefault\":$IS_DEFAULT}"
}

# Handle POST request - Update settings
handle_post() {
    log_message "POST request received"
    
    local content_length=${CONTENT_LENGTH:-0}
    if [ "$content_length" -eq 0 ]; then
        send_error "NO_DATA" "No data provided"
    fi

    # Read POST data
    local post_data=$(dd bs=$content_length count=1 2>/dev/null)
    log_message "Received POST data: $post_data"
    
    # Parse enabled from JSON
    local enabled=$(echo "$post_data" | sed -n 's/.*"enabled"[[:space:]]*:[[:space:]]*\([^,}]*\).*/\1/p' | tr -d ' "')

    # Validate input
    case "$enabled" in
        true|false) ;;
        *) send_error "INVALID_SETTING" "Invalid enabled value. Must be true or false." ;;
    esac

    # Get current config to compare
    get_config
    local prev_enabled="$ENABLED"

    # Save new configuration
    save_config "$enabled"

    # Handle service changes
    if [ "$enabled" = "true" ]; then
        # Enable bandwidth monitor
        add_bandwidth_monitor_to_services
        if [ "$prev_enabled" != "true" ]; then
            restart_services
        fi
    else
        # Disable bandwidth monitor
        # First, kill any running bandwidth monitor processes
        if is_bandwidth_monitor_running; then
            log_message "Stopping running bandwidth monitor..."
            pkill -f "bridge_traffic_monitor" 2>/dev/null || true
            sleep 1
        fi
        # Remove from services and restart
        remove_bandwidth_monitor_from_services
        restart_services
    fi

    # Return current status
    sleep 1  # Give services time to start/stop
    local running="false"
    if is_bandwidth_monitor_running; then
        running="true"
    fi

    send_success "Bandwidth monitoring setting updated successfully" "{\"enabled\":$enabled,\"running\":$running}"
}

# Handle DELETE request - Reset to default (enabled)
handle_delete() {
    log_message "DELETE request received"
    
    # Reset to default (enabled)
    save_config "true"
    
    # Ensure bandwidth monitor is running
    add_bandwidth_monitor_to_services
    
    # Only restart if not already running
    if ! is_bandwidth_monitor_running; then
        restart_services
    fi
    
    sleep 1
    local running="false"
    if is_bandwidth_monitor_running; then
        running="true"
    fi
    
    send_success "Bandwidth monitoring reset to default (enabled)" "{\"enabled\":true,\"running\":$running,\"isDefault\":true}"
}

# Main execution
log_message "Bandwidth settings script called with method: ${REQUEST_METHOD:-GET}"

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
        send_error "METHOD_NOT_ALLOWED" "HTTP method ${REQUEST_METHOD} not supported."
        ;;
esac
