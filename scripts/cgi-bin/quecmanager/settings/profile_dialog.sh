#!/bin/sh
# Profile Dialog Settings Management Script
# Manages the display of profile setup dialog on home page using UCI
# Author: dr-dolomite
# Date: 2025-11-11

# UCI Configuration
UCI_CONFIG="quecmanager"
UCI_SECTION="preferences"
UCI_OPTION="profile_dialog"
DEFAULT_SETTING="show"

# HTTP headers
echo "Content-Type: application/json"
echo "Cache-Control: no-cache"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Error response function
send_error() {
    local error_code="$1"
    local error_message="$2"
    echo "{\"status\":\"error\",\"code\":\"$error_code\",\"message\":\"$error_message\"}"
    exit 1
}

# Success response function
send_success() {
    local message="$1"
    local enabled="$2"
    local is_default="$3"
    echo "{\"status\":\"success\",\"message\":\"$message\",\"data\":{\"enabled\":$enabled,\"isDefault\":$is_default}}"
}

# Ensure UCI section exists
ensure_uci_section() {
    # Check if config exists, create if not
    if ! uci -q get ${UCI_CONFIG} >/dev/null 2>&1; then
        touch /etc/config/${UCI_CONFIG}
    fi
    
    # Check if section exists, create if not
    if ! uci -q get ${UCI_CONFIG}.${UCI_SECTION} >/dev/null 2>&1; then
        uci set ${UCI_CONFIG}.${UCI_SECTION}=settings
        uci commit ${UCI_CONFIG}
    fi
}

# Get current setting from UCI
get_setting() {
    ensure_uci_section
    
    local setting=$(uci -q get ${UCI_CONFIG}.${UCI_SECTION}.${UCI_OPTION})
    
    # If no setting in UCI, set default and return it
    if [ -z "$setting" ]; then
        setting="$DEFAULT_SETTING"
        uci set ${UCI_CONFIG}.${UCI_SECTION}.${UCI_OPTION}="$setting"
        uci commit ${UCI_CONFIG}
    fi
    
    echo "$setting"
}

# Save setting to UCI
save_setting() {
    local setting="$1"
    ensure_uci_section
    
    uci set ${UCI_CONFIG}.${UCI_SECTION}.${UCI_OPTION}="$setting"
    uci commit ${UCI_CONFIG}
}

# Delete setting (revert to default)
delete_setting() {
    ensure_uci_section
    
    uci delete ${UCI_CONFIG}.${UCI_SECTION}.${UCI_OPTION} 2>/dev/null
    uci commit ${UCI_CONFIG}
}

# Check if current setting is default
is_default_setting() {
    local setting=$(uci -q get ${UCI_CONFIG}.${UCI_SECTION}.${UCI_OPTION})
    
    # If UCI entry doesn't exist or equals default, it's default
    if [ -z "$setting" ] || [ "$setting" = "$DEFAULT_SETTING" ]; then
        echo "true"
    else
        echo "false"
    fi
}

# Function to return JSON response
json_response() {
    local status="$1"
    local message="$2"
    local enabled="$3"
    local is_default="$4"
    
    cat << EOF
{
    "status": "$status",
    "message": "$message",
    "data": {
        "enabled": $enabled,
        "isDefault": $is_default
    }
}
EOF
}

# Handle GET request
handle_get() {
    local setting=$(get_setting)
    local is_default=$(is_default_setting)
    
    # Convert show/hide to boolean
    local enabled="true"
    [ "$setting" = "hide" ] && enabled="false"
    
    send_success "Profile dialog setting retrieved successfully" "$enabled" "$is_default"
}

# Handle POST request
handle_post() {
    if [ -z "$CONTENT_LENGTH" ] || [ "$CONTENT_LENGTH" -eq 0 ]; then
        send_error "NO_DATA" "No data provided"
    fi
    
    # Read JSON input
    local input=$(head -c "$CONTENT_LENGTH")
    
    # Extract enabled value
    local enabled=$(echo "$input" | grep -o '"enabled"[[:space:]]*:[[:space:]]*[^,}]*' | sed 's/.*:[[:space:]]*//' | tr -d '"' | tr -d ' ')
    
    if [ "$enabled" = "true" ]; then
        save_setting "show"
        send_success "Profile dialog enabled successfully" "true" "false"
    elif [ "$enabled" = "false" ]; then
        save_setting "hide"
        send_success "Profile dialog disabled successfully" "false" "false"
    else
                else
        send_error "INVALID_VALUE" "Invalid value for enabled. Must be true or false."
    fi
}

# Handle DELETE request
handle_delete() {
    delete_setting
    
    # After deleting, get the current setting (will be default)
    local setting=$(get_setting)
    local enabled="true"
    [ "$setting" = "hide" ] && enabled="false"
    
    send_success "Profile dialog setting reset to default" "$enabled" "true"
}

# Main execution
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
    OPTIONS)
        # Handle CORS preflight
        exit 0
        ;;
    *)
        send_error "METHOD_NOT_ALLOWED" "HTTP method ${REQUEST_METHOD} not supported"
        ;;
esac

exit 0
        
    "DELETE")
        # Reset to default (remove UCI option)
        if uci -q get quecmanager.profile_dialog.enabled >/dev/null 2>&1; then
            uci delete quecmanager.profile_dialog.enabled
            uci commit quecmanager
        fi
        
        current_setting=$(read_setting)
        if [ "$current_setting" = "ENABLED" ]; then
            enabled="true"
        else
            enabled="false"
        fi
        
        json_response "success" "Profile dialog setting reset to default" "$enabled" "true"
        ;;
        
    *)
        json_response "error" "Method not allowed" "false" "true"
        ;;
esac