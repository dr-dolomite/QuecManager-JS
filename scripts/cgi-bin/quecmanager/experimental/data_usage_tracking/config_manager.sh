#!/bin/sh

# Data Usage Configuration Manager for OpenWRT
# Uses only built-in OpenWRT functions, no external dependencies

# Source the centralized QuecManager logger
. "/www/cgi-bin/services/quecmanager_logger.sh"

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
    qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "HTTP $code error: $message"
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
    local final_stored_upload
    local final_stored_download
    
    if [ "$enabled_state" = "true" ]; then
        # ENABLING: Store current session totals (this becomes the baseline for tracking)
        final_stored_upload=$session_upload
        final_stored_download=$session_download
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Enabling: Setting stored values to current session totals: upload=$final_stored_upload, download=$final_stored_download"
    else
        # DISABLING: Accumulate existing + session (preserve all historical data)
        final_stored_upload=$((existing_stored_upload + session_upload))
        final_stored_download=$((existing_stored_download + session_download))
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Disabling: Preserving accumulated totals: existing($existing_stored_upload + $existing_stored_download) + session($session_upload + $session_download) = total($final_stored_upload + $final_stored_download)"
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
WARNING_SHOWN=false
WARNING_THRESHOLD_SHOWN=false
WARNING_OVERLIMIT_SHOWN=false
EOF
    then
        chmod 644 "$CONFIG_FILE" 2>/dev/null
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Recreated configuration with accumulated stored values: upload=$final_stored_upload, download=$final_stored_download"
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

# Helper function to send JSON HTTP response headers
send_json_headers() {
    echo "Content-Type: application/json"
    echo ""
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
            set_config "STORED_UPLOAD" "0"
            set_config "STORED_DOWNLOAD" "0"
            set_config "WARNING_SHOWN" "false"
            set_config "WARNING_THRESHOLD_SHOWN" "false"
            set_config "WARNING_OVERLIMIT_SHOWN" "false"
            send_json_headers
            printf '{"success": true, "message": "Usage data reset successfully"}\n'
            ;;
        *"action=backup"*)
            create_backup
            send_json_headers
            printf '{"success": true, "message": "Backup created successfully"}\n'
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
                printf '{"success": false, "message": "Missing enabled parameter"}\n'
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
    
    # Parse LTE data (QGDCNT) - format: +QGDCNT: received,sent
    local lte_line=$(echo "$output_data" | grep "+QGDCNT:" | head -1)
    local lte_received=0
    local lte_sent=0
    
    if [ -n "$lte_line" ]; then
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Found LTE line: $lte_line"
        # Extract numbers after colon, handle spaces and commas
        local lte_numbers=$(echo "$lte_line" | sed 's/.*+QGDCNT:[[:space:]]*\([0-9,[:space:]]*\).*/\1/')
        lte_received=$(echo "$lte_numbers" | cut -d',' -f1 | tr -d ' ')
        lte_sent=$(echo "$lte_numbers" | cut -d',' -f2 | tr -d ' ')
        
        # Ensure we have valid numbers
        lte_received=${lte_received:-0}
        lte_sent=${lte_sent:-0}
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "LTE numbers: $lte_numbers -> received=$lte_received, sent=$lte_sent"
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
    qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Parsed LTE: received=$lte_received, sent=$lte_sent"
    qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Parsed NR: sent=$nr_sent, received=$nr_received"
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Session totals: upload=$total_upload, download=$total_download"
    
    printf '{"upload":%s,"download":%s,"total":%s}' "$total_upload" "$total_download" "$total_usage"
}

# Get current session data usage (without stored values)
get_session_usage() {
    parse_modem_data
}
get_current_usage() {
    # Get session usage
    local session_usage=$(parse_modem_data)
    
    # Parse the JSON values from session
    local session_upload=$(echo "$session_usage" | sed 's/.*"upload":\([0-9]*\).*/\1/')
    local session_download=$(echo "$session_usage" | sed 's/.*"download":\([0-9]*\).*/\1/')
    
    # Get stored values from previous sessions
    local stored_upload=$(get_config "STORED_UPLOAD")
    local stored_download=$(get_config "STORED_DOWNLOAD")
    
    # Ensure we have valid numbers
    session_upload=${session_upload:-0}
    session_download=${session_download:-0}
    stored_upload=${stored_upload:-0}
    stored_download=${stored_download:-0}
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Session totals: upload=$session_upload, download=$session_download"
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Stored values: upload=$stored_upload, download=$stored_download"
    
    # Calculate totals with stored values
    local total_upload=$((session_upload + stored_upload))
    local total_download=$((session_download + stored_download))
    local total_usage=$((total_upload + total_download))
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Final totals (session + stored): upload=$total_upload, download=$total_download, total=$total_usage"
    
    printf '{"upload":%s,"download":%s,"total":%s}' "$total_upload" "$total_download" "$total_usage"
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
        # Check if we already reset today by looking at stored values
        local stored_upload=$(get_config "STORED_UPLOAD")
        local stored_download=$(get_config "STORED_DOWNLOAD")
        
        # Only reset if we have non-zero stored values (indicating we haven't reset today)
        if [ "${stored_upload:-0}" -gt 0 ] || [ "${stored_download:-0}" -gt 0 ]; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Performing monthly reset on day $current_day (reset day: $reset_day)"
            set_config "STORED_UPLOAD" "0"
            set_config "STORED_DOWNLOAD" "0"
            set_config "WARNING_SHOWN" "false"
            set_config "WARNING_THRESHOLD_SHOWN" "false"
            set_config "WARNING_OVERLIMIT_SHOWN" "false"
            return 0
        else
            qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Monthly reset already performed today (day $current_day)"
        fi
    else
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Monthly reset not needed (current day: $current_day, reset day: $reset_day)"
    fi
    
    return 1
}

