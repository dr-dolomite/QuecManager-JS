#!/bin/sh

# WebSocket Setup Script
# Handles UCI configuration and SSL certificate generation for WebSocket services
# This script is called by the websocat_setup init.d service
# Author: dr-dolomite
# Date: 2025-11-18

# Load centralized logging if available
LOGGER_SCRIPT="/www/cgi-bin/services/quecmanager_logger.sh"
if [ -f "$LOGGER_SCRIPT" ]; then
    . "$LOGGER_SCRIPT"
    USE_LOGGING=1
else
    USE_LOGGING=0
fi

SCRIPT_NAME="websocat_setup"

log_info() {
    if [ "$USE_LOGGING" = "1" ]; then
        qm_log_info "service" "$SCRIPT_NAME" "$1"
    else
        logger -t "$SCRIPT_NAME" "$1"
    fi
}

log_error() {
    if [ "$USE_LOGGING" = "1" ]; then
        qm_log_error "service" "$SCRIPT_NAME" "$1"
    else
        logger -t "$SCRIPT_NAME" "ERROR: $1"
    fi
}

# Check and create UCI configuration
setup_uci_config() {
    log_info "Checking UCI configuration..."
    
    # Check if bridge_monitor.channel exists
    if uci get quecmanager.bridge_monitor.channel >/dev/null 2>&1; then
        log_info "UCI configuration already exists"
        return 0
    fi
    
    log_info "Creating UCI configuration for bridge_monitor..."
    
    # Create the UCI section
    uci set quecmanager.bridge_monitor=bridge_monitor
    
    # Set all required configuration options
    uci set quecmanager.bridge_monitor.output_path=/tmp/quecmanager/bridge_traffic_monitor
    uci set quecmanager.bridge_monitor.minimal_mode=no
    uci set quecmanager.bridge_monitor.json_mode=yes
    uci set quecmanager.bridge_monitor.channel=network-monitor
    uci set quecmanager.bridge_monitor.refresh_rate_ms=1000
    uci set quecmanager.bridge_monitor.required_interfaces=br-lan,eth0,rmnet_data0,rmnet_data1,rmnet_ipa0
    uci set quecmanager.bridge_monitor.websocat_enabled=yes
    uci set quecmanager.bridge_monitor.websocat_url=wss://localhost:8838
    
    # Commit changes
    uci commit quecmanager
    
    log_info "UCI configuration created successfully"
    return 0
}

# Check and generate SSL certificates
setup_ssl_certificates() {
    log_info "Checking SSL certificates..."
    
    local cert_path="/etc/ssl/quecmanager_certs/cert.pem"
    local key_path="/etc/ssl/quecmanager_certs/private/key.pem"
    local pkcs12_path="/etc/ssl/quecmanager_certs/output.pkcs12"
    local need_generation=0

    # Check for and create certificate directory if missing
    if [ ! -d "/etc/ssl/quecmanager_certs" ]; then
        mkdir -p "/etc/ssl/quecmanager_certs/private" || {
            log_error "Failed to create certificate directory"
            return 1
        }
        log_info "Created certificate directory"
    fi
    
    # Check if all required files exist
    if [ ! -f "$cert_path" ] || [ ! -f "$key_path" ] || [ ! -f "$pkcs12_path" ]; then
        need_generation=1
        log_info "SSL certificates missing, generating new ones..."
    else
        log_info "SSL certificates already exist"
        return 0
    fi
    
    # Check if openssl is available
    if ! command -v openssl >/dev/null 2>&1; then
        log_error "openssl-util not installed. Please install: opkg install openssl-util"
        return 1
    fi
    
    # Generate private key and certificate
    log_info "Generating self-signed certificate..."
    if ! openssl req -x509 -newkey rsa:4096 -keyout "$key_path" -out "$cert_path" \
        -days 365 -nodes -subj "/CN=localhost" >/dev/null 2>&1; then
        log_error "Failed to generate certificate and key"
        return 1
    fi
    
    log_info "Certificate and key generated successfully"
    
    # Convert to PKCS12 format
    log_info "Converting to PKCS12 format..."
    if ! openssl pkcs12 -export -out "$pkcs12_path" -inkey "$key_path" -in "$cert_path" \
        -password pass:password >/dev/null 2>&1; then
        log_error "Failed to convert to PKCS12 format"
        return 1
    fi
    
    log_info "PKCS12 certificate created successfully"
    log_info "Certificate files created at:"
    log_info "  - $cert_path"
    log_info "  - $key_path"
    log_info "  - $pkcs12_path"
    
    return 0
}

# Main execution
main() {
    log_info "WebSocket setup script starting..."
    
    # Setup UCI configuration
    setup_uci_config
    uci_result=$?
    
    # Setup SSL certificates
    setup_ssl_certificates
    ssl_result=$?
    
    if [ $uci_result -eq 0 ] && [ $ssl_result -eq 0 ]; then
        log_info "WebSocket setup completed successfully"
        return 0
    else
        log_error "WebSocket setup completed with errors"
        return 1
    fi
}

# Run main function
main "$@"
