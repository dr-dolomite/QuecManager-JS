#!/bin/sh

# Memory Settings Fetch Script
# Simple script to read memory configuration and return JSON

# Set content type and CORS headers
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Configuration paths
CONFIG_FILE="/etc/quecmanager/settings/memory_settings.conf"
FALLBACK_CONFIG_FILE="/tmp/quecmanager/settings/memory_settings.conf"
PID_FILE="/tmp/quecmanager/memory_daemon.pid"

# Determine which config file to use
if [ -f "$CONFIG_FILE" ]; then
    ACTIVE_CONFIG="$CONFIG_FILE"
elif [ -f "$FALLBACK_CONFIG_FILE" ]; then
    ACTIVE_CONFIG="$FALLBACK_CONFIG_FILE"
else
    ACTIVE_CONFIG=""
fi

# Default values
ENABLED="true"
INTERVAL="1"
IS_DEFAULT="true"

# Read config if it exists
if [ -n "$ACTIVE_CONFIG" ] && [ -f "$ACTIVE_CONFIG" ]; then
    # Parse MEMORY_ENABLED
    val=$(grep -E "^MEMORY_ENABLED=" "$ACTIVE_CONFIG" | tail -n1 | cut -d'=' -f2 | tr -d '\r' 2>/dev/null || echo "")
    if [ -n "$val" ]; then
        case "$val" in
            true|1|on|yes|enabled) ENABLED="true" ;;
            *) ENABLED="false" ;;
        esac
        IS_DEFAULT="false"
    fi
    
    # Parse MEMORY_INTERVAL
    val=$(grep -E "^MEMORY_INTERVAL=" "$ACTIVE_CONFIG" | tail -n1 | cut -d'=' -f2 | tr -d '\r' 2>/dev/null || echo "")
    if [ -n "$val" ] && echo "$val" | grep -qE '^[0-9]+$'; then
        INTERVAL="$val"
    fi
fi

# Check if daemon is running
RUNNING="false"
if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        RUNNING="true"
    fi
fi

# Output JSON response
echo "{\"status\":\"success\",\"message\":\"Memory configuration retrieved\",\"data\":{\"enabled\":$ENABLED,\"interval\":$INTERVAL,\"running\":$RUNNING,\"isDefault\":$IS_DEFAULT}}"