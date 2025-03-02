#!/bin/sh

# Read POST data
read -r QUERY_STRING

# Function to urldecode with error handling
urldecode() {
    local encoded="$1"
    [ -z "$encoded" ] && return 1
    printf '%b' "${encoded//+/ }"
}

# Function to validate numeric input
validate_numeric() {
    local value="$1"
    local min="$2"
    local max="$3"
    local name="$4"
    
    if ! echo "$value" | grep -q '^[0-9]\+$'; then
        echo '{"status": "error", "message": "'"$name must be a number"'"}'
        exit 1
    fi
    
    if [ "$value" -lt "$min" ] || [ "$value" -gt "$max" ]; then
        echo '{"status": "error", "message": "'"$name must be between $min and $max"'"}'
        exit 1
    fi
}

# Function to validate boolean input
validate_boolean() {
    local value="$1"
    local name="$2"
    
    if [ "$value" != "true" ] && [ "$value" != "false" ]; then
        echo '{"status": "error", "message": "'"$name must be true or false"'"}'
        exit 1
    fi
}

# Extract and validate POST data
extract_post_data() {
    # Required parameter
    ping_target=$(echo "$QUERY_STRING" | grep -o 'ping_target=[^&]*' | cut -d= -f2)
    ping_target=$(urldecode "$ping_target") || {
        echo '{"status": "error", "message": "Invalid ping target encoding"}'
        exit 1
    }
    
    # Optional parameters with defaults and validation
    ping_interval=$(echo "$QUERY_STRING" | grep -o 'ping_interval=[^&]*' | cut -d= -f2)
    ping_interval=$(urldecode "${ping_interval:-30}")
    validate_numeric "$ping_interval" 3 3600 "Ping interval"
    
    ping_failures=$(echo "$QUERY_STRING" | grep -o 'ping_failures=[^&]*' | cut -d= -f2)
    ping_failures=$(urldecode "${ping_failures:-3}")
    validate_numeric "$ping_failures" 1 10 "Ping failures"
    
    max_retries=$(echo "$QUERY_STRING" | grep -o 'max_retries=[^&]*' | cut -d= -f2)
    max_retries=$(urldecode "${max_retries:-5}")
    validate_numeric "$max_retries" 1 20 "Max retries"
    
    connection_refresh=$(echo "$QUERY_STRING" | grep -o 'connection_refresh=[^&]*' | cut -d= -f2)
    connection_refresh=$(urldecode "${connection_refresh:-false}")
    validate_boolean "$connection_refresh" "Connection refresh"
    
    auto_sim_failover=$(echo "$QUERY_STRING" | grep -o 'auto_sim_failover=[^&]*' | cut -d= -f2)
    auto_sim_failover=$(urldecode "${auto_sim_failover:-false}")
    validate_boolean "$auto_sim_failover" "Auto SIM failover"
    
    sim_failover_schedule=$(echo "$QUERY_STRING" | grep -o 'sim_failover_schedule=[^&]*' | cut -d= -f2)
    sim_failover_schedule=$(urldecode "${sim_failover_schedule:-0}")
    validate_numeric "$sim_failover_schedule" 0 1440 "SIM failover schedule"
}

# Initialize UCI configuration
initialize_uci_config() {
    # Create UCI config if it doesn't exist
    touch /etc/config/quecmanager
    
    # Create section if it doesn't exist
    if ! uci -q get quecmanager.quecwatch >/dev/null; then
        uci set quecmanager.quecwatch=service
    fi
    
    # Set UCI values
    uci set quecmanager.quecwatch.enabled='1'
    uci set quecmanager.quecwatch.ping_target="$ping_target"
    uci set quecmanager.quecwatch.ping_interval="$ping_interval"
    uci set quecmanager.quecwatch.ping_failures="$ping_failures"
    uci set quecmanager.quecwatch.max_retries="$max_retries"
    uci set quecmanager.quecwatch.current_retries='0'
    uci set quecmanager.quecwatch.connection_refresh="$connection_refresh"
    uci set quecmanager.quecwatch.refresh_count="${connection_refresh:+3}"
    uci set quecmanager.quecwatch.auto_sim_failover="$auto_sim_failover"
    uci set quecmanager.quecwatch.sim_failover_schedule="$sim_failover_schedule"
    
    # Commit changes
    uci commit quecmanager
}

