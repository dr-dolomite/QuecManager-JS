#!/bin/sh
# Installation script for Real-time Speed Monitor
# This script sets up the monitoring system on OpenWRT devices

set -e

echo "=== Real-time Speed Monitor Installation ==="

# Configuration variables
INTERFACE="rmnet_data0"    # Default interface - can be changed
WEBSOCKET_PORT="8080"      # Default WebSocket port

# Paths
SCRIPT_DIR="/www/cgi-bin/quecmanager/experimental"
MONITOR_SCRIPT="$SCRIPT_DIR/realtime_speed_monitor.sh"
CONTROL_SCRIPT="$SCRIPT_DIR/speed_monitor_control.sh"

# Function to check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check if websocat is installed
    if ! command -v websocat >/dev/null 2>&1; then
        echo "WARNING: websocat not found. Installing..."
        opkg update
        if ! opkg install websocat; then
            echo "ERROR: Failed to install websocat. Please install manually:"
            echo "  opkg update && opkg install websocat"
            exit 1
        fi
    else
        echo "✓ websocat is installed"
    fi
    
    # Check if bc is installed (for floating-point calculations)
    if ! command -v bc >/dev/null 2>&1; then
        echo "WARNING: bc (calculator) not found. Installing..."
        if ! opkg install bc; then
            echo "WARNING: bc installation failed. Floating-point calculations may not work properly"
        fi
    else
        echo "✓ bc (calculator) is installed"
    fi
    
    # Check if network interface exists
    if [ ! -d "/sys/class/net/$INTERFACE" ]; then
        echo "WARNING: Interface $INTERFACE not found"
        echo "Available interfaces:"
        ls /sys/class/net/ | grep -v lo | head -5
        echo ""
        echo "You may need to update the INTERFACE variable in the scripts"
    else
        echo "✓ Network interface $INTERFACE exists"
    fi
}

# Function to set up scripts
setup_scripts() {
    echo "Setting up monitoring scripts..."
    
    # Ensure directory exists
    mkdir -p "$SCRIPT_DIR"
    
    # Make scripts executable if they exist
    if [ -f "$MONITOR_SCRIPT" ]; then
        chmod +x "$MONITOR_SCRIPT"
        echo "✓ Made $MONITOR_SCRIPT executable"
    else
        echo "WARNING: $MONITOR_SCRIPT not found"
    fi
    
    if [ -f "$CONTROL_SCRIPT" ]; then
        chmod +x "$CONTROL_SCRIPT"
        echo "✓ Made $CONTROL_SCRIPT executable"
    else
        echo "WARNING: $CONTROL_SCRIPT not found"
    fi
}

# Function to test the system
test_system() {
    echo "Testing system functionality..."
    
    # Test if we can read network statistics
    if [ -f "/sys/class/net/$INTERFACE/statistics/rx_bytes" ]; then
        RX_BYTES=$(cat "/sys/class/net/$INTERFACE/statistics/rx_bytes" 2>/dev/null)
        TX_BYTES=$(cat "/sys/class/net/$INTERFACE/statistics/tx_bytes" 2>/dev/null)
        
        if [ -n "$RX_BYTES" ] && [ -n "$TX_BYTES" ]; then
            echo "✓ Can read network statistics (RX: $RX_BYTES, TX: $TX_BYTES)"
        else
            echo "WARNING: Cannot read network statistics properly"
        fi
    else
        echo "WARNING: Network statistics files not found for $INTERFACE"
    fi
    
    # Test websocat basic functionality
    if timeout 2 websocat --version >/dev/null 2>&1; then
        echo "✓ websocat is working"
    else
        echo "WARNING: websocat test failed"
    fi
    
    # Test if port is available
    if netstat -ln 2>/dev/null | grep -q ":$WEBSOCKET_PORT "; then
        echo "WARNING: Port $WEBSOCKET_PORT is already in use"
        echo "You may need to change WEBSOCKET_PORT in the scripts"
    else
        echo "✓ Port $WEBSOCKET_PORT is available"
    fi
}

# Function to configure interface
configure_interface() {
    echo ""
    echo "Current network interfaces:"
    ls /sys/class/net/ | grep -v lo
    echo ""
    
    read -p "Press Enter to use default interface ($INTERFACE) or type a new one: " USER_INTERFACE
    
    if [ -n "$USER_INTERFACE" ]; then
        if [ -d "/sys/class/net/$USER_INTERFACE" ]; then
            echo "Updating interface to: $USER_INTERFACE"
            
            # Update the interface in the monitor script
            if [ -f "$MONITOR_SCRIPT" ]; then
                sed -i "s/INTERFACE=\".*\"/INTERFACE=\"$USER_INTERFACE\"/" "$MONITOR_SCRIPT"
                echo "✓ Updated interface in monitoring script"
            fi
        else
            echo "ERROR: Interface $USER_INTERFACE does not exist"
            exit 1
        fi
    fi
}

# Function to show status
show_status() {
    echo ""
    echo "=== Current Status ==="
    
    # Check if service is running
    if pgrep -f "websocat.*$WEBSOCKET_PORT" >/dev/null; then
        PID=$(pgrep -f "websocat.*$WEBSOCKET_PORT")
        echo "✓ Monitoring service is RUNNING (PID: $PID)"
        echo "  WebSocket server: ws://127.0.0.1:$WEBSOCKET_PORT"
    else
        echo "○ Monitoring service is STOPPED"
    fi
    
    # Show interface status
    if [ -d "/sys/class/net/$INTERFACE" ]; then
        if [ -f "/sys/class/net/$INTERFACE/operstate" ]; then
            STATE=$(cat "/sys/class/net/$INTERFACE/operstate")
            echo "✓ Interface $INTERFACE is $STATE"
        fi
    fi
}

# Function to show usage instructions
show_usage() {
    echo ""
    echo "=== Usage Instructions ==="
    echo ""
    echo "1. Start monitoring:"
    echo "   $CONTROL_SCRIPT start"
    echo "   OR via CGI: POST /cgi-bin/quecmanager/experimental/speed_monitor_control.sh"
    echo "   Data: {\"action\":\"start\"}"
    echo ""
    echo "2. Stop monitoring:"
    echo "   $CONTROL_SCRIPT stop"
    echo ""
    echo "3. Check status:"
    echo "   $CONTROL_SCRIPT status"
    echo ""
    echo "4. WebSocket URL for frontend:"
    echo "   ws://127.0.0.1:$WEBSOCKET_PORT"
    echo ""
    echo "5. View logs:"
    echo "   logread | grep -i 'speed\\|websocat'"
    echo ""
}

# Main installation flow
main() {
    case "${1:-install}" in
        "install")
            check_prerequisites
            setup_scripts
            test_system
            configure_interface
            show_status
            show_usage
            echo ""
            echo "=== Installation Complete ==="
            echo "The real-time speed monitor is ready to use!"
            ;;
        "status")
            show_status
            ;;
        "test")
            test_system
            ;;
        "configure")
            configure_interface
            ;;
        *)
            echo "Usage: $0 [install|status|test|configure]"
            echo ""
            echo "Commands:"
            echo "  install   - Full installation and setup (default)"
            echo "  status    - Show current system status"
            echo "  test      - Test system functionality"
            echo "  configure - Configure network interface"
            ;;
    esac
}

# Run main function
main "$@"