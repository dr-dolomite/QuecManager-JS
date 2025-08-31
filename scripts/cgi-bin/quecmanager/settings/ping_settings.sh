#!/bin/sh

# Ping Settings Configuration Script
# Manages ping service (enable/disable) and daemon settings with dynamic service management
# Author: dr-dolomite
# Date: 2025-08-31

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
CONFIG_DIR="/etc/quecmanager/settings"
CONFIG_FILE="$CONFIG_DIR/ping_settings.conf"
FALLBACK_CONFIG_DIR="/tmp/quecmanager/settings"
FALLBACK_CONFIG_FILE="$FALLBACK_CONFIG_DIR/ping_settings.conf"
LOG_FILE="/tmp/ping_settings.log"
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

# Resolve config file for reading: prefer primary, then fallback
resolve_config_for_read() {
    if [ -f "$CONFIG_FILE" ]; then
        return 0
    elif [ -f "$FALLBACK_CONFIG_FILE" ]; then
        CONFIG_FILE="$FALLBACK_CONFIG_FILE"
        CONFIG_DIR="$FALLBACK_CONFIG_DIR"
        return 0
    fi
    # Default to primary path if none exist
    return 0
}

# Check if ping daemon is running
is_ping_daemon_running() {
    pgrep -f "ping_daemon.sh" >/dev/null 2>&1
}

# Get current ping setting
get_config_values() {
    # defaults
    ENABLED="true"
    HOST="8.8.8.8"
    INTERVAL="5"

    resolve_config_for_read
    if [ -f "$CONFIG_FILE" ]; then
        val=$(grep -E "^PING_ENABLED=" "$CONFIG_FILE" | tail -n1 | cut -d'=' -f2)
        if [ -n "${val:-}" ]; then
            case "$val" in
                true|1|on|yes|enabled) ENABLED="true" ;;
                *) ENABLED="false" ;;
            esac
        fi
        val=$(grep -E "^PING_HOST=" "$CONFIG_FILE" | tail -n1 | cut -d'=' -f2)
        [ -n "${val:-}" ] && HOST="$val"
        val=$(grep -E "^PING_INTERVAL=" "$CONFIG_FILE" | tail -n1 | cut -d'=' -f2)
        if echo "${val:-}" | grep -qE '^[0-9]+$'; then
            INTERVAL="$val"
        fi
    fi
}

# Save ping setting to config file
save_config() {
    local enabled="$1"
    local host="$2"
    local interval="$3"

    # Try primary directory first
    if mkdir -p "$CONFIG_DIR" 2>/dev/null; then
        local tmp="$CONFIG_FILE.tmp.$$"
        echo "PING_ENABLED=$enabled" > "$tmp" || rm -f "$tmp" || return 1
        echo "PING_HOST=$host" >> "$tmp" || rm -f "$tmp" || return 1
        echo "PING_INTERVAL=$interval" >> "$tmp" || rm -f "$tmp" || return 1
        if mv -f "$tmp" "$CONFIG_FILE" 2>/dev/null; then
            chmod 644 "$CONFIG_FILE" 2>/dev/null || true
            log_message "Saved ping config (primary): enabled=$enabled host=$host interval=$interval"
            return 0
        fi
    fi

    # Fallback to /tmp
    mkdir -p "$FALLBACK_CONFIG_DIR" 2>/dev/null || true
    local tmp2="$FALLBACK_CONFIG_FILE.tmp.$$"
    echo "PING_ENABLED=$enabled" > "$tmp2" || rm -f "$tmp2" || return 1
    echo "PING_HOST=$host" >> "$tmp2" || rm -f "$tmp2" || return 1
    echo "PING_INTERVAL=$interval" >> "$tmp2" || rm -f "$tmp2" || return 1
    mv -f "$tmp2" "$FALLBACK_CONFIG_FILE" 2>/dev/null || return 1
    chmod 644 "$FALLBACK_CONFIG_FILE" 2>/dev/null || true
    # Point CONFIG_FILE to fallback for subsequent reads in this request
    CONFIG_FILE="$FALLBACK_CONFIG_FILE"; CONFIG_DIR="$FALLBACK_CONFIG_DIR"
    log_message "Saved ping config (fallback): enabled=$enabled host=$host interval=$interval"
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

# Delete ping configuration (reset to default)
delete_ping_setting() {
    local removed=1
    for f in "$CONFIG_FILE" "$FALLBACK_CONFIG_FILE"; do
        if [ -f "$f" ]; then
            sed -i '/^PING_ENABLED=/d' "$f" 2>/dev/null || true
            sed -i '/^PING_HOST=/d' "$f" 2>/dev/null || true
            sed -i '/^PING_INTERVAL=/d' "$f" 2>/dev/null || true
            log_message "Deleted ping configuration entries in $f"
            [ -s "$f" ] || { rm -f "$f" 2>/dev/null || true; log_message "Removed empty config file $f"; }
            removed=0
        fi
    done
    return $removed
}

# Handle GET request - Retrieve ping setting
handle_get() {
    log_message "GET request received"
    get_config_values
    local running=false
    if is_ping_daemon_running; then running=true; fi
    local is_default=true
    if [ -f "$CONFIG_FILE" ] && grep -q "^PING_ENABLED=" "$CONFIG_FILE"; then
        is_default=false
    fi
    send_success "Ping configuration retrieved" "{\"enabled\":$ENABLED,\"host\":\"$HOST\",\"interval\":$INTERVAL,\"running\":$running,\"isDefault\":$is_default}"
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
