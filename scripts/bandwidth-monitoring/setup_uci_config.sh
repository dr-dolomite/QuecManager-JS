#!/bin/sh
# Setup UCI configuration for Bridge Traffic Monitor

echo "Setting up UCI configuration for bridge_traffic_monitor..."

# Create the UCI section
uci set quecmanager.bridge_monitor=bridge_monitor

# Configure output path
uci set quecmanager.bridge_monitor.output_path='/tmp/quecmanager/bridge_traffic_monitor'

# Configure display mode (yes/no, true/false, 1/0, enabled/disabled)
uci set quecmanager.bridge_monitor.minimal_mode='no'

# Configure JSON mode
uci set quecmanager.bridge_monitor.json_mode='no'

# Configure refresh rate in milliseconds (100ms = 10 Hz)
uci set quecmanager.bridge_monitor.refresh_rate_ms='100'

# Configure required interfaces (comma-separated, no spaces)
uci set quecmanager.bridge_monitor.required_interfaces='rmnet_data0,rmnet_ipa0,eth0,br-lan,rmnet_data1'

# Configure WebSocket output as default on
uci set quecmanager.bridge_monitor.websocat_enabled='yes'

# Configure WebSocket URL
uci set quecmanager.bridge_monitor.websocat_url='ws://192.168.1.100:8838'

# Commit changes
uci commit quecmanager

echo "UCI configuration created successfully!"
echo ""
echo "View configuration:"
echo "  uci show quecmanager.bridge_monitor"
echo ""
echo "Modify settings:"
echo "  uci set quecmanager.bridge_monitor.output_path='/custom/path'"
echo "  uci set quecmanager.bridge_monitor.json_mode='yes'"
echo "  uci set quecmanager.bridge_monitor.websocat_enabled='yes'"
echo "  uci set quecmanager.bridge_monitor.websocat_url='ws://192.168.1.100:8838'"
echo "  uci commit quecmanager"

echo ""
echo "Remove configuration:"
echo "  uci delete quecmanager.bridge_monitor"
echo "  uci commit quecmanager"
