#!/bin/sh

# Data Usage Configuration Manager for OpenWRT
# Uses only built-in OpenWRT functions, no external dependencies

# Simple fallback logging (avoid external logger dependency for now)
log_msg() {
    echo "$(date): config_manager: $1" >> /tmp/config_debug.log 2>/dev/null || true
}

# Fallback logging functions for compatibility
qm_log_info() { log_msg "INFO: $4"; }
qm_log_error() { log_msg "ERROR: $4"; }
qm_log_debug() { log_msg "DEBUG: $4"; }
qm_log_warn() { log_msg "WARN: $4"; }

# Script identification for logging
SCRIPT_NAME="data_usage_config"
LOG_CATEGORY="services"

# Configuration file path
CONFIG_DIR="/etc/quecmanager"
CONFIG_FILE="$CONFIG_DIR/data_usage"

# Default configuration values
DEFAULT_LIMIT="10737418240"  # 10GB in bytes
DEFAULT_BACKUP_INTERVAL="12"  # hours
DEFAULT_RESET_DAY="1"  # 1st day of month
DEFAULT_WARNING_THRESHOLD="90"  # 90% of limit

# Ensure directories exist
create_directories() {
    # Try to create directories, ignore errors if they already exist or can't be created
    [ ! -d "$CONFIG_DIR" ] && mkdir -p "$CONFIG_DIR" 2>/dev/null
    
    # Set permissions if directories were created successfully
    [ -d "$CONFIG_DIR" ] && chmod 755 "$CONFIG_DIR" 2>/dev/null
}

# Initialize directories
create_directories

# Send HTTP error response
send_error() {
    local message="$1"
    local code="${2:-500}"
    log_msg "HTTP $code error: $message"
    echo "Status: $code"
    echo "Content-Type: application/json"
    echo ""
    printf '{"error": "%s", "code": %d}\n' "$message" "$code"
    exit 1
}

# Initialize default config if not exists (only used for very first run)
init_config() {
    # This function should only be used for initial setup, not for regular operations
    # Regular enable/disable should use recreate_config() instead
    if [ ! -f "$CONFIG_FILE" ]; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Creating initial config file (first run)"
        recreate_config "false"
    fi
}

# Recreate config file (primary function for enable/disable operations)
recreate_config() {
    local enabled_state="${1:-false}"
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Creating config file with enabled=$enabled_state"
    
    # Get existing stored values before removing config (if any)
    local existing_stored_upload=0
    local existing_stored_download=0
    if [ -f "$CONFIG_FILE" ]; then
        existing_stored_upload=$(get_config "STORED_UPLOAD")
        existing_stored_download=$(get_config "STORED_DOWNLOAD")
        existing_stored_upload=${existing_stored_upload:-0}
        existing_stored_download=${existing_stored_download:-0}
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Preserving existing stored values: upload=$existing_stored_upload, download=$existing_stored_download"
    fi
    
    # Remove old config
    rm -f "$CONFIG_FILE" 2>/dev/null
    
    # Get current session usage
    local current_session=$(get_session_usage)
    qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Session usage JSON: $current_session"
    
    local session_upload=$(echo "$current_session" | sed 's/.*"upload":\([0-9]*\).*/\1/')
    local session_download=$(echo "$current_session" | sed 's/.*"download":\([0-9]*\).*/\1/')
    local init_timestamp=$(date +%s)
    
    # Set defaults if parsing failed
    session_upload=${session_upload:-0}
    session_download=${session_download:-0}
    
    # Calculate final stored values based on enabled state
    local final_stored_upload=0
    local final_stored_download=0
    
    if [ "$enabled_state" = "true" ]; then
        # ENABLING: Start fresh tracking - modem counter daemon will handle accumulation
        final_stored_upload=0
        final_stored_download=0
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Enabling: Starting fresh tracking, modem counter daemon will handle accumulation"
    else
        # DISABLING: Preserve the final accumulated totals from modem counter daemon
        local counter_file="/tmp/quecmanager/modem_counter.json"
        if [ -f "$counter_file" ] && [ -r "$counter_file" ]; then
            local counter_data=$(cat "$counter_file" 2>/dev/null)
            if [ -n "$counter_data" ]; then
                final_stored_upload=$(echo "$counter_data" | sed 's/.*"upload":\([0-9]*\).*/\1/')
                final_stored_download=$(echo "$counter_data" | sed 's/.*"download":\([0-9]*\).*/\1/')
                final_stored_upload=${final_stored_upload:-0}
                final_stored_download=${final_stored_download:-0}
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Disabling: Preserving final totals from modem counter: upload=$final_stored_upload, download=$final_stored_download"
            fi
        fi
        
        # Fallback to previous logic if counter daemon data not available
        if [ "$final_stored_upload" -eq 0 ] && [ "$final_stored_download" -eq 0 ]; then
            final_stored_upload=$((existing_stored_upload + session_upload))
            final_stored_download=$((existing_stored_download + session_download))
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Disabling: Fallback preservation: existing($existing_stored_upload + $existing_stored_download) + session($session_upload + $session_download) = total($final_stored_upload + $final_stored_download)"
        fi
    fi
    
    # Ensure parent directory exists
    create_directories
    
    # Create new config file with accumulated stored values
    if cat > "$CONFIG_FILE" 2>/dev/null << EOF
# Data Usage Tracking Configuration
# Recreated on $(date)

ENABLED=$enabled_state
MONTHLY_LIMIT=$DEFAULT_LIMIT
BACKUP_INTERVAL=$DEFAULT_BACKUP_INTERVAL
RESET_DAY=$DEFAULT_RESET_DAY
WARNING_THRESHOLD=$DEFAULT_WARNING_THRESHOLD
STORED_UPLOAD=$final_stored_upload
STORED_DOWNLOAD=$final_stored_download
LAST_BACKUP=$init_timestamp
LAST_MONTHLY_RESET=
WARNING_SHOWN=false
WARNING_THRESHOLD_SHOWN=false
WARNING_OVERLIMIT_SHOWN=false
EOF
    then
        chmod 644 "$CONFIG_FILE" 2>/dev/null
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Recreated configuration with accumulated stored values: upload=$final_stored_upload, download=$final_stored_download"
        
        # Control services based on enabled state with proper coordination
        coordinate_services "$enabled_state"
        
        return 0
    else
        qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to recreate config file: $CONFIG_FILE"
        return 1
    fi
}

