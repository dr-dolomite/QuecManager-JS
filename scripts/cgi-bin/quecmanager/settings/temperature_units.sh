#!/bin/sh

# Temperature Units Configuration Script
# Manages temperature unit preferences (Celsius/Fahrenheit) using UCI
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
UCI_OPTION="temperature_unit"
DEFAULT_UNIT="celsius"

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

# Check if the country uses Fahrenheit or Celsius based on timezone
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
    
    # Countries and territories that primarily use Fahrenheit
    # As of 2025:
    # - United States (including territories)
    # - Bahamas
    # - Belize
    # - Cayman Islands
    # - Palau
    # - Federated States of Micronesia
    # - Marshall Islands
    case "$timezone" in
        # United States and territories - comprehensive timezone coverage
        *America/New_York*|*America/Chicago*|*America/Denver*|*America/Los_Angeles*|*America/Phoenix*|*America/Anchorage*|*America/Honolulu*|\
        *America/Adak*|*America/Juneau*|*America/Metlakatla*|*America/Nome*|*America/Sitka*|*America/Yakutat*|\
        *Pacific/Honolulu*|*Pacific/Johnston*|*Pacific/Midway*|*Pacific/Wake*|*HST*|*Pacific/Pohnpei*|*Pacific/Majuro*|\
        *America/Puerto_Rico*|*America/Virgin*|*Atlantic/Bermuda*|\
        *America/*EDT*|*America/*EST*|*America/*CDT*|*America/*CST*|*America/*MDT*|*America/*MST*|*America/*PDT*|*America/*PST*|\
        *EST*|*CST*|*MST*|*PST*|*EDT*|*CDT*|*MDT*|*PDT*|*AKST*|*AKDT*|\
        *America/Nassau*|*America/Belize*|*America/Cayman*|*Pacific/Palau*)
            echo "fahrenheit"
            ;;
        *)
            echo "celsius"
            ;;
    esac
}

# Get current temperature unit from UCI
get_temperature_unit() {
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

# Save temperature unit to UCI
save_temperature_unit() {
    local unit="$1"
    ensure_uci_section
    
    uci set ${UCI_CONFIG}.${UCI_SECTION}.${UCI_OPTION}="$unit"
    uci commit ${UCI_CONFIG}
}

# Delete temperature unit configuration (revert to default)
delete_temperature_unit() {
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

# Handle GET request
handle_get() {
    local current_unit=$(get_temperature_unit)
    local is_default=$(is_default_unit)
    
    send_success "Temperature unit retrieved successfully" "{\"unit\":\"$current_unit\",\"isDefault\":$is_default}"
}

# Handle POST request
handle_post() {
    # Read JSON input from stdin
    local json_input=$(cat)
    
    # Extract unit from JSON
    local unit=$(echo "$json_input" | grep -o '"unit"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"unit"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')
    
    # Validate unit
    if [ "$unit" != "celsius" ] && [ "$unit" != "fahrenheit" ]; then
        send_error "INVALID_UNIT" "Invalid temperature unit. Must be 'celsius' or 'fahrenheit'."
    fi
    
    # Save the unit
    save_temperature_unit "$unit"
    
    send_success "Temperature unit updated successfully" "{\"unit\":\"$unit\",\"isDefault\":false}"
}

# Handle DELETE request
handle_delete() {
    delete_temperature_unit
    
    # After deleting, get the current unit (will be default)
    local current_unit=$(get_temperature_unit)
    
    send_success "Temperature unit reset to default" "{\"unit\":\"$current_unit\",\"isDefault\":true}"
}

# Main execution

case "$REQUEST_METHOD" in
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
        # Handle preflight CORS request
        exit 0
        ;;
    *)
        send_error "INVALID_METHOD" "Invalid request method. Use GET, POST, or DELETE."
        ;;
esac

exit 0