# Create backup of current usage with intelligent comparison logic
# Simple manual backup function
create_backup() {
    # Get current session totals using existing parser
    local session_usage=$(parse_modem_data)
    
    # Parse the JSON values from session
    local curr_tx=$(echo "$session_usage" | sed 's/.*"upload":\([0-9]*\).*/\1/')
    local curr_rx=$(echo "$session_usage" | sed 's/.*"download":\([0-9]*\).*/\1/')
    
    # Ensure we have valid numbers
    curr_tx=${curr_tx:-0}
    curr_rx=${curr_rx:-0}
    
    # Get stored values
    local stored_tx=$(get_config "STORED_UPLOAD")
    local stored_rx=$(get_config "STORED_DOWNLOAD")
    stored_tx=${stored_tx:-0}
    stored_rx=${stored_rx:-0}
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Manual backup: current tx=$curr_tx rx=$curr_rx, stored tx=$stored_tx rx=$stored_rx"
    
    # Compare and update logic
    local new_tx new_rx
    
    if [ "$stored_tx" -gt "$curr_tx" ]; then
        # Counter reset detected (reboot) - preserve stored + add new session
        new_tx=$((stored_tx + curr_tx))
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "TX counter reset detected, preserving stored value: $stored_tx + $curr_tx = $new_tx"
    else
        # Normal case - just store current session total
        new_tx=$curr_tx
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "TX normal update: $curr_tx"
    fi
    
    if [ "$stored_rx" -gt "$curr_rx" ]; then
        # Counter reset detected (reboot) - preserve stored + add new session
        new_rx=$((stored_rx + curr_rx))
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "RX counter reset detected, preserving stored value: $stored_rx + $curr_rx = $new_rx"
    else
        # Normal case - just store current session total
        new_rx=$curr_rx
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "RX normal update: $curr_rx"
    fi
    
    # Update stored values in config
    set_config "STORED_UPLOAD" "$new_tx"
    set_config "STORED_DOWNLOAD" "$new_rx"
    set_config "LAST_BACKUP" "$(date +%s)"
    
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Manual backup completed: stored tx=$new_tx rx=$new_rx"
}

# Toggle backup service (enable/disable procd service)
toggle_backup_service() {
    local enabled="$1"
    
    if [ "$enabled" = "true" ]; then
        # Enable and start the service
        if /etc/init.d/quecmanager_data_usage enable 2>/dev/null; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service enabled successfully"
            
            if /etc/init.d/quecmanager_data_usage start 2>/dev/null; then
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service started successfully"
                send_json_headers
                printf '{"success": true, "message": "Backup service enabled and started"}\n'
            else
                qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service enabled but failed to start"
                send_json_headers
                printf '{"success": true, "message": "Backup service enabled but failed to start"}\n'
            fi
        else
            qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Failed to enable backup service"
            send_json_headers
            printf '{"success": false, "message": "Failed to enable backup service"}\n'
        fi
    else
        # Stop and disable the service
        /etc/init.d/quecmanager_data_usage stop 2>/dev/null
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service stopped"
        
        if /etc/init.d/quecmanager_data_usage disable 2>/dev/null; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service disabled successfully"
            send_json_headers
            printf '{"success": true, "message": "Backup service stopped and disabled"}\n'
        else
            qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Backup service stopped but failed to disable"
            send_json_headers
            printf '{"success": true, "message": "Backup service stopped but failed to disable"}\n'
        fi
    fi
}