# Read configuration value
get_config() {
    local key="$1"
    # Don't auto-create config file, just return empty if it doesn't exist
    if [ ! -f "$CONFIG_FILE" ]; then
        echo ""
        return 1
    fi
    grep "^$key=" "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | head -1
}

# Set configuration value
set_config() {
    local key="$1"
    local value="$2"
    
    # Only work with existing config files, don't auto-create
    if [ ! -f "$CONFIG_FILE" ]; then
        qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Config file does not exist, cannot set $key"
        return 1
    fi
    
    # Update existing key or append new one
    if grep -q "^$key=" "$CONFIG_FILE" 2>/dev/null; then
        # Use a temporary file for safer updates
        local temp_file="${CONFIG_FILE}.tmp.$$"
        if sed "s/^$key=.*/$key=$value/" "$CONFIG_FILE" > "$temp_file" 2>/dev/null; then
            if mv "$temp_file" "$CONFIG_FILE" 2>/dev/null; then
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Updated $key=$value"
            else
                qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to update config file"
                rm -f "$temp_file" 2>/dev/null
                return 1
            fi
        else
            qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to process config file"
            rm -f "$temp_file" 2>/dev/null
            return 1
        fi
    else
        # Append new key-value pair
        if echo "$key=$value" >> "$CONFIG_FILE" 2>/dev/null; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Added $key=$value"
        else
            qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to append to config file"
            return 1
        fi
    fi
}

# Parse JSON value from POST data (simple parser without jq)
parse_json_value() {
    local json="$1"
    local key="$2"
    
    # Extract value for the given key using sed
    echo "$json" | sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\([^,}]*\).*/\1/p" | tr -d '"' | tr -d ' '
}

# Normalize boolean values to "true" or "false"
normalize_boolean() {
    local value="$1"
    case "$value" in
        "true"|"1") echo "true" ;;
        "false"|"0") echo "false" ;;
        *) echo "false" ;;
    esac
}

# Helper function to send JSON HTTP response headers (now just a placeholder)
send_json_headers() {
    # Headers already sent by main function
    return 0
}

# Helper function to build config+usage JSON response
build_config_usage_response() {
    local usage_data="$1"
    local override_enabled="$2"  # Optional: override enabled state
    
    # Get all config values
    local enabled=$(get_config "ENABLED")
    local monthly_limit=$(get_config "MONTHLY_LIMIT")
    local backup_interval=$(get_config "BACKUP_INTERVAL")
    local auto_backup_enabled=$(get_config "AUTO_BACKUP_ENABLED")
    local reset_day=$(get_config "RESET_DAY")
    local warning_threshold=$(get_config "WARNING_THRESHOLD")
    local warning_shown=$(get_config "WARNING_SHOWN")
    local warning_threshold_shown=$(get_config "WARNING_THRESHOLD_SHOWN")
    local warning_overlimit_shown=$(get_config "WARNING_OVERLIMIT_SHOWN")
    local last_backup=$(get_config "LAST_BACKUP")

    # Override enabled state if provided
    if [ -n "$override_enabled" ]; then
        enabled="$override_enabled"
    fi

    # Set defaults - use constants when config file doesn't exist
    if [ ! -f "$CONFIG_FILE" ]; then
        enabled=${enabled:-false}
        monthly_limit=${DEFAULT_LIMIT:-10737418240}
        backup_interval=${DEFAULT_BACKUP_INTERVAL:-12}
        auto_backup_enabled=${auto_backup_enabled:-false}
        reset_day=${DEFAULT_RESET_DAY:-1}
        warning_threshold=${DEFAULT_WARNING_THRESHOLD:-90}
    else
        enabled=${enabled:-true}
        monthly_limit=${monthly_limit:-10737418240}
        backup_interval=${backup_interval:-12}
        auto_backup_enabled=${auto_backup_enabled:-false}
        reset_day=${reset_day:-1}
        warning_threshold=${warning_threshold:-90}
    fi
    
    warning_shown=${warning_shown:-false}
    warning_threshold_shown=${warning_threshold_shown:-false}
    warning_overlimit_shown=${warning_overlimit_shown:-false}
    last_backup=${last_backup:-0}

    # Build complete JSON response
    printf '{
    "config": {
        "enabled": %s,
        "monthlyLimit": %s,
        "backupInterval": %s,
        "autoBackupEnabled": %s,
        "resetDay": %s,
        "warningThreshold": %s,
        "warningShown": %s,
        "warningThresholdShown": %s,
        "warningOverlimitShown": %s,
        "lastBackup": %s
    },
    "usage": %s
}' "$enabled" "$monthly_limit" "$backup_interval" "$auto_backup_enabled" "$reset_day" "$warning_threshold" "$warning_shown" "$warning_threshold_shown" "$warning_overlimit_shown" "$last_backup" "$usage_data"
}

