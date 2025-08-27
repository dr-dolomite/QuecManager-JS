#!/bin/sh

# Ping Settings Configuration Script
# Manages ping service (enable/disable) and daemon settings
# Author: dr-dolomite
# Date: 2025-08-04

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
PID_FILE="/tmp/quecmanager/ping_daemon.pid"
# Prefer the new services location, fall back to the legacy path for compatibility
DAEMON_RELATIVE_PATHS="/cgi-bin/services/ping_daemon.sh"

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
        log_message "Started ping daemon: $daemon_path (pid $!)"
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
    if daemon_running; then running=true; fi
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

        # Capture previous values to decide on restart
        get_config_values
        local prev_enabled="$ENABLED"
        local prev_host="$HOST"
        local prev_interval="$INTERVAL"

        save_config "$enabled" "$host" "$interval" || send_error "WRITE_FAILED" "Failed to save configuration"

        if [ "$enabled" = "true" ]; then
            if daemon_running; then
                # Restart only if effective parameters changed
                if [ "$prev_host" != "$host" ] || [ "$prev_interval" != "$interval" ] || [ "$prev_enabled" != "$enabled" ]; then
                    log_message "Config change detected (host/interval/enabled). Restarting daemon."
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
        send_success "Ping setting updated successfully" "{\"enabled\":$ENABLED,\"host\":\"$HOST\",\"interval\":$INTERVAL,\"running\":$running}"
    else
        send_error "NO_DATA" "No data provided"
    fi
}

# Handle DELETE request - Reset to default (delete configuration)
handle_delete() {
    log_message "DELETE request received"
    stop_daemon
    if delete_ping_setting; then
        # Default is enabled
        send_success "Ping setting reset to default" "{\"enabled\":true,\"isDefault\":true,\"running\":false}"
    else
        send_error "NOT_FOUND" "Ping setting configuration not found"
    fi
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
