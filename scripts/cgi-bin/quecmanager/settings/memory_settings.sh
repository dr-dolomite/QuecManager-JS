#!/bin/sh

# Memory Settings Configuration Script
# Manages memory service (enable/disable) and daemon settings

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
CONFIG_FILE="$CONFIG_DIR/memory_settings.conf"
FALLBACK_CONFIG_DIR="/tmp/quecmanager/settings"
FALLBACK_CONFIG_FILE="$FALLBACK_CONFIG_DIR/memory_settings.conf"
LOG_FILE="/tmp/memory_settings.log"
PID_FILE="/tmp/quecmanager/memory_daemon.pid"
# Prefer the new services location, fall back to the legacy path for compatibility
DAEMON_RELATIVE_PATHS="/cgi-bin/services/memory_daemon.sh"

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

# Determine daemon path (absolute) based on typical web root layouts
resolve_daemon_path() {
    # Common locations where CGI/WWW is mounted
    for rel in $DAEMON_RELATIVE_PATHS; do
        for base in \
            /www \
            /; do
            if [ -x "$base$rel" ]; then
                echo "$base$rel"
                return 0
            fi
        done
        # Also try as-is if busybox httpd cwd matches web root
        if [ -x "$rel" ]; then
            echo "$rel"
            return 0
        fi
    done
    # Nothing found; return first candidate as a best-effort path
    set -- $DAEMON_RELATIVE_PATHS
    echo "$1"
}

daemon_running() {
    if [ -f "$PID_FILE" ]; then
        pid="$(cat "$PID_FILE" 2>/dev/null || true)"
        if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

start_daemon() {
    # Ensure /tmp/quecmanager exists for PID
    [ -d "/tmp/quecmanager" ] || mkdir -p "/tmp/quecmanager"

    if daemon_running; then
        log_message "Daemon already running"
        return 0
    fi

    local daemon_path
    daemon_path="$(resolve_daemon_path)"
    if [ ! -x "$daemon_path" ]; then
        # Try to make it executable if present
        if [ -f "$daemon_path" ]; then
            chmod +x "$daemon_path" 2>/dev/null || true
        fi
    fi

    if [ -x "$daemon_path" ]; then
        nohup "$daemon_path" >/dev/null 2>&1 &
        log_message "Started memory daemon: $daemon_path (pid $!)"
        return 0
    else
        log_message "Daemon script not found or not executable: $daemon_path"
        return 1
    fi
}

stop_daemon() {
    if daemon_running; then
        pid="$(cat "$PID_FILE" 2>/dev/null || true)"
        if [ -n "${pid:-}" ]; then
            kill "$pid" 2>/dev/null || true
            sleep 0.2
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi
    rm -f "$PID_FILE" 2>/dev/null || true
}

# Get current memory setting
get_config_values() {
    # defaults
    ENABLED="true"
    INTERVAL="1"

    resolve_config_for_read
    if [ -f "$CONFIG_FILE" ]; then
        # Clean the config file if it contains comments (one-time cleanup)
        if grep -q "^#" "$CONFIG_FILE" 2>/dev/null; then
            log_message "Cleaning config file of comments"
            local temp_file="$CONFIG_FILE.clean.$$"
            grep -E "^MEMORY_(ENABLED|INTERVAL)=" "$CONFIG_FILE" > "$temp_file" 2>/dev/null || true
            if [ -s "$temp_file" ]; then
                mv "$temp_file" "$CONFIG_FILE" 2>/dev/null || rm -f "$temp_file"
                chmod 644 "$CONFIG_FILE" 2>/dev/null || true
            else
                rm -f "$temp_file"
            fi
        fi
        
        val=$(grep -E "^MEMORY_ENABLED=" "$CONFIG_FILE" | tail -n1 | cut -d'=' -f2)
        if [ -n "${val:-}" ]; then
            case "$val" in
                true|1|on|yes|enabled) ENABLED="true" ;;
                *) ENABLED="false" ;;
            esac
        fi
        val=$(grep -E "^MEMORY_INTERVAL=" "$CONFIG_FILE" | tail -n1 | cut -d'=' -f2)
        if echo "${val:-}" | grep -qE '^[0-9]+$'; then
            INTERVAL="$val"
        fi
    fi
}