# Helper function to send successful JSON response
send_json_response() {
    local usage_data="$1"
    local override_enabled="$2"  # Optional: override enabled state
    send_json_headers
    build_config_usage_response "$usage_data" "$override_enabled"
}

# Helper function to handle GET actions based on query string
handle_get_action() {
    local query_string="$1"
    
    case "$query_string" in
        *"action=reset"*)
            # Reset both daemon and config values
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Manual reset requested"
            
            # Reset the modem counter daemon
            reset_modem_counter_daemon
            
            # Reset config file values for consistency
            set_config "STORED_UPLOAD" "0"
            set_config "STORED_DOWNLOAD" "0"
            set_config "WARNING_SHOWN" "false"
            set_config "WARNING_THRESHOLD_SHOWN" "false"
            set_config "WARNING_OVERLIMIT_SHOWN" "false"
            # Clear monthly reset marker to allow reset again if needed
            set_config "LAST_MONTHLY_RESET" ""
            
            send_json_headers
            printf '{"status": "success", "message": "Usage data reset successfully"}\n'
            ;;
        *"action=backup"*)
            create_backup
            send_json_headers
            printf '{"status": "success", "message": "Backup created successfully"}\n'
            ;;
        *"action=toggle_backup"*)
            # Handle backup service toggle
            local enabled_param
            if echo "$query_string" | grep -q "enabled=true"; then
                enabled_param="true"
            elif echo "$query_string" | grep -q "enabled=false"; then
                enabled_param="false"
            else
                send_json_headers
                printf '{"status": "error", "message": "Missing enabled parameter"}\n'
                exit 1
            fi
            
            toggle_backup_service "$enabled_param"
            ;;
        *"action=get_current_usage"*)
            # Only process if tracking is enabled (config file exists)
            if [ -f "$CONFIG_FILE" ]; then
                check_monthly_reset
                local current_usage=$(get_current_usage)
                send_json_response "$current_usage"
            else
                # Return disabled state
                local disabled_usage='{"upload":0,"download":0,"total":0}'
                send_json_response "$disabled_usage" "false"
            fi
            ;;
        *"action=get_session_usage"*)
            local session_usage=$(parse_modem_data)
            send_json_response "$session_usage"
            ;;
        *"action=get_config"*)
            # Return current configuration and usage (same as default)
            handle_default_get
            ;;
        *"action=service_status"*)
            # Return service status
            send_json_headers
            printf '{\n'
            printf '  "service": {\n'
            
            # Check if daemon is running
            if [ -f "/var/run/data_usage_backup.pid" ]; then
                local pid=$(cat /var/run/data_usage_backup.pid 2>/dev/null)
                if kill -0 "$pid" 2>/dev/null; then
                    printf '    "daemon_running": true,\n'
                    printf '    "daemon_pid": %s,\n' "$pid"
                else
                    printf '    "daemon_running": false,\n'
                    printf '    "daemon_pid": null,\n'
                fi
            else
                printf '    "daemon_running": false,\n'
                printf '    "daemon_pid": null,\n'
            fi
            
            # Check daemon log
            if [ -f "/tmp/data_usage_daemon.log" ]; then
                printf '    "log_exists": true,\n'
                local last_log=$(tail -1 /tmp/data_usage_daemon.log 2>/dev/null)
                printf '    "last_log": "%s"\n' "$last_log"
            else
                printf '    "log_exists": false,\n'
                printf '    "last_log": null\n'
            fi
            
            printf '  }\n'
            printf '}\n'
            ;;
        *)
            # Default: return current configuration and usage
            handle_default_get
            ;;
    esac
}

# Helper function to handle default GET request
handle_default_get() {
    # Check if config exists (feature enabled) or return disabled state
    if [ ! -f "$CONFIG_FILE" ]; then
        # Feature is disabled (no config file)
        local disabled_usage='{"upload":0,"download":0,"total":0}'
        send_json_response "$disabled_usage" "false"
    else
        # Feature is enabled, return actual config and usage
        check_monthly_reset
        local current_usage=$(get_current_usage)
        send_json_response "$current_usage"
    fi
}

