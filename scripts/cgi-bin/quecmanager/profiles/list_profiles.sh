#!/bin/sh
# Location: /www/cgi-bin/quecmanager/profiles/list_profiles.cgi

# Set content type to JSON
echo "Content-type: application/json"
echo ""

# Function to log messages
log_message() {
    local level="${2:-info}"
    logger -t quecprofiles -p "daemon.$level" "list_profiles: $1"
}

# Function to sanitize string for JSON
sanitize_for_json() {
    echo "$1" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed 's/\t/\\t/g' | tr -d '\r\n'
}

# Function to extract profiles from UCI config
get_profiles() {
    log_message "Fetching profiles from UCI config"
    
    # Check if UCI config exists
    if [ ! -f /etc/config/quecprofiles ]; then
        log_message "No profiles config found" "warn"
        echo '{"status":"success","profiles":[]}'
        return 0
    fi
    
    # Start JSON output
    local json_output=""
    local first=1
    local count=0
    
    # Find all profile sections
    for profile_section in $(uci -q show quecprofiles | grep "=profile$" | cut -d'.' -f2); do
        # Get profile details
        local name=$(uci -q get quecprofiles.$profile_section.name)
        local iccid=$(uci -q get quecprofiles.$profile_section.iccid)
        local imei=$(uci -q get quecprofiles.$profile_section.imei)
        local apn=$(uci -q get quecprofiles.$profile_section.apn)
        local pdp_type=$(uci -q get quecprofiles.$profile_section.pdp_type)
        local lte_bands=$(uci -q get quecprofiles.$profile_section.lte_bands)
        local nr5g_bands=$(uci -q get quecprofiles.$profile_section.nr5g_bands)
        local network_type=$(uci -q get quecprofiles.$profile_section.network_type)
        
        # Skip if missing required fields
        if [ -z "$name" ] || [ -z "$iccid" ] || [ -z "$apn" ]; then
            log_message "Skipping invalid profile: $profile_section" "warn"
            continue
        fi
        
        # Sanitize all values
        name=$(sanitize_for_json "$name")
        iccid=$(sanitize_for_json "$iccid")
        imei=$(sanitize_for_json "${imei:-""}")
        apn=$(sanitize_for_json "$apn")
        pdp_type=$(sanitize_for_json "${pdp_type:-"IPV4V6"}")
        lte_bands=$(sanitize_for_json "${lte_bands:-""}")
        nr5g_bands=$(sanitize_for_json "${nr5g_bands:-""}")
        network_type=$(sanitize_for_json "${network_type:-"LTE"}")
        
        # Create profile JSON
        local profile_json="{"
        profile_json="${profile_json}\"name\":\"${name}\","
        profile_json="${profile_json}\"iccid\":\"${iccid}\","
        profile_json="${profile_json}\"imei\":\"${imei}\","
        profile_json="${profile_json}\"apn\":\"${apn}\","
        profile_json="${profile_json}\"pdp_type\":\"${pdp_type}\","
        profile_json="${profile_json}\"lte_bands\":\"${lte_bands}\","
        profile_json="${profile_json}\"nr5g_bands\":\"${nr5g_bands}\","
        profile_json="${profile_json}\"network_type\":\"${network_type}\""
        profile_json="${profile_json}}"
        
        # Add comma if not first
        if [ $first -eq 0 ]; then
            json_output="${json_output},"
        else
            first=0
        fi
        
        # Add profile to output
        json_output="${json_output}${profile_json}"
        count=$((count+1))
    done
    
    # Complete the JSON response
    echo "{\"status\":\"success\",\"profiles\":[${json_output}]}"
    
    log_message "Found $count profiles"
    return 0
}

# Output debug info to log
log_message "Executing list_profiles.cgi" "debug"

# Main execution
{
    get_profiles
} || {
    # Error handler
    log_message "Failed to retrieve profiles" "error"
    echo '{"status":"error","message":"Failed to retrieve profiles","profiles":[]}'
    exit 1
}