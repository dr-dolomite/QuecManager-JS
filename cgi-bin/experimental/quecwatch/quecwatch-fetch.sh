#!/bin/sh

# Set headers for JSON response
echo "Content-type: application/json"
echo ""

# Load UCI functions
. /lib/functions.sh

# Function to safely get UCI value with default
get_uci_value() {
    local value
    config_get value quecwatch "$1" "$2"
    echo "${value:-$2}"
}

# Function to check if service is running
check_service_status() {
    if [ -f "/var/run/quecwatch.pid" ]; then
        if kill -0 "$(cat /var/run/quecwatch.pid)" 2>/dev/null; then
            echo "running"
            return
        fi
    fi
    echo "stopped"
}

# Function to get last log entry
get_last_log() {
    local LOG_FILE="/tmp/log/quecwatch/quecwatch.log"
    if [ -f "$LOG_FILE" ]; then
        tail -n 1 "$LOG_FILE"
    else
        echo "No log entries found"
    fi
}

# Load QuecManager configuration
config_load quecmanager

# Check if QuecWatch section exists
if ! uci -q get quecmanager.quecwatch >/dev/null; then
    echo '{"status": "inactive", "message": "QuecWatch is not configured"}'
    exit 0
fi

# Get enabled status
enabled=$(get_uci_value "enabled" "0")

if [ "$enabled" != "1" ]; then
    echo '{"status": "inactive", "message": "QuecWatch is disabled"}'
    exit 0
fi

# Check if monitoring script exists
if [ ! -f "/www/cgi-bin/services/quecwatch.sh" ]; then
    echo '{"status": "error", "message": "Monitoring script is missing"}'
    exit 0
fi

# Get service status
service_status=$(check_service_status)

# Get last log entry
last_log=$(get_last_log)

# Fetch all configuration values
ping_target=$(get_uci_value "ping_target" "")
ping_interval=$(get_uci_value "ping_interval" "30")
ping_failures=$(get_uci_value "ping_failures" "3")
max_retries=$(get_uci_value "max_retries" "5")
current_retries=$(get_uci_value "current_retries" "0")
connection_refresh=$(get_uci_value "connection_refresh" "false")
refresh_count=$(get_uci_value "refresh_count" "0")
auto_sim_failover=$(get_uci_value "auto_sim_failover" "false")
sim_failover_schedule=$(get_uci_value "sim_failover_schedule" "0")

# Prepare JSON response
cat <<EOF
{
    "status": "active",
    "serviceStatus": "${service_status}",
    "config": {
        "pingTarget": "${ping_target}",
        "pingInterval": ${ping_interval},
        "pingFailures": ${ping_failures},
        "maxRetries": ${max_retries},
        "currentRetries": ${current_retries},
        "connectionRefresh": ${connection_refresh},
        "refreshCount": ${refresh_count},
        "autoSimFailover": ${auto_sim_failover},
        "simFailoverSchedule": ${sim_failover_schedule}
    },
    "lastActivity": "${last_log}"
}
EOF