# Parse modem data from data_usage.json file (shared function)
parse_modem_data() {
    local logfile="/www/signal_graphs/data_usage.json"
    
    if [ ! -f "$logfile" ]; then
        qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Data usage file not found: $logfile"
        printf '{"upload":0,"download":0,"total":0}'
        return
    fi
    
    # Get the last complete JSON entry - need to handle multi-line entries
    # Use awk to extract the last complete JSON object from the array
    local last_entry=$(awk '
        BEGIN { in_object = 0; object = ""; brace_count = 0 }
        /^\s*\{/ { 
            in_object = 1; 
            brace_count = 1; 
            object = $0; 
            next 
        }
        in_object == 1 {
            object = object "\n" $0
            # Count braces to find the end of the object
            for (i = 1; i <= length($0); i++) {
                char = substr($0, i, 1)
                if (char == "{") brace_count++
                if (char == "}") brace_count--
            }
            if (brace_count == 0) {
                last_object = object
                in_object = 0
                object = ""
            }
        }
        END { if (last_object) print last_object }
    ' "$logfile")
    
    if [ -z "$last_entry" ]; then
        qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "No complete JSON entries found in data file"
        printf '{"upload":0,"download":0,"total":0}'
        return
    fi
    
    qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Found complete entry (first 100 chars): $(echo "$last_entry" | dd bs=100 count=1 2>/dev/null)..."
    
    # Extract the output field from the JSON entry
    local output_data=$(echo "$last_entry" | sed 's/.*"output"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    
    if [ -z "$output_data" ] || [ "$output_data" = "$last_entry" ]; then
        qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to extract output data from JSON entry"
        printf '{"upload":0,"download":0,"total":0}'
        return
    fi
    
    qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Extracted output data (first 100 chars): $(echo "$output_data" | dd bs=100 count=1 2>/dev/null)..."
    
    # Convert escaped newlines to actual newlines for parsing
    output_data=$(echo "$output_data" | sed 's/\\r\\n/\n/g')
    
    qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "After newline conversion (first 100 chars): $(echo "$output_data" | dd bs=100 count=1 2>/dev/null)..."
    
    # Parse LTE data (QGDCNT) - format: +QGDCNT: sent,received
    local lte_line=$(echo "$output_data" | grep "+QGDCNT:" | head -1)
    local lte_sent=0
    local lte_received=0
    
    if [ -n "$lte_line" ]; then
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Found LTE line: $lte_line"
        # Extract numbers after colon, handle spaces and commas
        local lte_numbers=$(echo "$lte_line" | sed 's/.*+QGDCNT:[[:space:]]*\([0-9,[:space:]]*\).*/\1/')
        lte_sent=$(echo "$lte_numbers" | cut -d',' -f1 | tr -d ' ')
        lte_received=$(echo "$lte_numbers" | cut -d',' -f2 | tr -d ' ')
        
        # Ensure we have valid numbers
        lte_sent=${lte_sent:-0}
        lte_received=${lte_received:-0}
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "LTE numbers: $lte_numbers -> sent=$lte_sent, received=$lte_received"
    else
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "No LTE data found"
    fi
    
    # Parse NR data (QGDNRCNT) - format: +QGDNRCNT: sent,received  
    local nr_line=$(echo "$output_data" | grep "+QGDNRCNT:" | head -1)
    local nr_sent=0
    local nr_received=0
    
    if [ -n "$nr_line" ]; then
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Found NR line: $nr_line"
        # Extract numbers after colon, handle spaces and commas
        local nr_numbers=$(echo "$nr_line" | sed 's/.*+QGDNRCNT:[[:space:]]*\([0-9,[:space:]]*\).*/\1/')
        nr_sent=$(echo "$nr_numbers" | cut -d',' -f1 | tr -d ' ')
        nr_received=$(echo "$nr_numbers" | cut -d',' -f2 | tr -d ' ')
        
        # Ensure we have valid numbers
        nr_sent=${nr_sent:-0}
        nr_received=${nr_received:-0}
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "NR numbers: $nr_numbers -> sent=$nr_sent, received=$nr_received"
    else
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "No NR data found"
    fi
    
    # Calculate totals (ensure arithmetic works with large numbers)
    local total_upload=0
    local total_download=0
    
    # Use bc if available for large number arithmetic, otherwise use shell
    if command -v bc >/dev/null 2>&1; then
        total_upload=$(echo "${lte_sent:-0} + ${nr_sent:-0}" | bc 2>/dev/null || echo $((${lte_sent:-0} + ${nr_sent:-0})))
        total_download=$(echo "${lte_received:-0} + ${nr_received:-0}" | bc 2>/dev/null || echo $((${lte_received:-0} + ${nr_received:-0})))
    else
        total_upload=$((${lte_sent:-0} + ${nr_sent:-0}))
        total_download=$((${lte_received:-0} + ${nr_received:-0}))
    fi
    
    local total_usage=$((total_upload + total_download))
    
    # Log the parsed values for debugging
    qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Parsed LTE: sent=$lte_sent, received=$lte_received"
    qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Parsed NR: sent=$nr_sent, received=$nr_received"
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Session totals: upload=$total_upload, download=$total_download"
    
    printf '{"upload":%s,"download":%s,"total":%s}' "$total_upload" "$total_download" "$total_usage"
}

# Get current session data usage (without stored values)
get_session_usage() {
    parse_modem_data
}
get_current_usage() {
    # The modem counter daemon already handles accumulation and counter resets
    # We just need to read the current accumulated values from it
    local counter_file="/tmp/quecmanager/modem_counter.json"
    
    if [ -f "$counter_file" ] && [ -r "$counter_file" ]; then
        # Read the accumulated data from modem counter daemon
        local counter_data=$(cat "$counter_file" 2>/dev/null)
        
        if [ -n "$counter_data" ] && echo "$counter_data" | grep -q '"enabled":true'; then
            # Extract values from counter daemon (these are already accumulated)
            local daemon_upload=$(echo "$counter_data" | sed 's/.*"upload":\([0-9]*\).*/\1/')
            local daemon_download=$(echo "$counter_data" | sed 's/.*"download":\([0-9]*\).*/\1/')
            local daemon_total=$(echo "$counter_data" | sed 's/.*"total":\([0-9]*\).*/\1/')
            
            # Use daemon values as they already handle accumulation properly
            daemon_upload=${daemon_upload:-0}
            daemon_download=${daemon_download:-0}
            daemon_total=${daemon_total:-0}
            
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Using accumulated values from modem counter daemon: upload=$daemon_upload, download=$daemon_download, total=$daemon_total"
            
            printf '{"upload":%s,"download":%s,"total":%s}' "$daemon_upload" "$daemon_download" "$daemon_total"
            return
        fi
    fi
    
    # Fallback: if counter daemon is not available, use session data without additional accumulation
    local session_usage=$(parse_modem_data)
    
    # Parse the JSON values from session
    local session_upload=$(echo "$session_usage" | sed 's/.*"upload":\([0-9]*\).*/\1/')
    local session_download=$(echo "$session_usage" | sed 's/.*"download":\([0-9]*\).*/\1/')
    local session_total=$((${session_upload:-0} + ${session_download:-0}))
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Fallback to session data: upload=$session_upload, download=$session_download, total=$session_total"
    
    printf '{"upload":%s,"download":%s,"total":%s}' "$session_upload" "$session_download" "$session_total"
}

# Reset the modem counter daemon's accumulated values
reset_modem_counter_daemon() {
    local counter_file="/tmp/quecmanager/modem_counter.json"
    local counter_control_file="/tmp/quecmanager/modem_counter_control"
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Attempting to reset modem counter daemon accumulated values"
    
    # Method 1: Try to send reset signal via control file (if daemon supports it)
    if echo "RESET_MONTHLY" > "$counter_control_file" 2>/dev/null; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Sent reset signal to modem counter daemon via control file"
        
        # Wait a moment for daemon to process the signal
        sleep 2
        
        # Check if reset was successful by reading the counter file
        if [ -f "$counter_file" ]; then
            local counter_data=$(cat "$counter_file" 2>/dev/null)
            if [ -n "$counter_data" ]; then
                local daemon_upload=$(echo "$counter_data" | sed 's/.*"upload":\([0-9]*\).*/\1/')
                local daemon_download=$(echo "$counter_data" | sed 's/.*"download":\([0-9]*\).*/\1/')
                daemon_upload=${daemon_upload:-0}
                daemon_download=${daemon_download:-0}
                
                if [ "$daemon_upload" -eq 0 ] && [ "$daemon_download" -eq 0 ]; then
                    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Modem counter daemon reset successful"
                    return 0
                else
                    qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Daemon reset may not have worked, values still: upload=$daemon_upload, download=$daemon_download"
                fi
            fi
        fi
    fi
    
    # Method 2: Restart the modem counter service to reset accumulated values
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Attempting daemon reset via service restart"
    
    if /etc/init.d/quecmanager_modem_counter restart >/dev/null 2>&1; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Modem counter service restarted for reset"
        
        # Wait for service to start up
        sleep 3
        
        # Verify reset was successful
        if [ -f "$counter_file" ]; then
            local counter_data=$(cat "$counter_file" 2>/dev/null)
            if [ -n "$counter_data" ]; then
                local daemon_upload=$(echo "$counter_data" | sed 's/.*"upload":\([0-9]*\).*/\1/')
                local daemon_download=$(echo "$counter_data" | sed 's/.*"download":\([0-9]*\).*/\1/')
                daemon_upload=${daemon_upload:-0}
                daemon_download=${daemon_download:-0}
                
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "After service restart: upload=$daemon_upload, download=$daemon_download"
            fi
        fi
        
        return 0
    else
        qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to restart modem counter service for reset"
        return 1
    fi
}

# Check if monthly reset is needed
check_monthly_reset() {
    local reset_day=$(get_config "RESET_DAY")
    local current_day=$(date +%d | sed 's/^0*//')
    local current_time=$(date +%s)
    
    reset_day=${reset_day:-1}
    
    # Simple monthly reset: only reset on the exact reset day of each month
    # This prevents multiple resets in the same month
    if [ "$current_day" -eq "$reset_day" ]; then
        # Check if we already reset today by checking if daemon has accumulated significant data
        # or by checking a reset marker in config
        local reset_marker=$(get_config "LAST_MONTHLY_RESET")
        local current_month=$(date +%Y%m)
        
        # Only reset if we haven't reset this month yet
        if [ "$reset_marker" != "$current_month" ]; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Performing monthly reset on day $current_day (reset day: $reset_day)"
            
            # Reset the modem counter daemon by sending it a reset signal
            reset_modem_counter_daemon
            
            # Reset config file values for consistency (warnings, etc.)
            set_config "STORED_UPLOAD" "0"
            set_config "STORED_DOWNLOAD" "0"
            set_config "WARNING_SHOWN" "false"
            set_config "WARNING_THRESHOLD_SHOWN" "false"
            set_config "WARNING_OVERLIMIT_SHOWN" "false"
            set_config "LAST_MONTHLY_RESET" "$current_month"
            
            return 0
        else
            qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Monthly reset already performed this month (day $current_day)"
        fi
    else
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Monthly reset not needed (current day: $current_day, reset day: $reset_day)"
    fi
    
    return 1
}

# Create backup of current usage with daemon-compatible logic
# Manual backup function - communicates with modem counter daemon
create_backup() {
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Manual backup requested - triggering daemon backup"
    
    # With the new architecture, the modem counter daemon handles all accumulation
    # Manual backup now means: force the daemon to save its current state
    
    local counter_file="/tmp/quecmanager/modem_counter.json"
    local counter_control_file="/tmp/quecmanager/modem_counter_control"
    
    # Method 1: Try to send backup signal to daemon via control file
    if echo "BACKUP_NOW" > "$counter_control_file" 2>/dev/null; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Sent backup signal to modem counter daemon"
        
        # Wait for daemon to process
        sleep 1
        
        # Verify backup by reading current daemon state
        if [ -f "$counter_file" ] && [ -r "$counter_file" ]; then
            local counter_data=$(cat "$counter_file" 2>/dev/null)
            if [ -n "$counter_data" ]; then
                local daemon_upload=$(echo "$counter_data" | sed 's/.*"upload":\([0-9]*\).*/\1/')
                local daemon_download=$(echo "$counter_data" | sed 's/.*"download":\([0-9]*\).*/\1/')
                daemon_upload=${daemon_upload:-0}
                daemon_download=${daemon_download:-0}
                
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Daemon backup completed: upload=$daemon_upload, download=$daemon_download"
                
                # Update LAST_BACKUP timestamp for consistency
                set_config "LAST_BACKUP" "$(date +%s)"
                return 0
            fi
        fi
    fi
    
    # Method 2: Fallback - just update the backup timestamp since daemon handles the data
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup fallback - updating timestamp (daemon handles data persistence)"
    
    if [ -f "$counter_file" ] && [ -r "$counter_file" ]; then
        local counter_data=$(cat "$counter_file" 2>/dev/null)
        if [ -n "$counter_data" ]; then
            local daemon_upload=$(echo "$counter_data" | sed 's/.*"upload":\([0-9]*\).*/\1/')
            local daemon_download=$(echo "$counter_data" | sed 's/.*"download":\([0-9]*\).*/\1/')
            daemon_upload=${daemon_upload:-0}
            daemon_download=${daemon_download:-0}
            
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Manual backup noted current daemon state: upload=$daemon_upload, download=$daemon_download"
        fi
    fi
    
    # Update backup timestamp regardless
    set_config "LAST_BACKUP" "$(date +%s)"
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Manual backup completed (daemon-based architecture)"
}

# Toggle backup service (enable/disable procd service)
toggle_backup_service() {
    local enabled="$1"
    
    if [ "$enabled" = "true" ]; then
        # Enable and start the service
        if /etc/init.d/quecmanager_data_usage enable >/dev/null 2>&1; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service enabled successfully"
            
            if /etc/init.d/quecmanager_data_usage start >/dev/null 2>&1; then
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service started successfully"
                send_json_headers
                printf '{"status": "success", "message": "Backup service enabled and started"}\n'
            else
                qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service enabled but failed to start"
                send_json_headers
                printf '{"status": "success", "message": "Backup service enabled but failed to start"}\n'
            fi
        else
            qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to enable backup service"
            send_json_headers
            printf '{"status": "error", "message": "Failed to enable backup service"}\n'
        fi
    else
        # Stop and disable the service
        /etc/init.d/quecmanager_data_usage stop >/dev/null 2>&1
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service stopped"
        
        if /etc/init.d/quecmanager_data_usage disable >/dev/null 2>&1; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service disabled successfully"
            send_json_headers
            printf '{"status": "success", "message": "Backup service stopped and disabled"}\n'
        else
            qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service stopped but failed to disable"
            send_json_headers
            printf '{"status": "success", "message": "Backup service stopped but failed to disable"}\n'
        fi
    fi
}

# Restart services when configuration changes require it
restart_services_if_needed() {
    local config_changed="$1"  # Which config changed: "interval", "enabled", etc.
    local old_value="$2"       # Previous value
    local new_value="$3"       # New value
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Config change detected: $config_changed changed from '$old_value' to '$new_value'"
    
    case "$config_changed" in
        "interval")
            # Backup interval changed - restart backup daemon if enabled
            local enabled=$(get_config "ENABLED")
            if [ "$enabled" = "true" ]; then
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Restarting backup daemon due to interval change"
                # Use background restart to avoid blocking CGI response, but ensure coordination
                ( 
                    # Wait a moment to let current request complete
                    sleep 1
                    # Restart just the backup service (modem counter doesn't need restart for interval change)
                    /etc/init.d/quecmanager_data_usage restart >/dev/null 2>&1
                    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup daemon restart completed"
                ) &
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup daemon restart initiated in background"
            else
                qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Tracking disabled, backup daemon restart skipped"
            fi
            ;;
        "enabled")
            # Enabled state changed - this should be handled by coordinate_services in recreate_config
            if [ "$new_value" = "true" ]; then
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Services will be enabled via coordinate_services"
            else
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Services will be disabled via coordinate_services"
            fi
            ;;
        *)
            qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "No service restart needed for $config_changed change"
            ;;
    esac
}

