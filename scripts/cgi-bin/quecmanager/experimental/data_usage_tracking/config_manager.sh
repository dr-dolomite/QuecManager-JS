#!/bin/sh

# Data Usage Configuration Manager for OpenWRT
# Uses only built-in OpenWRT functions, no external dependencies

# Configuration file path
CONFIG_DIR="/etc/quecmanager"
CONFIG_FILE="$CONFIG_DIR/data_usage"
BACKUP_DIR="/tmp/data_usage_backups"

# Default configuration values
DEFAULT_ENABLED="false"
DEFAULT_LIMIT="10737418240"  # 10GB in bytes
DEFAULT_BACKUP_INTERVAL="12"  # hours
DEFAULT_RESET_DAY="1"  # 1st day of month
DEFAULT_WARNING_THRESHOLD="90"  # 90% of limit

# Ensure directories exist
create_directories() {
    # Try to create directories, ignore errors if they already exist or can't be created
    [ ! -d "$CONFIG_DIR" ] && mkdir -p "$CONFIG_DIR" 2>/dev/null
    [ ! -d "$BACKUP_DIR" ] && mkdir -p "$BACKUP_DIR" 2>/dev/null
    
    # Set permissions if directories were created successfully
    [ -d "$CONFIG_DIR" ] && chmod 755 "$CONFIG_DIR" 2>/dev/null
    [ -d "$BACKUP_DIR" ] && chmod 755 "$BACKUP_DIR" 2>/dev/null
}

# Initialize directories
create_directories

# Logging function
log_message() {
    local message="$1"
    local level="${2:-info}"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message" >> /tmp/data_usage_config.log
}

# Send HTTP error response
send_error() {
    local message="$1"
    local code="${2:-500}"
    echo "Status: $code"
    echo "Content-Type: application/json"
    echo ""
    printf '{"error": "%s", "code": %d}\n' "$message" "$code"
    exit 1
}

# Initialize default config if not exists
init_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        # Ensure parent directory exists
        create_directories
        
        # Try to create config file
        if cat > "$CONFIG_FILE" 2>/dev/null << EOF
# Data Usage Tracking Configuration
# Generated on $(date)

ENABLED=$DEFAULT_ENABLED
MONTHLY_LIMIT=$DEFAULT_LIMIT
BACKUP_INTERVAL=$DEFAULT_BACKUP_INTERVAL
RESET_DAY=$DEFAULT_RESET_DAY
WARNING_THRESHOLD=$DEFAULT_WARNING_THRESHOLD
STORED_UPLOAD=0
STORED_DOWNLOAD=0
LAST_BACKUP=$(date +%s)
LAST_RESET=0
WARNING_SHOWN=false
WARNING_THRESHOLD_SHOWN=false
WARNING_OVERLIMIT_SHOWN=false
EOF
        then
            chmod 644 "$CONFIG_FILE" 2>/dev/null
            log_message "Initialized default configuration"
        else
            log_message "Failed to create config file: $CONFIG_FILE" "error"
        fi
    fi
}

# Read configuration value
get_config() {
    local key="$1"
    init_config
    grep "^$key=" "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | head -1
}

