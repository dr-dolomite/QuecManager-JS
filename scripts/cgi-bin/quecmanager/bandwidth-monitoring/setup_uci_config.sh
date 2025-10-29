#!/bin/sh
# Setup UCI configuration for Bridge Traffic Monitor

echo "Setting up UCI configuration for bridge_traffic_monitor..."

# Create the UCI section
uci set quecmanager.bridge_monitor=bridge_monitor

# File Based StdOut Output file path (default: /tmp/quecmanager/bridge_traffic_monitor)
uci set quecmanager.bridge_monitor.output_path='/tmp/quecmanager/bridge_traffic_monitor'

# Configure display mode (yes/no, true/false, 1/0, enabled/disabled)
uci set quecmanager.bridge_monitor.minimal_mode='no'

# Configure JSON mode
uci set quecmanager.bridge_monitor.json_mode='yes'

# Configure channel name for JSON output
uci set quecmanager.bridge_monitor.channel='network-monitor'

# Configure refresh rate in milliseconds (100ms = 10 Hz)
uci set quecmanager.bridge_monitor.refresh_rate_ms='1000'

# Configure required interfaces (comma-separated, no spaces)
uci set quecmanager.bridge_monitor.required_interfaces='br-lan,eth0,rmnet_data0,rmnet_data1,rmnet_ipa0'

# Configure WebSocket output as default on
uci set quecmanager.bridge_monitor.websocat_enabled='yes'

# Configure WebSocket URL
uci set quecmanager.bridge_monitor.websocat_url='ws://localhost:8838'

# Commit changes
uci commit quecmanager

echo "UCI configuration created successfully!"
echo ""
echo "View configuration:"
echo "  uci show quecmanager.bridge_monitor"
echo ""
echo "Modify settings:"
echo "  uci set quecmanager.bridge_monitor.output_path='/tmp/quecmanager/bridge_traffic_monitor'"
echo "  uci set quecmanager.bridge_monitor.required_interfaces='br-lan,eth0,rmnet_data0,rmnet_data1,rmnet_ipa0'"
echo "  uci set quecmanager.bridge_monitor.refresh_rate_ms='1000'"
echo "  uci set quecmanager.bridge_monitor.minimal_mode='no'"
echo "  uci set quecmanager.bridge_monitor.json_mode='yes'"
echo "  uci set quecmanager.bridge_monitor.channel='network-monitor'"
echo "  uci set quecmanager.bridge_monitor.websocat_enabled='yes'"
echo "  uci set quecmanager.bridge_monitor.websocat_url='ws://192.168.224.1:8838'"
echo "  uci commit quecmanager"

echo ""
echo "Remove configuration:"
echo "  uci delete quecmanager.bridge_monitor"
echo "  uci commit quecmanager"