# Generate monitoring script
generate_monitoring_script() {
    mkdir -p /www/cgi-bin/services
    
    cat > /www/cgi-bin/services/quecwatch.sh <<'EOL'
#!/bin/sh

# Load UCI configuration
. /lib/functions.sh

# Define file paths
QUEUE_FILE="/tmp/at_pipe.txt"
LOG_DIR="/tmp/log/quecwatch"
LOG_FILE="${LOG_DIR}/quecwatch.log"
mkdir -p "${LOG_DIR}"
[ ! -f "${QUEUE_FILE}" ] && touch "${QUEUE_FILE}"

# Enhanced logging function
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "${timestamp} - [${level}] ${message}" >> "$LOG_FILE"
    logger -t quecwatch "${level}: ${message}"
}

# Load configuration from UCI
config_load quecmanager

PING_TARGET=""
PING_INTERVAL=""
PING_FAILURES=""
MAX_RETRIES=""
CURRENT_RETRIES="0"
CONNECTION_REFRESH=""
REFRESH_COUNT=""
AUTO_SIM_FAILOVER=""
SIM_FAILOVER_SCHEDULE=""

config_get PING_TARGET quecwatch ping_target
config_get PING_INTERVAL quecwatch ping_interval
config_get PING_FAILURES quecwatch ping_failures
config_get MAX_RETRIES quecwatch max_retries
config_get CURRENT_RETRIES quecwatch current_retries
config_get CONNECTION_REFRESH quecwatch connection_refresh
config_get REFRESH_COUNT quecwatch refresh_count
config_get AUTO_SIM_FAILOVER quecwatch auto_sim_failover
config_get SIM_FAILOVER_SCHEDULE quecwatch sim_failover_schedule

# Function to check internet connectivity with logging
check_internet() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    log_message "DEBUG" "Attempting to ping ${PING_TARGET}"
    
    if ping -c 3 ${PING_TARGET} > /dev/null 2>&1; then
        log_message "INFO" "Ping successful to ${PING_TARGET}"
        return 0
    else
        log_message "WARN" "Ping failed to ${PING_TARGET}"
        return 1
    fi
}

# Function to handle AT command queue locking
handle_lock() {
    local max_wait=30
    local wait_count=0
    
    while [ -f "$QUEUE_FILE" ] && grep -q "AT_COMMAND" "$QUEUE_FILE" && [ $wait_count -lt $max_wait ]; do
        sleep 1
        wait_count=$((wait_count + 1))
    done
    
    printf '{"command":"AT_COMMAND","pid":"%s","timestamp":"%s"}\n' "$$" "$(date '+%H:%M:%S')" >> "$QUEUE_FILE"
}

# Function to execute AT commands with retries and logging
execute_at_command() {
    local command="$1"
    local result=""
    local retry_count=0
    local max_retries=3
    
    log_message "DEBUG" "Executing AT command: ${command}"
    
    while [ $retry_count -lt $max_retries ]; do
        handle_lock
        result=$(sms_tool at "$command" -t 4 2>&1)
        local status=$?
        sed -i "/\"pid\":\"$$\"/d" "$QUEUE_FILE"
        
        if [ $status -eq 0 ] && [ -n "$result" ]; then
            log_message "DEBUG" "AT command successful: ${command}"
            echo "$result"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        log_message "WARN" "AT command failed: ${command} (attempt ${retry_count}/${max_retries})"
        [ $retry_count -lt $max_retries ] && sleep 2
    done
    
    log_message "ERROR" "AT command failed after ${max_retries} attempts: ${command}"
    return 1
}