# Set configuration value
set_config() {
    local key="$1"
    local value="$2"
    init_config
    
    # Ensure config file exists and is writable
    if [ ! -f "$CONFIG_FILE" ]; then
        log_message "Config file does not exist, cannot set $key" "error"
        return 1
    fi
    
    # Update existing key or append new one
    if grep -q "^$key=" "$CONFIG_FILE" 2>/dev/null; then
        # Use a temporary file for safer updates
        local temp_file="${CONFIG_FILE}.tmp.$$"
        if sed "s/^$key=.*/$key=$value/" "$CONFIG_FILE" > "$temp_file" 2>/dev/null; then
            if mv "$temp_file" "$CONFIG_FILE" 2>/dev/null; then
                log_message "Updated $key=$value"
            else
                log_message "Failed to update config file" "error"
                rm -f "$temp_file" 2>/dev/null
                return 1
            fi
        else
            log_message "Failed to process config file" "error"
            rm -f "$temp_file" 2>/dev/null
            return 1
        fi
    else
        # Append new key-value pair
        if echo "$key=$value" >> "$CONFIG_FILE" 2>/dev/null; then
            log_message "Added $key=$value"
        else
            log_message "Failed to append to config file" "error"
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

# Get current data usage from data_usage.json
get_current_usage() {
    local logfile="/www/signal_graphs/data_usage.json"
    
    if [ ! -f "$logfile" ]; then
        log_message "Data usage file not found: $logfile"
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
        log_message "No complete JSON entries found in data file"
        printf '{"upload":0,"download":0,"total":0}'
        return
    fi
    
    log_message "Found complete entry (first 100 chars): $(echo "$last_entry" | head -c 100)..."
    
    # Extract the output field from the JSON entry
    local output_data=$(echo "$last_entry" | sed 's/.*"output"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    
    if [ -z "$output_data" ] || [ "$output_data" = "$last_entry" ]; then
        log_message "Failed to extract output data from JSON entry"
        printf '{"upload":0,"download":0,"total":0}'
        return
    fi
    
    log_message "Extracted output data (first 100 chars): $(echo "$output_data" | head -c 100)..."
    
    # Convert escaped newlines to actual newlines for parsing
    output_data=$(echo "$output_data" | sed 's/\\r\\n/\n/g')
    
    log_message "After newline conversion (first 100 chars): $(echo "$output_data" | head -c 100)..."
    
    # Parse LTE data (QGDCNT) - format: +QGDCNT: received,sent
    local lte_line=$(echo "$output_data" | grep "+QGDCNT:" | head -1)
    local lte_received=0
    local lte_sent=0
    
    if [ -n "$lte_line" ]; then
        log_message "Found LTE line: $lte_line"
        # Extract numbers after colon, handle spaces and commas
        local lte_numbers=$(echo "$lte_line" | sed 's/.*+QGDCNT:[[:space:]]*\([0-9,[:space:]]*\).*/\1/')
        lte_received=$(echo "$lte_numbers" | cut -d',' -f1 | tr -d ' ')
        lte_sent=$(echo "$lte_numbers" | cut -d',' -f2 | tr -d ' ')
        
        # Ensure we have valid numbers
        lte_received=${lte_received:-0}
        lte_sent=${lte_sent:-0}
        log_message "LTE numbers: $lte_numbers -> received=$lte_received, sent=$lte_sent"
    else
        log_message "No LTE data found"
    fi
    
    # Parse NR data (QGDNRCNT) - format: +QGDNRCNT: sent,received  
    local nr_line=$(echo "$output_data" | grep "+QGDNRCNT:" | head -1)
    local nr_sent=0
    local nr_received=0
    
    if [ -n "$nr_line" ]; then
        log_message "Found NR line: $nr_line"
        # Extract numbers after colon, handle spaces and commas
        local nr_numbers=$(echo "$nr_line" | sed 's/.*+QGDNRCNT:[[:space:]]*\([0-9,[:space:]]*\).*/\1/')
        nr_sent=$(echo "$nr_numbers" | cut -d',' -f1 | tr -d ' ')
        nr_received=$(echo "$nr_numbers" | cut -d',' -f2 | tr -d ' ')
        
        # Ensure we have valid numbers
        nr_sent=${nr_sent:-0}
        nr_received=${nr_received:-0}
        log_message "NR numbers: $nr_numbers -> sent=$nr_sent, received=$nr_received"
    else
        log_message "No NR data found"
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
    
    # Add stored values from previous sessions
    local stored_upload=$(get_config "STORED_UPLOAD")
    local stored_download=$(get_config "STORED_DOWNLOAD")
    
    stored_upload=${stored_upload:-0}
    stored_download=${stored_download:-0}
    
    if command -v bc >/dev/null 2>&1; then
        total_upload=$(echo "$total_upload + $stored_upload" | bc 2>/dev/null || echo $((total_upload + stored_upload)))
        total_download=$(echo "$total_download + $stored_download" | bc 2>/dev/null || echo $((total_download + stored_download)))
    else
        total_upload=$((total_upload + stored_upload))
        total_download=$((total_download + stored_download))
    fi
    
    local total_usage=$((total_upload + total_download))
    
    # Log the parsed values for debugging
    log_message "Parsed LTE: received=$lte_received, sent=$lte_sent"
    log_message "Parsed NR: sent=$nr_sent, received=$nr_received"
    log_message "Total: upload=$total_upload, download=$total_download, total=$total_usage"
    
    printf '{"upload":%s,"download":%s,"total":%s}' "$total_upload" "$total_download" "$total_usage"
}

# Check if monthly reset is needed
check_monthly_reset() {
    local reset_day=$(get_config "RESET_DAY")
    local last_reset=$(get_config "LAST_RESET")
    local current_time=$(date +%s)
    local current_day=$(date +%d | sed 's/^0*//')
    
    # Simple check: if current day >= reset day and we haven't reset this month
    local current_month_year=$(date +%Y%m)
    local last_reset_month_year=""
    
    if [ -n "$last_reset" ] && [ "$last_reset" -gt 0 ]; then
        last_reset_month_year=$(date -d "@$last_reset" +%Y%m 2>/dev/null || echo "")
    fi
    
    # Reset if we're in a new month or past the reset day
    if [ "$current_month_year" != "$last_reset_month_year" ] && [ "$current_day" -ge "${reset_day:-1}" ]; then
        log_message "Performing monthly reset"
        set_config "STORED_UPLOAD" "0"
        set_config "STORED_DOWNLOAD" "0"
        set_config "LAST_RESET" "$current_time"
        set_config "WARNING_SHOWN" "false"
        set_config "WARNING_THRESHOLD_SHOWN" "false"
        set_config "WARNING_OVERLIMIT_SHOWN" "false"
        return 0
    fi
    
    return 1
}

# Create backup of current usage
create_backup() {
    local current_usage=$(get_current_usage)
    local timestamp=$(date +%s)
    local backup_file="$BACKUP_DIR/backup_$timestamp.json"
    
    echo "$current_usage" > "$backup_file"
    set_config "LAST_BACKUP" "$timestamp"
    
    # Keep only last 10 backups
    ls -t "$BACKUP_DIR"/backup_*.json 2>/dev/null | tail -n +11 | while read file; do
        rm -f "$file" 2>/dev/null
    done
    
    log_message "Created backup: $backup_file"
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
    
    log_message "Received POST data: $post_data"
    
    # Parse JSON fields using simple text processing
    local enabled=$(parse_json_value "$post_data" "enabled")
    local limit=$(parse_json_value "$post_data" "monthlyLimit")
    local interval=$(parse_json_value "$post_data" "backupInterval")
    local reset_day=$(parse_json_value "$post_data" "resetDay")
    local warning_threshold=$(parse_json_value "$post_data" "warningThreshold")
    local warning_shown=$(parse_json_value "$post_data" "warningShown")
    local warning_threshold_shown=$(parse_json_value "$post_data" "warningThresholdShown")
    local warning_overlimit_shown=$(parse_json_value "$post_data" "warningOverlimitShown")
    
    # Validate and update configuration
    if [ -n "$enabled" ]; then
        # Normalize boolean values
        case "$enabled" in
            "true"|"1") enabled="true" ;;
            "false"|"0") enabled="false" ;;
            *) enabled="false" ;;
        esac
        set_config "ENABLED" "$enabled"
    fi
    
    [ -n "$limit" ] && [ "$limit" -gt 0 ] && set_config "MONTHLY_LIMIT" "$limit"
    [ -n "$interval" ] && [ "$interval" -gt 0 ] && set_config "BACKUP_INTERVAL" "$interval"
    [ -n "$reset_day" ] && [ "$reset_day" -ge 1 ] && [ "$reset_day" -le 28 ] && set_config "RESET_DAY" "$reset_day"
    [ -n "$warning_threshold" ] && [ "$warning_threshold" -ge 1 ] && [ "$warning_threshold" -le 100 ] && set_config "WARNING_THRESHOLD" "$warning_threshold"
    
    if [ -n "$warning_shown" ]; then
        case "$warning_shown" in
            "true"|"1") warning_shown="true" ;;
            "false"|"0") warning_shown="false" ;;
            *) warning_shown="false" ;;
        esac
        set_config "WARNING_SHOWN" "$warning_shown"
    fi
    
    if [ -n "$warning_threshold_shown" ]; then
        case "$warning_threshold_shown" in
            "true"|"1") warning_threshold_shown="true" ;;
            "false"|"0") warning_threshold_shown="false" ;;
            *) warning_threshold_shown="false" ;;
        esac
        set_config "WARNING_THRESHOLD_SHOWN" "$warning_threshold_shown"
    fi
    
    if [ -n "$warning_overlimit_shown" ]; then
        case "$warning_overlimit_shown" in
            "true"|"1") warning_overlimit_shown="true" ;;
            "false"|"0") warning_overlimit_shown="false" ;;
            *) warning_overlimit_shown="false" ;;
        esac
        set_config "WARNING_OVERLIMIT_SHOWN" "$warning_overlimit_shown"
    fi
    
    echo "Content-Type: application/json"
    echo ""
    printf '{"success": true, "message": "Configuration updated successfully"}\n'
}

