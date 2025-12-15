#!/bin/sh

# Ethernet Link Speed Limit Script for OpenWRT
# Uses ethtool to limit the maximum negotiated Ethernet link speed
# Configuration stored in UCI: quecmanager.eth_link

echo "Content-type: application/json"
echo ""

ETH_INTERFACE="eth0"

# Advertising mode values for ethtool:
# 0x003 = 10baseT Half + Full (10 Mbps only)
# 0x00f = 10baseT + 100baseT Half + Full (10/100 Mbps)
# 0x02f = 10/100 + 1000baseT Full (10/100/1000 Mbps)
# auto  = Reset to default/all supported modes

# Ensure UCI section exists
ensure_uci_section() {
    if ! uci get quecmanager.eth_link >/dev/null 2>&1; then
        uci set quecmanager.eth_link=eth_link
        uci commit quecmanager
    fi
}

# Get current configured limit from UCI
get_current_limit() {
    ensure_uci_section
    local limit=$(uci get quecmanager.eth_link.speed_limit 2>/dev/null)
    echo "${limit:-auto}"
}

# Apply ethtool settings based on limit value
apply_limit() {
    local limit="$1"
    local advertise_value=""
    
    case "$limit" in
        "10")
            advertise_value="0x003"
            ;;
        "100")
            advertise_value="0x00f"
            ;;
        "1000")
            advertise_value="0x02f"
            ;;
        "auto"|"")
            # Reset to auto/default - advertise all supported modes
            advertise_value="0x82f"
            ;;
        *)
            echo "{\"success\": false, \"error\": \"Invalid limit value\"}"
            exit 1
            ;;
    esac
    
    # Check if ethtool is available
    if ! command -v ethtool >/dev/null 2>&1; then
        echo "{\"success\": false, \"error\": \"ethtool not installed\"}"
        exit 1
    fi
    
    # Check if interface exists
    if ! ip link show "$ETH_INTERFACE" >/dev/null 2>&1; then
        echo "{\"success\": false, \"error\": \"Interface $ETH_INTERFACE not found\"}"
        exit 1
    fi
    
    # Apply the advertising limit with autonegotiation on
    ethtool -s "$ETH_INTERFACE" advertise "$advertise_value" autoneg on 2>/dev/null
    if [ $? -ne 0 ]; then
        echo "{\"success\": false, \"error\": \"Failed to set advertise mode\"}"
        exit 1
    fi
    
    # Force renegotiation
    ethtool -r "$ETH_INTERFACE" 2>/dev/null
    
    return 0
}

# Save limit to UCI config
save_limit() {
    local limit="$1"
    ensure_uci_section
    uci set quecmanager.eth_link.speed_limit="$limit"
    uci commit quecmanager
}

# Create/update init script for persistence
setup_persistence() {
    local init_script="/etc/init.d/eth_link_limit"
    
    # Create init.d script
    cat > "$init_script" << 'EOF'
#!/bin/sh /etc/rc.common

START=99
STOP=10

ETH_INTERFACE="eth0"

start() {
    local limit=$(uci get quecmanager.eth_link.speed_limit 2>/dev/null)
    local advertise_value=""
    
    case "$limit" in
        "10")
            advertise_value="0x003"
            ;;
        "100")
            advertise_value="0x00f"
            ;;
        "1000")
            advertise_value="0x02f"
            ;;
        *)
            advertise_value="0x82f"
            ;;
    esac
    
    # Wait for interface to be ready
    sleep 2
    
    if command -v ethtool >/dev/null 2>&1; then
        ethtool -s "$ETH_INTERFACE" advertise "$advertise_value" autoneg on 2>/dev/null
        ethtool -r "$ETH_INTERFACE" 2>/dev/null
    fi
}

stop() {
    # Reset to auto on stop
    if command -v ethtool >/dev/null 2>&1; then
        ethtool -s "$ETH_INTERFACE" advertise 0x82f autoneg on 2>/dev/null
        ethtool -r "$ETH_INTERFACE" 2>/dev/null
    fi
}
EOF
    
    chmod +x "$init_script" 2>/dev/null
    
    # Enable the service
    if [ -x "$init_script" ]; then
        "$init_script" enable 2>/dev/null
    fi
}

case "$REQUEST_METHOD" in
    GET)
        current_limit=$(get_current_limit)
        
        # Get actual link speed from ethtool for display
        actual_speed=""
        if command -v ethtool >/dev/null 2>&1; then
            actual_speed=$(ethtool "$ETH_INTERFACE" 2>/dev/null | grep "Speed:" | awk '{print $2}')
        fi
        
        echo "{\"success\": true, \"currentLimit\": \"$current_limit\", \"actualSpeed\": \"$actual_speed\"}"
        ;;
    POST)
        # Read POST data
        read -r post_data
        
        # Parse limit value (expects format: limit=value or JSON {"limit":"value"})
        limit_value=""
        
        # Try to parse as simple key=value
        if echo "$post_data" | grep -q "limit="; then
            limit_value=$(echo "$post_data" | sed 's/.*limit=\([^&]*\).*/\1/')
        fi
        
        # Try to parse as JSON
        if [ -z "$limit_value" ] && echo "$post_data" | grep -q '"limit"'; then
            limit_value=$(echo "$post_data" | sed 's/.*"limit"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        fi
        
        # Validate limit value
        case "$limit_value" in
            "auto"|"10"|"100"|"1000")
                # Valid values
                ;;
            *)
                echo "{\"success\": false, \"error\": \"Invalid limit value. Must be: auto, 10, 100, or 1000\"}"
                exit 1
                ;;
        esac
        
        # Apply the limit
        apply_limit "$limit_value"
        
        # Save configuration to UCI
        save_limit "$limit_value"
        
        # Setup persistence
        setup_persistence
        
        echo "{\"success\": true, \"message\": \"Ethernet link limit set to $limit_value\", \"currentLimit\": \"$limit_value\"}"
        ;;
    *)
        echo "{\"success\": false, \"error\": \"Invalid request method\"}"
        ;;
esac
