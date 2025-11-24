#!/bin/sh
# HTTPS Redirect Settings Management Script
# Manages uhttpd HTTP to HTTPS redirect configuration
# Author: dr-dolomite
# Date: 2025-11-24

# HTTP headers
echo "Content-Type: application/json"
echo "Cache-Control: no-cache"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

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
    local enabled="$2"
    echo "{\"status\":\"success\",\"message\":\"$message\",\"data\":{\"enabled\":$enabled}}"
}

# Get current redirect setting from uhttpd
get_redirect_setting() {
    local setting=$(uci -q get uhttpd.main.redirect_https)
    
    # Return true if set to 1, false otherwise
    if [ "$setting" = "1" ]; then
        echo "true"
    else
        echo "false"
    fi
}

# Enable HTTPS redirect
enable_redirect() {
    uci set uhttpd.main.redirect_https='1'
    if [ $? -ne 0 ]; then
        send_error "UCI_FAILED" "Failed to set redirect configuration"
    fi
    
    uci commit uhttpd
    if [ $? -ne 0 ]; then
        send_error "COMMIT_FAILED" "Failed to commit configuration"
    fi
    
    # Send success response before restarting
    send_success "HTTPS redirect enabled successfully" "true"
    
    # Restart uhttpd in background after response is sent
    ( sleep 1; /etc/init.d/uhttpd restart ) &
}

# Disable HTTPS redirect
disable_redirect() {
    uci delete uhttpd.main.redirect_https 2>/dev/null
    if [ $? -ne 0 ]; then
        # If delete fails, might not exist, still try to commit
        :
    fi
    
    uci commit uhttpd
    if [ $? -ne 0 ]; then
        send_error "COMMIT_FAILED" "Failed to commit configuration"
    fi
    
    # Send success response before restarting
    send_success "HTTPS redirect disabled successfully" "false"
    
    # Restart uhttpd in background after response is sent
    ( sleep 1; /etc/init.d/uhttpd restart ) &
}

# Handle GET request
handle_get() {
    local enabled=$(get_redirect_setting)
    echo "{\"status\":\"success\",\"data\":{\"enabled\":$enabled}}"
}

# Handle POST request
handle_post() {
    if [ -z "$CONTENT_LENGTH" ] || [ "$CONTENT_LENGTH" -eq 0 ]; then
        send_error "NO_DATA" "No data provided"
    fi
    
    # Read JSON input
    local input=$(head -c "$CONTENT_LENGTH")
    
    # Extract enabled value
    local enabled=$(echo "$input" | grep -o '"enabled"[[:space:]]*:[[:space:]]*[^,}]*' | sed 's/.*:[[:space:]]*//' | tr -d '"' | tr -d ' ')
    
    if [ "$enabled" = "true" ]; then
        enable_redirect
    elif [ "$enabled" = "false" ]; then
        disable_redirect
    else
        send_error "INVALID_VALUE" "Invalid value for enabled. Must be true or false."
    fi
}

# Main execution
case "${REQUEST_METHOD:-GET}" in
    GET)
        handle_get
        ;;
    POST)
        handle_post
        ;;
    OPTIONS)
        # Handle CORS preflight
        exit 0
        ;;
    *)
        send_error "METHOD_NOT_ALLOWED" "HTTP method ${REQUEST_METHOD} not supported"
        ;;
esac

exit 0
