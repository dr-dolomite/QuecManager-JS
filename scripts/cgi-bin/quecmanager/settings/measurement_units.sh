#!/bin/sh

# Measurement Units Configuration Script
# Manages distance unit preferences (km/mi) using UCI
# Author: dr-dolomite
# Date: 2025-11-11

# Set content type and CORS headers
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# UCI Configuration
UCI_CONFIG="quecmanager"
UCI_SECTION="preferences"
UCI_OPTION="measurement_unit"
DEFAULT_UNIT="km"

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
    local data="$2"
    if [ -n "$data" ]; then
        echo "{\"status\":\"success\",\"message\":\"$message\",\"data\":$data}"
    else
        echo "{\"status\":\"success\",\"message\":\"$message\"}"
    fi
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

# Check if the country uses imperial or metric system based on timezone
get_default_unit() {
    # Get timezone from UCI
    local timezone=$(uci -q get system.@system[0].zonename)
    if [ -z "$timezone" ]; then
        timezone=$(uci -q get system.@system[0].timezone)
    fi
    
    # If no timezone found, return default
    if [ -z "$timezone" ]; then
        echo "$DEFAULT_UNIT"
        return
    fi
    
    # Countries and territories that primarily use imperial system (miles)
    # Based on current usage as of 2025:
    # - United States (including territories)
    # - Liberia 
    # - Myanmar/Burma (mixed usage, but officially imperial for distances)
    # - UK uses miles for road distances (though metric for most other measurements)
    # - Some British territories and dependencies
    case "$timezone" in
        # United States and territories - comprehensive timezone coverage
        *America/New_York*|*America/Chicago*|*America/Denver*|*America/Los_Angeles*|*America/Phoenix*|*America/Anchorage*|*America/Honolulu*)
            echo "mi"
            log_message "Default unit based on timezone ($timezone): miles (US major cities)"
            ;;
        # All Americas timezones that are US-based
        *America/Adak*|*America/Juneau*|*America/Metlakatla*|*America/Nome*|*America/Sitka*|*America/Yakutat*)
            echo "mi"
            log_message "Default unit based on timezone ($timezone): miles (US Alaska)"
            ;;
        # US territories in Pacific
        *Pacific/Honolulu*|*Pacific/Johnston*|*Pacific/Midway*|*Pacific/Wake*|*HST*|*Pacific/Samoa*)
            echo "mi"
            log_message "Default unit based on timezone ($timezone): miles (US Pacific territories)"
            ;;
        # US territories in other regions
        *America/Puerto_Rico*|*America/Virgin*|*Atlantic/Bermuda*)
            echo "mi"
            log_message "Default unit based on timezone ($timezone): miles (US territories)"
            ;;
        # General US timezone patterns
        *America/*EDT*|*America/*EST*|*America/*CDT*|*America/*CST*|*America/*MDT*|*America/*MST*|*America/*PDT*|*America/*PST*)
            echo "mi"
            log_message "Default unit based on timezone ($timezone): miles (US timezone abbreviations)"
            ;;
        # Simple timezone abbreviations commonly used in US systems
        *EST*|*CST*|*MST*|*PST*|*EDT*|*CDT*|*MDT*|*PDT*|*AKST*|*AKDT*|*HST*|\
        *Europe/London*|*GMT*|*BST*|*Europe/Belfast*|*Europe/Edinburgh*|*Europe/Cardiff*|\
        *Atlantic/Stanley*|*Indian/Chagos*|*Europe/Gibraltar*|*Atlantic/South_Georgia*|\
        *Africa/Monrovia*|*Asia/Yangon*|*Asia/Rangoon*)
            echo "mi"
            ;;
        *)
            echo "km"
            ;;
    esac
}

# Get current measurement unit from UCI
get_measurement_unit() {
    ensure_uci_section
    
    local unit=$(uci -q get ${UCI_CONFIG}.${UCI_SECTION}.${UCI_OPTION})
    
    # If no unit set in UCI, set default and return it
    if [ -z "$unit" ]; then
        unit="$DEFAULT_UNIT"
        uci set ${UCI_CONFIG}.${UCI_SECTION}.${UCI_OPTION}="$unit"
        uci commit ${UCI_CONFIG}
    fi
    
    echo "$unit"
}

# Save measurement unit to UCI
save_measurement_unit() {
    local unit="$1"
    ensure_uci_section
    
    uci set ${UCI_CONFIG}.${UCI_SECTION}.${UCI_OPTION}="$unit"
    uci commit ${UCI_CONFIG}
}

# Delete measurement unit configuration (revert to default)
delete_measurement_unit() {
    ensure_uci_section
    
    uci delete ${UCI_CONFIG}.${UCI_SECTION}.${UCI_OPTION} 2>/dev/null
    uci commit ${UCI_CONFIG}
}

# Check if current unit is the default
is_default_unit() {
    local unit=$(uci -q get ${UCI_CONFIG}.${UCI_SECTION}.${UCI_OPTION})
    
    # If UCI entry doesn't exist or equals default, it's default
    if [ -z "$unit" ] || [ "$unit" = "$DEFAULT_UNIT" ]; then
        echo "true"
    else
        echo "false"
    fi
}

# Handle GET request - Retrieve measurement unit preference
handle_get() {
    log_message "GET request received"
    
    # Check if this is a debug request
    if echo "$QUERY_STRING" | grep -q "debug=1"; then
        # Return diagnostic information
        local timezone_info=""
        
        if command -v uci >/dev/null 2>&1; then
            timezone_info="$timezone_info\"uci_system_zonename\": \"$(uci -q get system.@system[0].zonename || echo 'Not found')\","
            timezone_info="$timezone_info\"uci_system_timezone\": \"$(uci -q get system.@system[0].timezone || echo 'Not found')\","
        else
            timezone_info="$timezone_info\"uci\": \"Command not found\","
        fi
        
        if [ -f "/etc/config/system" ]; then
            timezone_info="$timezone_info\"openwrt_config\": \"$(cat /etc/config/system | grep -E 'zonename|timezone' | tr '\n' ' ' | sed 's/"/\\"/g')\","
        else
            timezone_info="$timezone_info\"openwrt_config\": \"Not found\","
        fi
        
        if [ -n "$TZ" ]; then
            timezone_info="$timezone_info\"TZ_env\": \"$TZ\","
        else
            timezone_info="$timezone_info\"TZ_env\": \"Not set\","
        fi
        
        if [ -f "/etc/TZ" ]; then
            timezone_info="$timezone_info\"etc_TZ\": \"$(cat /etc/TZ)\","
        else
            timezone_info="$timezone_info\"etc_TZ\": \"Not found\","
        fi
        
        # Get default unit
        local default_unit=$(get_default_unit)
        
        # Remove trailing comma
        timezone_info=$(echo "$timezone_info" | sed 's/,$//')
        
        send_success "Debug information" "{$timezone_info, \"default_unit\": \"$default_unit\"}"
        return
    fi
    
    # Get current unit
    local unit=$(get_measurement_unit)
    local is_default=$(is_default_unit)
    
    send_success "Measurement unit retrieved" "{\"unit\":\"$unit\",\"isDefault\":$is_default}"
}

# Handle POST request - Update measurement unit preference
handle_post() {
    # Read POST data
    local content_length=${CONTENT_LENGTH:-0}
    if [ "$content_length" -gt 0 ]; then
        local post_data=$(dd bs=$content_length count=1 2>/dev/null)
        
        # Parse JSON - extract unit value
        local unit=$(echo "$post_data" | sed -n 's/.*"unit"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
        
        # Fallback extraction
        if [ -z "$unit" ]; then
            unit=$(echo "$post_data" | grep -o '"unit":"[^"]*"' | cut -d'"' -f4)
        fi
        
        # Validate unit
        if [ "$unit" = "km" ] || [ "$unit" = "mi" ]; then
            save_measurement_unit "$unit"
            send_success "Measurement unit updated successfully" "{\"unit\":\"$unit\",\"isDefault\":false}"
        else
            send_error "INVALID_UNIT" "Invalid unit provided. Must be 'km' or 'mi'."
        fi
    else
        send_error "NO_DATA" "No data provided"
    fi
}

# Handle DELETE request - Reset to default
handle_delete() {
    delete_measurement_unit
    
    # After deleting, get the current unit (will be default)
    local current_unit=$(get_measurement_unit)
    
    send_success "Measurement unit reset to default" "{\"unit\":\"$current_unit\",\"isDefault\":true}"
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