# Coordinate service startup/shutdown with proper sequencing to prevent race conditions
coordinate_services() {
    local enabled_state="$1"
    
    if [ "$enabled_state" = "true" ]; then
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Enabling services with proper coordination"
        
        # Step 1: Start modem counter service first (it's the data source)
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Starting modem counter service..."
        toggle_modem_counter_service "true"
        
        # Step 2: Wait for modem counter service to be ready
        local counter_ready=false
        local wait_count=0
        local max_wait=10
        
        while [ $wait_count -lt $max_wait ]; do
            if wait_for_modem_counter_ready; then
                counter_ready=true
                break
            fi
            
            wait_count=$((wait_count + 1))
            qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Waiting for modem counter service... attempt $wait_count/$max_wait"
            sleep 1
        done
        
        if [ "$counter_ready" = "true" ]; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Modem counter service is ready"
            
            # Step 3: Now start backup service (depends on modem counter)
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Starting backup service..."
            /etc/init.d/quecmanager_data_usage restart >/dev/null 2>&1
            
            # Give backup service a moment to start
            sleep 2
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Service coordination completed - both services should be running"
        else
            qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Modem counter service not ready after ${max_wait}s, starting backup service anyway"
            /etc/init.d/quecmanager_data_usage restart >/dev/null 2>&1
        fi
        
    else
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Disabling services with proper coordination"
        
        # Step 1: Stop backup service first (depends on modem counter)
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Stopping backup service..."
        /etc/init.d/quecmanager_data_usage stop >/dev/null 2>&1
        
        # Step 2: Stop modem counter service
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Stopping modem counter service..."
        toggle_modem_counter_service "false"
        
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Service shutdown coordination completed"
    fi
}