# Function to get current active SIM slot
get_current_sim() {
    local result
    local current_sim
    
    log_message "DEBUG" "Checking current SIM slot"
    
    result=$(execute_at_command "AT+QUIMSLOT?")
    if [ $? -eq 0 ]; then
        # Extract SIM slot number from response (e.g., +QUIMSLOT: 1)
        current_sim=$(echo "$result" | grep -o '[0-9]' | head -n 1)
        if [ -n "$current_sim" ]; then
            log_message "DEBUG" "Current SIM slot: ${current_sim}"
            echo "$current_sim"
            return 0
        fi
    fi
    
    log_message "ERROR" "Failed to get current SIM slot"
    return 1
}

# Function to check SIM card status
check_sim_status() {
    local sim_slot="$1"
    local result
    
    log_message "DEBUG" "Checking SIM ${sim_slot} status"
    
    # Switch to the specified SIM slot
    if ! execute_at_command "AT+QUIMSLOT=${sim_slot}"; then
        log_message "ERROR" "Failed to switch to SIM ${sim_slot}"
        return 1
    fi
    
    sleep 2
    
    # Check SIM card status
    result=$(execute_at_command "AT+CPIN?")
    if [ $? -eq 0 ] && echo "$result" | grep -q "READY"; then
        log_message "INFO" "SIM ${sim_slot} is ready"
        return 0
    fi
    
    log_message "ERROR" "SIM ${sim_slot} is not ready"
    return 1
}

# Function to switch SIM cards
switch_sim_card() {
    local current_sim
    local target_sim
    local retry_count=0
    local max_retries=3
    
    log_message "INFO" "Initiating SIM card switch"
    
    current_sim=$(get_current_sim)
    if [ $? -ne 0 ]; then
        log_message "ERROR" "Failed to get current SIM slot"
        return 1
    fi
    
    # Determine target SIM (toggle between 1 and 2)
    if [ "$current_sim" = "1" ]; then
        target_sim=2
    else
        target_sim=1
    fi
    
    log_message "INFO" "Attempting to switch from SIM ${current_sim} to SIM ${target_sim}"
    
    # Check if target SIM is viable
    if ! check_sim_status "$target_sim"; then
        log_message "ERROR" "Target SIM ${target_sim} is not viable"
        return 1
    fi
    
    while [ $retry_count -lt $max_retries ]; do
        # Detach from network before switching
        if ! execute_at_command "AT+COPS=2"; then
            log_message "ERROR" "Failed to detach from network"
            retry_count=$((retry_count + 1))
            continue
        fi
        
        sleep 2
        
        # Switch SIM slot
        if ! execute_at_command "AT+QUIMSLOT=${target_sim}"; then
            log_message "ERROR" "Failed to switch to SIM ${target_sim}"
            retry_count=$((retry_count + 1))
            continue
        fi
        
        sleep 5
        
        # Reattach to network
        if ! execute_at_command "AT+COPS=0"; then
            log_message "ERROR" "Failed to reattach to network"
            retry_count=$((retry_count + 1))
            continue
        fi
        
        sleep 10
        
        # Verify SIM switch
        if [ "$(get_current_sim)" = "$target_sim" ]; then
            log_message "INFO" "Successfully switched to SIM ${target_sim}"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        [ $retry_count -lt $max_retries ] && sleep 2
    done
    
    log_message "ERROR" "Failed to switch SIM card after ${max_retries} attempts"
    return 1
}