# Main execution function
main() {
    case "${REQUEST_METHOD:-GET}" in
        "POST")
            handle_post
            ;;
        "GET")
            case "${QUERY_STRING}" in
                *"action=reset"*)
                    set_config "STORED_UPLOAD" "0"
                    set_config "STORED_DOWNLOAD" "0"
                    set_config "WARNING_SHOWN" "false"
                    set_config "WARNING_THRESHOLD_SHOWN" "false"
                    set_config "WARNING_OVERLIMIT_SHOWN" "false"
                    echo "Content-Type: application/json"
                    echo ""
                    printf '{"success": true, "message": "Usage data reset successfully"}\n'
                    ;;
                *"action=backup"*)
                    create_backup
                    echo "Content-Type: application/json"
                    echo ""
                    printf '{"success": true, "message": "Backup created successfully"}\n'
                    ;;
                *)
                    # Return current configuration and usage
                    init_config
                    check_monthly_reset
                    
                    local enabled=$(get_config "ENABLED")
                    local limit=$(get_config "MONTHLY_LIMIT")
                    local interval=$(get_config "BACKUP_INTERVAL")
                    local reset_day=$(get_config "RESET_DAY")
                    local warning_threshold=$(get_config "WARNING_THRESHOLD")
                    local warning_shown=$(get_config "WARNING_SHOWN")
                    local warning_threshold_shown=$(get_config "WARNING_THRESHOLD_SHOWN")
                    local warning_overlimit_shown=$(get_config "WARNING_OVERLIMIT_SHOWN")
                    local current_usage=$(get_current_usage)
                    
                    echo "Content-Type: application/json"
                    echo ""
                    
                    # Build JSON response manually
                    printf '{\n'
                    printf '    "config": {\n'
                    printf '        "enabled": %s,\n' "${enabled:-false}"
                    printf '        "monthlyLimit": %s,\n' "${limit:-$DEFAULT_LIMIT}"
                    printf '        "backupInterval": %s,\n' "${interval:-$DEFAULT_BACKUP_INTERVAL}"
                    printf '        "resetDay": %s,\n' "${reset_day:-$DEFAULT_RESET_DAY}"
                    printf '        "warningThreshold": %s,\n' "${warning_threshold:-$DEFAULT_WARNING_THRESHOLD}"
                    printf '        "warningShown": %s,\n' "${warning_shown:-false}"
                    printf '        "warningThresholdShown": %s,\n' "${warning_threshold_shown:-false}"
                    printf '        "warningOverlimitShown": %s\n' "${warning_overlimit_shown:-false}"
                    printf '    },\n'
                    printf '    "usage": %s\n' "$current_usage"
                    printf '}\n'
                    ;;
            esac
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