# Wait for modem counter service to be ready (counter file exists and is readable)
wait_for_modem_counter_ready() {
    local counter_file="/tmp/quecmanager/modem_counter.json"
    
    # Check if counter file exists and has valid content
    if [ -f "$counter_file" ] && [ -r "$counter_file" ]; then
        local counter_data=$(cat "$counter_file" 2>/dev/null)
        if [ -n "$counter_data" ] && echo "$counter_data" | grep -q '"enabled":true'; then
            # File exists and has valid JSON with enabled state
            qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Modem counter service appears ready"
            return 0
        fi
    fi
    
    return 1
}

# Toggle modem counter service (enable/disable procd service)
toggle_modem_counter_service() {
    local enabled="$1"
    
    if [ "$enabled" = "true" ]; then
        # Enable and start the modem counter service
        if /etc/init.d/quecmanager_modem_counter enable >/dev/null 2>&1; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Modem counter service enabled successfully"
            
            if /etc/init.d/quecmanager_modem_counter start >/dev/null 2>&1; then
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Modem counter service started successfully"
            else
                qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Modem counter service enabled but failed to start"
            fi
        else
            qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to enable modem counter service"
        fi
    else
        # Stop and disable the modem counter service
        /etc/init.d/quecmanager_modem_counter stop >/dev/null 2>&1
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Modem counter service stopped"
        
        if /etc/init.d/quecmanager_modem_counter disable >/dev/null 2>&1; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Modem counter service disabled successfully"
        else
            qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Modem counter service stopped but failed to disable"
        fi
    fi
}

