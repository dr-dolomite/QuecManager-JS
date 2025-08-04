#!/bin/sh

# Ping Latency Script with Enable/Disable Configuration
# Author: dr-dolomite
# Date: 2025-08-04

# Set the content type to JSON
echo "Content-Type: application/json"
echo ""

# Configuration
CONFIG_DIR="/etc/quecmanager/settings"
CONFIG_FILE="$CONFIG_DIR/ping_settings.conf"

# Check if ping is enabled (default: enabled if no config exists)
is_ping_enabled() {
    # If config file exists, read the setting
    if [ -f "$CONFIG_FILE" ]; then
        ping_enabled=$(grep "^PING_ENABLED=" "$CONFIG_FILE" | cut -d'=' -f2)
        if [ "$ping_enabled" = "false" ] || [ "$ping_enabled" = "0" ] || [ "$ping_enabled" = "off" ]; then
            return 1  # Disabled
        fi
    fi
    return 0  # Enabled (default)
}

# Check if ping is enabled before proceeding
if ! is_ping_enabled; then
    echo '{"connection": "DISABLED", "latency": 0}'
    exit 0
fi

# Ping 8.8.8.8 with 5 packets and capture the full output
ping_result=$(ping -c 5 8.8.8.8)

# Check if ping was successful
if [ $? -eq 0 ]; then
    # Extract the average latency using awk
    avg_latency=$(echo "$ping_result" | awk '/avg/ {split($4, a, "/"); print int(a[2])}')
    
    # If average latency was extracted, return it
    if [ ! -z "$avg_latency" ]; then
        echo "{\"connection\": \"ACTIVE\", \"latency\": $avg_latency}"
    else
        echo '{"connection": "ACTIVE", "latency": 0}'
    fi
else
    # Ping failed
    echo '{"connection": "INACTIVE", "latency": 0}'
fi