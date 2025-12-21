#!/bin/sh

echo "Content-type: application/json"
echo ""

ttl_file="/etc/firewall.user.ttl"
lan_utils_script="/etc/data/lanUtils.sh"
init_script="/etc/init.d/quecmanager_ttl"

setup_persistent_config() {
    if [ ! -f "$lan_utils_script" ]; then
        echo "{\"success\": false, \"error\": \"lanUtils.sh not found\"}"
        exit 1
    fi

    # Backup the original script if not already done
    if [ ! -f "${lan_utils_script}.bak" ]; then
        cp "$lan_utils_script" "${lan_utils_script}.bak"
    fi

    # Add the local ttl_firewall_file line if it's not already present
    if ! grep -q "local ttl_firewall_file" "$lan_utils_script"; then
        sed -i '/local tcpmss_firewall_filev6/a \  local ttl_firewall_file=/etc/firewall.user.ttl' "$lan_utils_script"
    fi

    # Add the condition to include the ttl_firewall_file if it's not already present
    if ! grep -q "if \[ -f \"\$ttl_firewall_file\" \]; then" "$lan_utils_script"; then
        sed -i '/if \[ -f "\$tcpmss_firewall_filev6" \]; then/i \  if [ -f "\$ttl_firewall_file" ]; then\n    cat \$ttl_firewall_file >> \$firewall_file\n  fi' "$lan_utils_script"
    fi
}

# Setup init.d startup script for TTL persistence
setup_init_script() {
    cat > "$init_script" << 'INITEOF'
#!/bin/sh /etc/rc.common

START=99
STOP=10

USE_PROCD=1

TTL_FILE="/etc/firewall.user.ttl"
LOGGER_SCRIPT="/www/cgi-bin/services/quecmanager_logger.sh"
SCRIPT_NAME="quecmanager_ttl"

# Source logger if available
if [ -f "$LOGGER_SCRIPT" ]; then
    . "$LOGGER_SCRIPT"
fi

log_message() {
    local level="$1"
    local message="$2"
    if [ -f "$LOGGER_SCRIPT" ]; then
        qm_log "settings" "$SCRIPT_NAME" "$level" "$message"
    fi
}

check_rules_exist() {
    # Check if TTL rules are already applied (by lanUtils.sh or other method)
    local ttl_val="$1"
    local hl_val="$2"
    local ttl_exists=1
    local hl_exists=1
    
    if [ -n "$ttl_val" ] && [ "$ttl_val" -gt 0 ]; then
        iptables -t mangle -C POSTROUTING -o rmnet+ -j TTL --ttl-set "$ttl_val" 2>/dev/null && ttl_exists=0
    fi
    if [ -n "$hl_val" ] && [ "$hl_val" -gt 0 ]; then
        ip6tables -t mangle -C POSTROUTING -o rmnet+ -j HL --hl-set "$hl_val" 2>/dev/null && hl_exists=0
    fi
    
    # Return 0 if both exist (or not needed)
    [ "$ttl_exists" = "0" ] || [ "$hl_exists" = "0" ]
    return $?
}

start_service() {
    # Wait for network interfaces to be ready
    sleep 5
    
    # Apply TTL rules if file exists and has content
    if [ -s "$TTL_FILE" ]; then
        # Extract TTL and HL values from file
        ttl_value=$(grep 'iptables -t mangle -A POSTROUTING' "$TTL_FILE" | awk '{for(i=1;i<=NF;i++){if($i=="--ttl-set"){print $(i+1)}}}')
        hl_value=$(grep 'ip6tables -t mangle -A POSTROUTING' "$TTL_FILE" | awk '{for(i=1;i<=NF;i++){if($i=="--hl-set"){print $(i+1)}}}')
        
        local applied=0
        
        # Apply TTL rule if not already exists
        if [ -n "$ttl_value" ] && [ "$ttl_value" -gt 0 ]; then
            if ! iptables -t mangle -C POSTROUTING -o rmnet+ -j TTL --ttl-set "$ttl_value" 2>/dev/null; then
                iptables -t mangle -A POSTROUTING -o rmnet+ -j TTL --ttl-set "$ttl_value"
                applied=1
            fi
        fi
        
        # Apply HL rule if not already exists
        if [ -n "$hl_value" ] && [ "$hl_value" -gt 0 ]; then
            if ! ip6tables -t mangle -C POSTROUTING -o rmnet+ -j HL --hl-set "$hl_value" 2>/dev/null; then
                ip6tables -t mangle -A POSTROUTING -o rmnet+ -j HL --hl-set "$hl_value"
                applied=1
            fi
        fi
        
        if [ "$applied" = "1" ]; then
            log_message "INFO" "TTL/HL rules applied (TTL: ${ttl_value:-0}, HL: ${hl_value:-0})"
        else
            log_message "INFO" "TTL/HL rules already active (TTL: ${ttl_value:-0}, HL: ${hl_value:-0}), skipping"
        fi
    fi
}

stop_service() {
    # Get current TTL and HL values
    if [ -s "$TTL_FILE" ]; then
        ttl_value=$(grep 'iptables -t mangle -A POSTROUTING' "$TTL_FILE" | awk '{for(i=1;i<=NF;i++){if($i=="--ttl-set"){print $(i+1)}}}')
        hl_value=$(grep 'ip6tables -t mangle -A POSTROUTING' "$TTL_FILE" | awk '{for(i=1;i<=NF;i++){if($i=="--hl-set"){print $(i+1)}}}')
        
        if [ -n "$ttl_value" ]; then
            iptables -t mangle -D POSTROUTING -o rmnet+ -j TTL --ttl-set "$ttl_value" 2>/dev/null
        fi
        if [ -n "$hl_value" ]; then
            ip6tables -t mangle -D POSTROUTING -o rmnet+ -j HL --hl-set "$hl_value" 2>/dev/null
        fi
        log_message "INFO" "TTL/HL rules removed (TTL: ${ttl_value:-0}, HL: ${hl_value:-0})"
    fi
}

reload_service() {
    stop_service
    start_service
}
INITEOF

    chmod +x "$init_script"
    
    # Enable the service to start at boot
    "$init_script" enable 2>/dev/null
}