# Handle POST requests for configuration updates
handle_post() {
    log_msg "Starting POST request handling"
    
    # Read POST data from stdin
    local post_data=""
    local content_length="${CONTENT_LENGTH:-0}"
    
    # Read exact number of bytes if content length is provided
    if [ "$content_length" -gt 0 ]; then
        post_data=$(dd bs=1 count="$content_length" 2>/dev/null)
    else
        # Fallback: read from stdin with timeout
        post_data=$(timeout 10 cat 2>/dev/null || echo "")
    fi
    
    if [ -z "$post_data" ]; then
        send_error "No POST data received" 400
    fi
    
    log_msg "Received POST data: $post_data"
    
    # Parse configuration fields from POST data
    local enabled=$(parse_json_value "$post_data" "enabled")
    local interval=$(parse_json_value "$post_data" "backupInterval")
    local monthly_limit=$(parse_json_value "$post_data" "monthlyLimit")
    local warning_threshold=$(parse_json_value "$post_data" "warningThreshold")
    local auto_backup_enabled=$(parse_json_value "$post_data" "autoBackupEnabled")
    local reset_day=$(parse_json_value "$post_data" "resetDay")
    
    log_msg "Parsed values: enabled=$enabled, interval=$interval, limit=$monthly_limit, threshold=$warning_threshold, auto_backup=$auto_backup_enabled, reset_day=$reset_day"
    
    # Handle enabled state change (enable/disable tracking)
    if [ -n "$enabled" ]; then
        # Normalize boolean value
        enabled=$(normalize_boolean "$enabled")
        log_msg "Processing enabled state change to: $enabled"
        
        # Use recreate_config to properly handle enable/disable
        if recreate_config "$enabled"; then
            log_msg "Successfully recreated config with enabled=$enabled"
        else
            log_msg "Failed to recreate config"
            send_error "Failed to update enabled state" 500
        fi
    fi
    
    # Update other configuration fields (only if config exists)
    if [ -f "$CONFIG_FILE" ]; then
        if [ -n "$interval" ]; then
            # Get current interval to check if it changed
            local current_interval=$(get_config "BACKUP_INTERVAL")
            current_interval=${current_interval:-12}
            
            log_msg "Updating BACKUP_INTERVAL to $interval"
            sed -i "s/^BACKUP_INTERVAL=.*/BACKUP_INTERVAL=$interval/" "$CONFIG_FILE" 2>/dev/null || true
            
            # Restart services if interval changed
            if [ "$interval" != "$current_interval" ]; then
                restart_services_if_needed "interval" "$current_interval" "$interval"
            fi
        fi
        
        if [ -n "$monthly_limit" ]; then
            log_msg "Updating MONTHLY_LIMIT to $monthly_limit"
            sed -i "s/^MONTHLY_LIMIT=.*/MONTHLY_LIMIT=$monthly_limit/" "$CONFIG_FILE" 2>/dev/null || true
        fi
        
        if [ -n "$warning_threshold" ]; then
            log_msg "Updating WARNING_THRESHOLD to $warning_threshold"
            sed -i "s/^WARNING_THRESHOLD=.*/WARNING_THRESHOLD=$warning_threshold/" "$CONFIG_FILE" 2>/dev/null || true
        fi
        
        if [ -n "$auto_backup_enabled" ]; then
            auto_backup_enabled=$(normalize_boolean "$auto_backup_enabled")
            log_msg "Updating AUTO_BACKUP_ENABLED to $auto_backup_enabled"
            
            # Check if this field exists in config, if not add it
            if grep -q "^AUTO_BACKUP_ENABLED=" "$CONFIG_FILE" 2>/dev/null; then
                sed -i "s/^AUTO_BACKUP_ENABLED=.*/AUTO_BACKUP_ENABLED=$auto_backup_enabled/" "$CONFIG_FILE" 2>/dev/null || true
            else
                echo "AUTO_BACKUP_ENABLED=$auto_backup_enabled" >> "$CONFIG_FILE" 2>/dev/null || true
            fi
        fi
        
        if [ -n "$reset_day" ]; then
            log_msg "Updating RESET_DAY to $reset_day"
            sed -i "s/^RESET_DAY=.*/RESET_DAY=$reset_day/" "$CONFIG_FILE" 2>/dev/null || true
        fi
    fi
    
    log_msg "Sending success response"
    
    # Send response immediately
    printf '{"status": "success", "message": "Configuration updated successfully"}\n'
    
    log_msg "POST handling completed"
}

# Main execution function
main() {
    # Ensure proper HTTP headers are always sent first
    echo "Content-Type: application/json"
    echo ""
    
    case "${REQUEST_METHOD:-GET}" in
        "POST")
            handle_post
            ;;
        "GET")
            handle_get_action "${QUERY_STRING}"
            ;;
        *)
            printf '{"status": "error", "message": "Method not allowed"}\n'
            exit 1
            ;;
    esac
    return 0
}

# Execute main function with proper error handling
log_msg "Script starting"
if ! main "$@" 2>>/tmp/config_debug.log; then
    log_msg "Script execution failed"
    # If main fails, we can't send headers again, just output JSON error
    printf '{"status": "error", "message": "Internal server error"}\n'
fi
log_msg "Script completed"