# Handle POST requests for configuration updates
handle_post() {
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
    
    qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Received POST data: $post_data"
    
    # Parse JSON fields using simple text processing
    local enabled=$(parse_json_value "$post_data" "enabled")
    local limit=$(parse_json_value "$post_data" "monthlyLimit")
    local interval=$(parse_json_value "$post_data" "backupInterval")
    local auto_backup_enabled=$(parse_json_value "$post_data" "autoBackupEnabled")
    local reset_day=$(parse_json_value "$post_data" "resetDay")
    local warning_threshold=$(parse_json_value "$post_data" "warningThreshold")
    local warning_shown=$(parse_json_value "$post_data" "warningShown")
    local warning_threshold_shown=$(parse_json_value "$post_data" "warningThresholdShown")
    local warning_overlimit_shown=$(parse_json_value "$post_data" "warningOverlimitShown")
    
    # Validate and update configuration
    if [ -n "$enabled" ]; then
        # Normalize boolean values
        enabled=$(normalize_boolean "$enabled")
        
        # Get current enabled state to detect changes
        local current_enabled="false"
        if [ -f "$CONFIG_FILE" ]; then
            current_enabled=$(get_config "ENABLED")
            current_enabled=${current_enabled:-false}
        fi
        
        # Handle enable/disable state changes
        if [ "$enabled" != "$current_enabled" ]; then
            if [ "$enabled" = "false" ]; then
                # Disabling: Keep config file but update stored values and set enabled=false
                qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Disabling feature, preserving data in config"
                
                # First, backup current session usage to stored values
                local current_usage=$(get_current_usage)
                local total_upload=$(echo "$current_usage" | sed 's/.*"upload":\([0-9]*\).*/\1/')
                local total_download=$(echo "$current_usage" | sed 's/.*"download":\([0-9]*\).*/\1/')
                
                # Update stored values with accumulated totals
                set_config "STORED_UPLOAD" "${total_upload:-0}"
                set_config "STORED_DOWNLOAD" "${total_download:-0}"
                set_config "ENABLED" "false"
                set_config "LAST_BACKUP" "$(date +%s)"
            else
                # Enabling: Keep existing config and stored values, just set enabled=true
                if [ -f "$CONFIG_FILE" ]; then
                    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Enabling feature, preserving existing stored values"
                    set_config "ENABLED" "true"
                else
                    # No existing config, create new one
                    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Enabling feature, creating new config"
                    recreate_config "$enabled"
                fi
            fi
        else
            # State hasn't changed, just update normally (but only if config exists)
            if [ -f "$CONFIG_FILE" ]; then
                set_config "ENABLED" "$enabled"
            fi
        fi
    fi
    
    # Only update other settings if config file exists (feature is enabled)
    if [ -f "$CONFIG_FILE" ]; then
        [ -n "$limit" ] && [ "$limit" -gt 0 ] && set_config "MONTHLY_LIMIT" "$limit"
        [ -n "$interval" ] && [ "$interval" -gt 0 ] && set_config "BACKUP_INTERVAL" "$interval"
        [ -n "$reset_day" ] && [ "$reset_day" -ge 1 ] && [ "$reset_day" -le 28 ] && set_config "RESET_DAY" "$reset_day"
        [ -n "$warning_threshold" ] && [ "$warning_threshold" -ge 1 ] && [ "$warning_threshold" -le 100 ] && set_config "WARNING_THRESHOLD" "$warning_threshold"
        
        if [ -n "$warning_shown" ]; then
            warning_shown=$(normalize_boolean "$warning_shown")
            set_config "WARNING_SHOWN" "$warning_shown"
        fi
        
        if [ -n "$warning_threshold_shown" ]; then
            warning_threshold_shown=$(normalize_boolean "$warning_threshold_shown")
            set_config "WARNING_THRESHOLD_SHOWN" "$warning_threshold_shown"
        fi
        
        if [ -n "$warning_overlimit_shown" ]; then
            warning_overlimit_shown=$(normalize_boolean "$warning_overlimit_shown")
            set_config "WARNING_OVERLIMIT_SHOWN" "$warning_overlimit_shown"
        fi
        
        # Handle automated backup enabled/disabled
        if [ -n "$auto_backup_enabled" ]; then
            auto_backup_enabled=$(normalize_boolean "$auto_backup_enabled")
            set_config "AUTO_BACKUP_ENABLED" "$auto_backup_enabled"
        fi
    fi
    
    send_json_headers
    printf '{"success": true, "message": "Configuration updated successfully"}\n'
    
    # Restart backup daemon if backup interval or enabled status changed
    if [ -n "$enabled" ] || [ -n "$interval" ]; then
        if [ -x "/etc/init.d/quecmanager_data_usage" ]; then
            qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Restarting backup daemon with new configuration"
            /etc/init.d/quecmanager_data_usage restart >/dev/null 2>&1 &
        fi
    fi
}

# Main execution function
main() {
    case "${REQUEST_METHOD:-GET}" in
        "POST")
            handle_post
            ;;
        "GET")
            handle_get_action "${QUERY_STRING}"
            ;;
        *)
            send_error "Method not allowed" 405
            ;;
    esac
}

# Execute main function with error handling
main "$@" 2>&1 || {
    echo "Status: 500"
    echo "Content-Type: application/json"
    echo ""
    printf '{"error": "Internal server error", "code": 500}\n'
}