# Remove init script when TTL is disabled
remove_init_script() {
    if [ -f "$init_script" ]; then
        "$init_script" disable 2>/dev/null
        rm -f "$init_script"
    fi
}

clear_existing_rules() {
    local current_ttl=$1
    local current_hl=$2
    if [ -n "$current_ttl" ]; then
        iptables -t mangle -D POSTROUTING -o rmnet+ -j TTL --ttl-set "$current_ttl" 2>/dev/null
    fi
    if [ -n "$current_hl" ]; then
        ip6tables -t mangle -D POSTROUTING -o rmnet+ -j HL --hl-set "$current_hl" 2>/dev/null
    fi
}

case "$REQUEST_METHOD" in
    GET)
        # Ensure consistent JSON format for GET requests
        if [ -s "$ttl_file" ]; then
            ttl_value=$(grep 'iptables -t mangle -A POSTROUTING' "$ttl_file" | awk '{for(i=1;i<=NF;i++){if($i=="--ttl-set"){print $(i+1)}}}')
            hl_value=$(grep 'ip6tables -t mangle -A POSTROUTING' "$ttl_file" | awk '{for(i=1;i<=NF;i++){if($i=="--hl-set"){print $(i+1)}}}')
            
            # Ensure ttl_value is a number, default to 0 if not
            if ! [ "$ttl_value" ] || ! echo "$ttl_value" | grep -qE '^[0-9]+$'; then
                ttl_value=0
            else
                ttl_value=$(echo "$ttl_value" | sed 's/^0*//')
                [ -z "$ttl_value" ] && ttl_value=0
            fi
            
            # Ensure hl_value is a number, default to ttl_value if not set
            if ! [ "$hl_value" ] || ! echo "$hl_value" | grep -qE '^[0-9]+$'; then
                hl_value=$ttl_value
            else
                hl_value=$(echo "$hl_value" | sed 's/^0*//')
                [ -z "$hl_value" ] && hl_value=$ttl_value
            fi
            
            echo "{\"isEnabled\": true, \"currentValue\": $ttl_value, \"hlValue\": $hl_value}"
        else
            echo "{\"isEnabled\": false, \"currentValue\": 0, \"hlValue\": 0}"
        fi
        ;;
    POST)
        read -r post_data
        
        # Parse ttl and hl values from POST data
        # Support both formats: ttl=X&hl=Y (form) or JSON {"ttl": X, "hl": Y}
        if echo "$post_data" | grep -q '"ttl"'; then
            # JSON format
            ttl_value=$(echo "$post_data" | sed 's/.*"ttl"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/')
            hl_value=$(echo "$post_data" | sed 's/.*"hl"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/')
        else
            # Form format: ttl=X&hl=Y
            ttl_value=$(echo "$post_data" | sed -n 's/.*ttl=\([0-9]*\).*/\1/p')
            hl_value=$(echo "$post_data" | sed -n 's/.*hl=\([0-9]*\).*/\1/p')
        fi
        
        # Default hl_value to ttl_value if not provided
        [ -z "$hl_value" ] && hl_value="$ttl_value"
        
        # Ensure ttl_file exists
        touch "$ttl_file" 2>/dev/null
        if [ ! -f "$ttl_file" ]; then
            echo "{\"success\": false, \"error\": \"Cannot create TTL file\"}"
            exit 1
        fi

        # Setup persistent configuration (legacy lanUtils method)
        setup_persistent_config
        
        # Get current values for cleanup
        current_ttl=$(grep 'iptables -t mangle -A POSTROUTING' "$ttl_file" | awk '{for(i=1;i<=NF;i++){if($i=="--ttl-set"){print $(i+1)}}}')
        current_hl=$(grep 'ip6tables -t mangle -A POSTROUTING' "$ttl_file" | awk '{for(i=1;i<=NF;i++){if($i=="--hl-set"){print $(i+1)}}}')
        
        # Validate TTL value
        if ! echo "$ttl_value" | grep -qE '^[0-9]+$'; then
            echo "{\"success\": false, \"error\": \"Invalid TTL value\"}"
            exit 1
        fi
        
        # Validate HL value
        if ! echo "$hl_value" | grep -qE '^[0-9]+$'; then
            echo "{\"success\": false, \"error\": \"Invalid HL value\"}"
            exit 1
        fi
        
        if [ "$ttl_value" = "0" ] && [ "$hl_value" = "0" ]; then
            clear_existing_rules "$current_ttl" "$current_hl"
            > "$ttl_file"
            # Remove init script when disabled
            remove_init_script
            echo "{\"success\": true}"
        else
            # Clear existing rules
            clear_existing_rules "$current_ttl" "$current_hl"
            
            # Clear file first
            > "$ttl_file"
            
            # Set new rules - only add if value > 0
            if [ "$ttl_value" -gt 0 ]; then
                echo "iptables -t mangle -A POSTROUTING -o rmnet+ -j TTL --ttl-set $ttl_value" >> "$ttl_file"
                iptables -t mangle -A POSTROUTING -o rmnet+ -j TTL --ttl-set "$ttl_value"
            fi
            
            if [ "$hl_value" -gt 0 ]; then
                echo "ip6tables -t mangle -A POSTROUTING -o rmnet+ -j HL --hl-set $hl_value" >> "$ttl_file"
                ip6tables -t mangle -A POSTROUTING -o rmnet+ -j HL --hl-set "$hl_value"
            fi
            
            # Setup init script for boot persistence
            setup_init_script
            
            echo "{\"success\": true}"
        fi
        ;;
    *)
        echo "{\"success\": false, \"error\": \"Invalid request method\"}"
        ;;
esac