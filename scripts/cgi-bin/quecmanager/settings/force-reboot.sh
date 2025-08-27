#!/bin/sh

# Send CGI headers first
echo "Content-Type: application/json"
echo "Cache-Control: no-cache"
echo

# Simple script to force a reboot of the system
output_json() {
    local status="$1"
    local message="$2"
    echo "{\"status\": \"$status\", \"message\": \"$message\"}"
}

# Function to force reboot
force_reboot() {
    if command -v reboot >/dev/null 2>&1; then
        reboot
        return 0
    else
        return 1
    fi
}

# Main execution
main() {
    if force_reboot; then
        output_json "success" "System is rebooting"
    else
        output_json "error" "Reboot command not found or failed"
    fi
}

main