# Function to perform connection recovery with detailed logging
perform_connection_recovery() {
    local recovery_attempted=0
    local recovery_successful=0

    if [ "${CONNECTION_REFRESH}" = "true" ] && [ "${CURRENT_RETRIES}" -eq 1 ] && [ "${REFRESH_COUNT}" -gt 0 ]; then
        log_message "INFO" "Starting connection refresh attempt (Remaining attempts: ${REFRESH_COUNT})"
        
        log_message "DEBUG" "Detaching from network..."
        if ! execute_at_command "AT+COPS=2"; then
            log_message "ERROR" "Failed to detach from network"
            return 1
        fi
        
        sleep 2
        log_message "DEBUG" "Reattaching to network..."
        
        if ! execute_at_command "AT+COPS=0"; then
            log_message "ERROR" "Failed to reattach to network"
            return 1
        fi
        
        sleep 5
        log_message "DEBUG" "Checking connection after refresh..."
        
        if check_internet; then
            log_message "INFO" "Connection refresh successful"
            recovery_successful=1
            return 0
        fi
        
        REFRESH_COUNT=$((REFRESH_COUNT - 1))
        log_message "INFO" "Connection refresh failed. Remaining attempts: ${REFRESH_COUNT}"
        uci set quecmanager.quecwatch.refresh_count="${REFRESH_COUNT}"
        uci commit quecmanager
        recovery_attempted=1
    fi

    [ ${recovery_successful} -eq 1 ] && return 0 || return 1
}

# Store initial SIM slot with logging
initial_sim_slot=""
if [ "${AUTO_SIM_FAILOVER}" = "true" ]; then
    initial_sim_slot=$(get_current_sim)
    if [ $? -eq 0 ]; then
        log_message "INFO" "Auto SIM failover enabled. Initial SIM slot: ${initial_sim_slot}"
    else
        log_message "ERROR" "Failed to get initial SIM slot"
    fi
fi

# Main monitoring loop with enhanced logging
failure_count=0
sim_failover_interval=0

while true; do
    # Log the start of each monitoring cycle
    log_message "DEBUG" "Starting monitoring cycle"
    log_message "DEBUG" "Current status - Failures: ${failure_count}, Retries: ${CURRENT_RETRIES}"
    
    if ! check_internet; then
        failure_count=$((failure_count + 1))
        log_message "WARN" "Ping failed. Consecutive failures: ${failure_count}/${PING_FAILURES}"

        if [ ${failure_count} -ge ${PING_FAILURES} ]; then
            failure_count=0
            CURRENT_RETRIES=$((CURRENT_RETRIES + 1))
            log_message "INFO" "Failure threshold reached. Current retry attempt: ${CURRENT_RETRIES}/${MAX_RETRIES}"
            
            # Update UCI with new retry count
            uci set quecmanager.quecwatch.current_retries="${CURRENT_RETRIES}"
            uci commit quecmanager
            
            if [ ${CURRENT_RETRIES} -ge ${MAX_RETRIES} ]; then
                if [ "${AUTO_SIM_FAILOVER}" = "true" ]; then
                    log_message "INFO" "Max retries exhausted. Attempting SIM failover"
                    if switch_sim_card && check_internet; then
                        log_message "INFO" "SIM failover successful"
                        CURRENT_RETRIES=0
                        failure_count=0
                        uci set quecmanager.quecwatch.current_retries="0"
                        uci commit quecmanager
                    else
                        log_message "ERROR" "SIM failover failed. Initiating reboot"
                        CURRENT_RETRIES=$((CURRENT_RETRIES + 1))
                        uci set quecmanager.quecwatch.current_retries="${CURRENT_RETRIES}"
                        uci commit quecmanager
                        log_message "INFO" "System will reboot in 5 seconds"
                        sleep 5
                        reboot
                    fi
                else
                    log_message "INFO" "Max retries exhausted. Auto SIM failover disabled"
                    log_message "INFO" "Disabling QuecWatch and initiating reboot"
                    uci set quecmanager.quecwatch.enabled="0"
                    uci commit quecmanager
                    sleep 5
                    reboot
                fi
            else
                if perform_connection_recovery; then
                    CURRENT_RETRIES=0
                    failure_count=0
                    uci set quecmanager.quecwatch.current_retries="0"
                    uci commit quecmanager
                    log_message "INFO" "Connection recovery successful"
                else
                    log_message "ERROR" "Connection recovery failed. Initiating reboot"
                    CURRENT_RETRIES=$((CURRENT_RETRIES + 1))
                    uci set quecmanager.quecwatch.current_retries="${CURRENT_RETRIES}"
                    uci commit quecmanager
                    sleep 5
                    reboot
                fi
            fi
        fi
    else
        if [ ${failure_count} -gt 0 ] || [ ${CURRENT_RETRIES} -gt 0 ]; then
            log_message "INFO" "Connection restored. Resetting counters"
        fi
        failure_count=0
        CURRENT_RETRIES=0
        uci set quecmanager.quecwatch.current_retries="0"
        uci commit quecmanager
        
        # Only log successful connection periodically to avoid log spam
        if [ $((SECONDS % 300)) -eq 0 ]; then
            log_message "INFO" "Connection stable - Regular status check"
        fi
        
        if [ "${AUTO_SIM_FAILOVER}" = "true" ] && [ "${SIM_FAILOVER_SCHEDULE}" -gt 0 ]; then
            current_sim_slot=$(get_current_sim)
            
            if [ -n "${initial_sim_slot}" ] && [ "${current_sim_slot}" != "${initial_sim_slot}" ]; then
                sim_failover_interval=$((sim_failover_interval + 1))
                
                if [ $((sim_failover_interval * PING_INTERVAL)) -ge $((SIM_FAILOVER_SCHEDULE * 60)) ]; then
                    log_message "INFO" "Scheduled check: Attempting to switch back to initial SIM ${initial_sim_slot}"
                    
                    if execute_at_command "AT+QUIMSLOT=${initial_sim_slot}"; then
                        sleep 10
                        
                        if check_internet; then
                            log_message "INFO" "Successfully restored initial SIM"
                            CURRENT_RETRIES=0
                            uci set quecmanager.quecwatch.current_retries="0"
                            uci commit quecmanager
                        else
                            log_message "WARN" "Initial SIM not working. Reverting to backup SIM"
                            execute_at_command "AT+QUIMSLOT=${current_sim_slot}"
                            sleep 10
                        fi
                    else
                        log_message "ERROR" "Failed to switch to initial SIM"
                    fi
                    
                    sim_failover_interval=0
                fi
            fi
        fi
    fi

    sleep ${PING_INTERVAL}
