#!/bin/sh

# Ethernet Hardware Details Fetch Script
# Provides ethernet interface information using ethtool

# Set common headers
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Cache-Control: no-cache, no-store, must-revalidate"
echo ""

# Lock file path
LOCK_FILE="/tmp/hw_details.lock"
LOCK_TIMEOUT=10  # Maximum wait time in seconds 

# Function to acquire lock
acquire_lock() {
    local start_time=$(date +%s)
    while [ -e "$LOCK_FILE" ]; do
        # Check if lock is stale (older than LOCK_TIMEOUT seconds)
        if [ -f "$LOCK_FILE" ]; then
            local lock_time=$(stat -c %Y "$LOCK_FILE" 2>/dev/null)
            local current_time=$(date +%s)
            if [ $((current_time - lock_time)) -gt $LOCK_TIMEOUT ]; then
                rm -f "$LOCK_FILE"
                break
            fi
        fi
        
        # Check if we've waited too long
        if [ $(($(date +%s) - start_time)) -gt $LOCK_TIMEOUT ]; then
            error_response "Timeout waiting for lock"
            exit 1
        fi
        
        sleep 0.1
    done
    
    # Create lock file with current PID
    echo $$ > "$LOCK_FILE"
}

# Function to release lock
release_lock() {
    rm -f "$LOCK_FILE"
}

# Function to handle errors and return JSON
error_response() {
    echo "{\"error\": \"$1\"}"
    exit 1
}

# Function to cleanup on exit
cleanup() {
    release_lock
    exit $?
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Function to get ethernet information
get_ethernet_info() {
    interface=${1:-eth0}
    
    # First check if interface exists at all
    if ! ip link show "$interface" >/dev/null 2>&1; then
        # Interface doesn't exist - return not connected state
        echo "{\"link_speed\":\"Not Connected\",\"link_status\":\"no\",\"auto_negotiation\":\"off\",\"connected\":false}"
        return 0
    fi
    
    # Check if interface is up (administratively)
    interface_state=$(ip link show "$interface" 2>/dev/null | grep -o "state [A-Z]*" | cut -d' ' -f2)
    if [ "$interface_state" = "DOWN" ]; then
        # Interface exists but is down - return not connected state
        echo "{\"link_speed\":\"Not Connected\",\"link_status\":\"no\",\"auto_negotiation\":\"off\",\"connected\":false}"
        return 0
    fi
    
    # Check if ethtool is available
    if ! which ethtool >/dev/null 2>&1; then
        # Fallback: basic interface info without ethtool
        echo "{\"link_speed\":\"Unknown\",\"link_status\":\"unknown\",\"auto_negotiation\":\"unknown\",\"connected\":true}"
        return 0
    fi
    
    # Run ethtool and capture output
    ethtool_output=$(ethtool "$interface" 2>/dev/null)
    if [ $? -ne 0 ]; then
        # ethtool failed - likely no physical connection
        echo "{\"link_speed\":\"Not Connected\",\"link_status\":\"no\",\"auto_negotiation\":\"off\",\"connected\":false}"
        return 0
    fi
    
    # Extract values using sed instead of grep -P
    speed=$(echo "$ethtool_output" | sed -n 's/.*Speed: \([^[:space:]]*\).*/\1/p')
    link_status=$(echo "$ethtool_output" | sed -n 's/.*Link detected: \(yes\|no\).*/\1/p')
    auto_negotiation=$(echo "$ethtool_output" | sed -n 's/.*Auto-negotiation: \(on\|off\).*/\1/p')
    
    # Set defaults if extraction failed
    [ -z "$speed" ] && speed="Unknown"
    [ -z "$link_status" ] && link_status="unknown"
    [ -z "$auto_negotiation" ] && auto_negotiation="unknown"
    
    # Check if link is actually detected
    if [ "$link_status" = "no" ]; then
        # Physical link not detected - return not connected state
        echo "{\"link_speed\":\"Not Connected\",\"link_status\":\"no\",\"auto_negotiation\":\"$auto_negotiation\",\"connected\":false}"
        return 0
    fi
    
    # Link is detected and active - return connected state
    echo "{\"link_speed\":\"$speed\",\"link_status\":\"$link_status\",\"auto_negotiation\":\"$auto_negotiation\",\"connected\":true}"
}

# Main execution
# Acquire lock before proceeding
acquire_lock

# Parse query string for interface parameter
interface=$(echo "$QUERY_STRING" | sed -n 's/.*interface=\([^&]*\).*/\1/p')

# Default interface if not specified
[ -z "$interface" ] && interface="eth0"

# Get ethernet information for the specified interface
get_ethernet_info "$interface"

# Lock will be automatically released by the cleanup trap