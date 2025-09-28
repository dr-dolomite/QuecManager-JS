#!/bin/sh
# Profile Dialog Settings Management Script
# Manages the display of profile setup dialog on home page

CONFIG_DIR="/etc/quecmanager/settings"
CONFIG_FILE="$CONFIG_DIR/profile_dialog.conf"

# Ensure config directory exists
mkdir -p "$CONFIG_DIR"

# Default setting is ENABLED
DEFAULT_SETTING="ENABLED"

# HTTP headers
echo "Content-Type: application/json"
echo "Cache-Control: no-cache"
echo ""

# Function to read current setting
read_setting() {
    if [ -f "$CONFIG_FILE" ]; then
        local setting=$(cat "$CONFIG_FILE" 2>/dev/null | tr -d '\n\r' | tr '[:lower:]' '[:upper:]')
        if [ "$setting" = "ENABLED" ] || [ "$setting" = "DISABLED" ]; then
            echo "$setting"
        else
            echo "$DEFAULT_SETTING"
        fi
    else
        echo "$DEFAULT_SETTING"
    fi
}

# Function to write setting
write_setting() {
    local setting="$1"
    echo "$setting" > "$CONFIG_FILE"
    chmod 644 "$CONFIG_FILE"
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

# Handle different HTTP methods
case "$REQUEST_METHOD" in
    "GET")
        # Read current setting
        current_setting=$(read_setting)
        if [ "$current_setting" = "ENABLED" ]; then
            enabled="true"
        else
            enabled="false"
        fi
        
        # Check if it's default (file doesn't exist or contains default value)
        if [ ! -f "$CONFIG_FILE" ] || [ "$current_setting" = "$DEFAULT_SETTING" ]; then
            is_default="true"
        else
            is_default="false"
        fi
        
        json_response "success" "Profile dialog setting retrieved successfully" "$enabled" "$is_default"
        ;;
        
    "POST")
        # Update setting from JSON input
        if [ -n "$CONTENT_LENGTH" ] && [ "$CONTENT_LENGTH" -gt 0 ]; then
            # Read JSON input
            input=$(head -c "$CONTENT_LENGTH")
            
            # Extract enabled value using simple parsing
            enabled=$(echo "$input" | grep -o '"enabled"[[:space:]]*:[[:space:]]*[^,}]*' | sed 's/.*:[[:space:]]*//' | tr -d '"' | tr -d ' ')
            
            if [ "$enabled" = "true" ]; then
                write_setting "ENABLED"
                json_response "success" "Profile dialog enabled successfully" "true" "false"
            elif [ "$enabled" = "false" ]; then
                write_setting "DISABLED"
                json_response "success" "Profile dialog disabled successfully" "false" "false"
            else
                json_response "error" "Invalid enabled value. Must be true or false" "false" "true"
            fi
        else
            json_response "error" "No data provided" "false" "true"
        fi
        ;;
        
    "DELETE")
        # Reset to default (remove config file)
        if [ -f "$CONFIG_FILE" ]; then
            rm -f "$CONFIG_FILE"
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