done
EOL

    chmod 755 /www/cgi-bin/services/quecwatch.sh
}

# Generate init.d script
generate_init_script() {
    cat > /etc/init.d/quecwatch <<'EOL'
#!/bin/sh /etc/rc.common

START=99
STOP=10
USE_PROCD=1

start_service() {
    local enabled
    
    # Check if service is enabled in UCI
    config_load quecmanager
    config_get enabled quecwatch enabled '0'
    
    [ "$enabled" != "1" ] && return 0
    
    procd_open_instance
    procd_set_param command /www/cgi-bin/services/quecwatch.sh
    procd_set_param respawn ${respawn_threshold:-3600} ${respawn_timeout:-5} ${respawn_retry:-5}
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_set_param nice 19
    procd_close_instance
}

service_triggers() {
    procd_add_reload_trigger "quecmanager"
}

reload_service() {
    stop
    start
}
EOL

    chmod 755 /etc/init.d/quecwatch
}

# Main execution
echo "Content-type: application/json"
echo ""

# Extract and validate POST data
extract_post_data

# Validate required input
if [ -z "$ping_target" ]; then
    echo '{"status": "error", "message": "Ping target is required"}'
    exit 1
fi

# Initialize UCI config
if ! initialize_uci_config; then
    echo '{"status": "error", "message": "Failed to initialize UCI configuration"}'
    exit 1
fi

# Generate monitoring script
if ! generate_monitoring_script; then
    echo '{"status": "error", "message": "Failed to generate monitoring script"}'
    exit 1
fi

# Generate and enable init.d script
if ! generate_init_script; then
    echo '{"status": "error", "message": "Failed to generate init.d script"}'
    exit 1
fi

# Enable and start the service
if ! /etc/init.d/quecwatch enable; then
    echo '{"status": "error", "message": "Failed to enable service"}'
    exit 1
fi

if ! /etc/init.d/quecwatch start; then
    echo '{"status": "error", "message": "Failed to start service"}'
    exit 1
fi

# Return success response
echo '{"status": "success", "message": "QuecWatch enabled successfully"}'