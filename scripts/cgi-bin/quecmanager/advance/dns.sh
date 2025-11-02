#!/bin/sh
HOST_DIR=$(pwd)
echo "Content-type: application/json"
echo ""
# Validate authentication
if [ ! ${HTTP_AUTHORIZATION} ]; then
    echo '{"state":"failed", "message":"Authorization header missing"}'
    exit 1
fi
AUTH_RESPONSE=$(/bin/sh ${HOST_DIR}/cgi-bin/quecmanager/auth-token.sh process "${HTTP_AUTHORIZATION}")
AUTH_RESPONSE_STATUS=$?
if [ $AUTH_RESPONSE_STATUS -ne 0 ]; then
    echo "$AUTH_RESPONSE"
    exit $AUTH_RESPONSE_STATUS
fi

# Function to set custom DNS
toggle_custom_dns() {
    local interface=$1
    get_current_settings "$interface"
    local dns=$(prompt "Enter DNS servers (comma-separated)" "$CURRENT_DNS")

    if uci show dhcp.$interface &>/dev/null; then
        echo -e "\e[93mSetting DNS to: $dns\e[0m" # Yellow
    else
        uci add dhcp.$interface
        echo -e "\e[91m$interface section not found with UCI. Created and set dhcp_option to 6,$dns. \e[0m" # Red
    fi
    uci set dhcp.$interface.dhcp_option="6,$dns"
    apply_changes
}

# Function to use the provider's DNS (IPv4 only)
set_provider_dns() {
    local dns=$(awk '/^nameserver [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/ {print $2}' /tmp/resolv.conf.d/resolv.conf.auto | tr '\n' ',' | sed 's/,$//')
    echo -e "\e[93mSetting DNS to: $dns\e[0m" # Yellow
    uci set dhcp.lan.dhcp_option="6,$dns"
    apply_changes
}

get_current_settings() {
    local interface="$1"
    CURRENT_DNS=$(uci get dhcp.$interface.dhcp_option | grep -oE '6,.*' | cut -d, -f2-)
}

# Function to update IPv4 DNS values for a given interface
update_dns() {
    local interface="$1"
    local dns1="$2"
    local dns2="$3"
    local dns3="$4"

    # Build DNS server list (filter out empty values)
    local dns_list=""

    if [ -n "$dns1" ]; then
        dns_list="$dns1"
    fi

    if [ -n "$dns2" ]; then
        if [ -n "$dns_list" ]; then
            dns_list="$dns_list,$dns2"
        else
            dns_list="$dns2"
        fi
    fi

    if [ -n "$dns3" ]; then
        if [ -n "$dns_list" ]; then
            dns_list="$dns_list,$dns3"
        else
            dns_list="$dns3"
        fi
    fi

    # Check if dns_list is empty
    if [ -z "$dns_list" ]; then
        echo "{\"success\": false, \"error\": \"No DNS servers provided\"}"
        return 1
    fi

    # Validate that interface exists in UCI
    if ! uci show dhcp.$interface &>/dev/null; then
        # Create the section if it doesn't exist
        uci set dhcp.$interface=dhcp
        uci set dhcp.$interface.interface="$interface"
    fi

    # Set the DNS option (DHCP option 6 is DNS)
    uci set dhcp.$interface.dhcp_option="6,$dns_list"

    # Commit changes
    uci commit dhcp

    # Restart dnsmasq to apply changes
    /etc/init.d/dnsmasq restart

    echo "{\"success\": true, \"interface\": \"$interface\", \"dns\": \"$dns_list\"}"
    return 0
}

# Function to disable custom DNS (use provider's DNS)
disable_custom_dns() {
    local dns=$(awk '/^nameserver [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/ {print $2}' /tmp/resolv.conf.d/resolv.conf.auto | tr '\n' ',' | sed 's/,$//')
    uci set dhcp.lan.dhcp_option="6,$dns"
    uci commit dhcp
    /etc/init.d/dnsmasq restart
    echo "{\"success\": true, \"interface\": \"lan\", \"dns\": \"$dns\"}"
    return 0
}

case "$REQUEST_METHOD" in
    GET)
        # Ensure consistent JSON format for GET requests
        NIC=$(echo "$QUERY_STRING" | awk -F'[=&]' '{for(i=1;i<=NF;i++){if($i=="nic")print $(i+1)}}')
        get_current_settings "$NIC"
        STAT=$(cat /etc/quecmanager/settings/dns_mode)
        echo "{\"currentDNS\": \"$CURRENT_DNS\", \"mode\": \"$STAT\"}"
        ;;
    POST)
        read -r post_data

        # Parse JSON POST data
        MODE=$(echo "$post_data" | grep -o '"mode":"[^"]*"' | cut -d'"' -f4)
        NIC=$(echo "$post_data" | grep -o '"nic":"[^"]*"' | cut -d'"' -f4)
        DNS1=$(echo "$post_data" | grep -o '"dns1":"[^"]*"' | cut -d'"' -f4)
        DNS2=$(echo "$post_data" | grep -o '"dns2":"[^"]*"' | cut -d'"' -f4)
        DNS3=$(echo "$post_data" | grep -o '"dns3":"[^"]*"' | cut -d'"' -f4)

        # Default to 'lan' if no interface specified
        NIC=${NIC:-lan}
        echo $MODE > /etc/quecmanager/settings/dns_mode
        if [ "$MODE" = "enabled" ]; then
            update_dns "$NIC" "$DNS1" "$DNS2" "$DNS3"
        elif [ "$MODE" = "disabled" ]; then
            disable_custom_dns
        else
            echo "{\"success\": false, \"error\": \"Invalid mode. Use 'enabled' or 'disabled'\"}"
        fi
        ;;
    *)
        echo "{\"success\": false, \"error\": \"Invalid request method\"}"
        ;;
esac