# Save memory setting to config file
save_config() {
    local enabled="$1"
    local interval="$2"

    # Try primary directory first
    if mkdir -p "$CONFIG_DIR" 2>/dev/null; then
        local tmp="$CONFIG_FILE.tmp.$$"
        echo "MEMORY_ENABLED=$enabled" > "$tmp" || rm -f "$tmp" || return 1
        echo "MEMORY_INTERVAL=$interval" >> "$tmp" || rm -f "$tmp" || return 1
        if mv -f "$tmp" "$CONFIG_FILE" 2>/dev/null; then
            chmod 644 "$CONFIG_FILE" 2>/dev/null || true
            log_message "Saved memory config (primary): enabled=$enabled interval=$interval"
            return 0
        fi
    fi

    # Fallback to /tmp
    mkdir -p "$FALLBACK_CONFIG_DIR" 2>/dev/null || true
    local tmp2="$FALLBACK_CONFIG_FILE.tmp.$$"
    echo "MEMORY_ENABLED=$enabled" > "$tmp2" || rm -f "$tmp2" || return 1
    echo "MEMORY_INTERVAL=$interval" >> "$tmp2" || rm -f "$tmp2" || return 1
    mv -f "$tmp2" "$FALLBACK_CONFIG_FILE" 2>/dev/null || return 1
    chmod 644 "$FALLBACK_CONFIG_FILE" 2>/dev/null || true
    # Point CONFIG_FILE to fallback for subsequent reads in this request
    CONFIG_FILE="$FALLBACK_CONFIG_FILE"; CONFIG_DIR="$FALLBACK_CONFIG_DIR"
    log_message "Saved memory config (fallback): enabled=$enabled interval=$interval"
}

# Delete memory configuration (reset to default)
delete_memory_setting() {
    local removed=1
    for f in "$CONFIG_FILE" "$FALLBACK_CONFIG_FILE"; do
        if [ -f "$f" ]; then
            sed -i '/^MEMORY_ENABLED=/d' "$f" 2>/dev/null || true
            sed -i '/^MEMORY_INTERVAL=/d' "$f" 2>/dev/null || true
            log_message "Deleted memory configuration entries in $f"
            [ -s "$f" ] || { rm -f "$f" 2>/dev/null || true; log_message "Removed empty config file $f"; }
            removed=0
        fi
    done
    return $removed
}

# Handle POST request - Update memory setting
handle_post() {
    log_message "POST request received"
    
    # Read POST data
    local content_length=${CONTENT_LENGTH:-0}
    if [ "$content_length" -gt 0 ]; then
        local post_data=$(dd bs=$content_length count=1 2>/dev/null)
        log_message "Received POST data: $post_data"
        
        # Parse fields
        local enabled interval
        enabled=$(echo "$post_data" | sed -n 's/.*"enabled"[[:space:]]*:[[:space:]]*\([^,}]*\).*/\1/p' | tr -d ' ' | sed 's/"//g')
        interval=$(echo "$post_data" | sed -n 's/.*"interval"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p')

        # Defaults when missing
        [ -z "$enabled" ] && enabled="true"
        [ -z "$interval" ] && interval="1"

        # Validate
        case "$enabled" in
            true|false) : ;;
            *) send_error "INVALID_SETTING" "Invalid enabled value. Must be true or false." ;;
        esac
        if ! echo "$interval" | grep -qE '^[0-9]+$'; then
            send_error "INVALID_INTERVAL" "Interval must be a number (seconds)."
        fi
        if [ "$interval" -lt 1 ] || [ "$interval" -gt 10 ]; then
            send_error "INVALID_INTERVAL" "Interval must be between 1 and 10 seconds."
        fi

        # Capture previous values to decide on restart
        get_config_values
        local prev_enabled="$ENABLED"
        local prev_interval="$INTERVAL"

        save_config "$enabled" "$interval" || send_error "WRITE_FAILED" "Failed to save configuration"

        if [ "$enabled" = "true" ]; then
            if daemon_running; then
                # Restart only if effective parameters changed
                if [ "$prev_interval" != "$interval" ] || [ "$prev_enabled" != "$enabled" ]; then
                    log_message "Config change detected (interval/enabled). Restarting daemon."
                    stop_daemon
                    start_daemon || log_message "Failed to restart daemon"
                else
                    log_message "No change requiring restart; daemon remains running"
                fi
            else
                start_daemon || log_message "Failed to start daemon"
            fi
        else
            stop_daemon
        fi

        get_config_values
        local running=false
        if daemon_running; then running=true; fi
        send_success "Memory setting updated successfully" "{\"enabled\":$ENABLED,\"interval\":$INTERVAL,\"running\":$running}"
    else
        send_error "NO_DATA" "No data provided"
    fi
}

# Handle DELETE request - Reset to default (delete configuration)
handle_delete() {
    log_message "DELETE request received"
    stop_daemon
    if delete_memory_setting; then
        # Default is enabled
        send_success "Memory setting reset to default" "{\"enabled\":true,\"isDefault\":true,\"running\":false}"
    else
        send_error "NOT_FOUND" "Memory setting configuration not found"
    fi
}

# Main execution
log_message "Memory settings script called with method: ${REQUEST_METHOD:-GET}"

# Handle different HTTP methods
case "${REQUEST_METHOD:-GET}" in
    POST)
        handle_post
        ;;
    DELETE)
        handle_delete
        ;;
    *)
        send_error "METHOD_NOT_ALLOWED" "HTTP method ${REQUEST_METHOD} not supported. Use dedicated fetch script for reading settings."
        ;;
esac
