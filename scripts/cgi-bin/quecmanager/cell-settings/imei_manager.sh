#!/bin/sh

# Configuration
UCI_SECTION="quecmanager.imei"
PREV_IMEI_OPTION="previous"

# Function to log messages
log_message() {
    local level="$1"
    local message="$2"
    logger -t imei_manager "${level}: ${message}"
}

# Function to get previous IMEI
get_previous() {
    local prev_imei=$(uci get ${UCI_SECTION}.${PREV_IMEI_OPTION} 2>/dev/null)
    
    if [ -z "$prev_imei" ]; then
        echo "Status: 200 OK"
        echo "Content-Type: application/json"
        echo ""
        echo "{\"status\":\"success\",\"previous_imei\":null}"
    else
        echo "Status: 200 OK"
        echo "Content-Type: application/json"
        echo ""
        echo "{\"status\":\"success\",\"previous_imei\":\"$prev_imei\"}"
    fi
}

# Function to set previous IMEI
set_previous() {
    local imei="$1"
    
    if [ -z "$imei" ]; then
        echo "Status: 400 Bad Request"
        echo "Content-Type: application/json"
        echo ""
        echo "{\"error\":\"Missing IMEI\"}"
        exit 1
    fi
    
    # Ensure the config section exists
    if ! uci get quecmanager >/dev/null 2>&1; then
        uci set quecmanager=config
    fi
    
    if ! uci get ${UCI_SECTION} >/dev/null 2>&1; then
        uci set ${UCI_SECTION}=imei
    fi
    
    uci set ${UCI_SECTION}.${PREV_IMEI_OPTION}="$imei"
    uci commit quecmanager
    
    log_message "INFO" "Saved previous IMEI: $imei"
    
    echo "Status: 200 OK"
    echo "Content-Type: application/json"
    echo ""
    echo "{\"status\":\"success\",\"message\":\"Previous IMEI saved\"}"
}

# Handle requests
if [ "$REQUEST_METHOD" = "GET" ]; then
    get_previous
    exit 0
elif [ "$REQUEST_METHOD" = "POST" ]; then
    read -r POST_DATA
    ACTION=$(echo "$POST_DATA" | grep -o 'action=[^&]*' | cut -d'=' -f2)
    IMEI=$(echo "$POST_DATA" | grep -o 'imei=[^&]*' | cut -d'=' -f2)
    
    if [ "$ACTION" = "set_previous" ]; then
        set_previous "$IMEI"
        exit 0
    fi
fi

# Default error
echo "Status: 400 Bad Request"
echo "Content-Type: application/json"
echo ""
echo "{\"error\":\"Invalid request\"}"
exit 1
