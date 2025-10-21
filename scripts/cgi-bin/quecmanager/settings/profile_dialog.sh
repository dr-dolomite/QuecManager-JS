#!/bin/sh
# Profile Dialog Settings Management Script
# Manages the display of profile setup dialog on home page
# Uses UCI configuration for OpenWRT integration
# Date: 2025-10-03

# Configuration
UCI_CONFIG="quecmanager"
UCI_SECTION="profile_dialog"

# Default setting is ENABLED 
DEFAULT_SETTING="ENABLED"

# HTTP headers
echo "Content-Type: application/json"
echo "Cache-Control: no-cache"
echo ""

# Initialize UCI configuration
init_uci_config() {
    # Ensure quecmanager config exists
    touch /etc/config/quecmanager 2>/dev/null || true
    
    # Create section if it doesn't exist
    if ! uci -q get quecmanager.profile_dialog >/dev/null 2>&1; then
        uci set quecmanager.profile_dialog=settings
        uci commit quecmanager
    fi
}

# Function to read current setting from UCI
read_setting() {
    # Initialize UCI if needed
    init_uci_config
    
    # Read from UCI
    local setting=$(uci -q get quecmanager.profile_dialog.enabled)
    
    if [ -n "$setting" ]; then
        # Convert UCI format to ENABLED/DISABLED
        case "$setting" in
            1|true|on|yes|enabled|ENABLED) echo "ENABLED" ;;
            *) echo "DISABLED" ;;
        esac
    else
        echo "$DEFAULT_SETTING"
    fi
}

# Function to write setting to UCI
write_setting() {
    local setting="$1"
    
    # Initialize UCI if needed
    init_uci_config
    
    # Convert ENABLED/DISABLED to UCI format (1/0)
    local uci_value="0"
    [ "$setting" = "ENABLED" ] && uci_value="1"
    
    # Set UCI value
    uci set quecmanager.profile_dialog.enabled="$uci_value"
    
    # Commit changes
    uci commit quecmanager
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
        
        # Check if it's default (UCI option doesn't exist or contains default value)
        if ! uci -q get quecmanager.profile_dialog.enabled >/dev/null 2>&1 || [ "$current_setting" = "$DEFAULT_SETTING" ]; then
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