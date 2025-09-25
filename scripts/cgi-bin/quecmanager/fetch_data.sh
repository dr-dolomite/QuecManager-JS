#!/bin/sh
# OpenWrt-Compatible Improved fetch_data.sh
# Optimized for OpenWrt/BusyBox environment with enhanced performance

# Set content-type for JSON response
printf "Content-type: application/json\r\n"
printf "\r\n"

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

# Configuration
QUEUE_DIR="/tmp/at_queue"
QUEUE_MANAGER="/www/cgi-bin/services/at_queue_manager.sh"
SCRIPT_NAME_LOG="fetch_data"

# Performance settings - OpenWrt optimized
BATCH_TIMEOUT=45          # Timeout for batch operations
INDIVIDUAL_TIMEOUT=15     # Timeout for individual commands
TOKEN_RETRY_LIMIT=8       # Reduced retries for faster failure
TOKEN_RETRY_DELAY=0.1     # Faster retry intervals

# Minimal logging for performance
log_fetch() {
    local level="$1"
    local message="$2"
    
    # Only log errors to centralized system for performance
    case "$level" in
        "error")
            qm_log_error "service" "$SCRIPT_NAME_LOG" "$message"
            ;;
        "debug")
            [ "${DEBUG_MODE:-0}" = "1" ] && logger -t fetch_data -p "daemon.debug" "$message"
            ;;
    esac
}

# Ensure queue directory exists
mkdir -p "$QUEUE_DIR"

# OpenWrt-compatible JSON escaping using shell builtins
escape_json() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\x1b/\\u001b/g' | tr -d '\r\n\f\b'
}

# OpenWrt-compatible URL encoding
urlencode_simple() {
    local string="$1"
    # Encode most common special characters for BusyBox compatibility
    string="${string// /%20}"
    string="${string//+/%2B}"
    string="${string//\"/%22}"
    string="${string//=/%3D}"
    string="${string//&/%26}"
    string="${string//#/%23}"
    string="${string//?/%3F}"
    string="${string//;/%3B}"
    string="${string//,/%2C}"
    echo "$string"
}

# Fast AT command execution with OpenWrt timeout handling
execute_at_command() {
    local cmd="$1"
    local timeout="${2:-$INDIVIDUAL_TIMEOUT}"
    
    local output=""
    local status=1
    
    # OpenWrt-compatible timeout implementation
    if command -v timeout >/dev/null 2>&1; then
        # Use timeout command if available
        output=$(timeout "$timeout" sms_tool at "$cmd" 2>&1)
        status=$?
    else
        # BusyBox-compatible timeout implementation
        (
            sms_tool at "$cmd" 2>&1 &
            local cmd_pid=$!
            
            # Background timeout
            (sleep "$timeout" && kill -TERM $cmd_pid 2>/dev/null) &
            local timeout_pid=$!
            
            wait $cmd_pid
            local cmd_status=$?
            kill $timeout_pid 2>/dev/null
            exit $cmd_status
        )
        status=$?
        output=$(cat)
    fi
    
    if [ $status -eq 0 ] && [ -n "$output" ]; then
        echo "$output"
        return 0
    fi
    
    return 1
}

# Intelligent command grouping for batch processing
group_commands() {
    local commands="$1"
    
    # Separate quick vs slow commands for optimized processing
    local quick_commands=""
    local slow_commands=""
    
    for cmd in $commands; do
        case "$cmd" in
            *"?"*|*"CREG"*|*"CGREG"*|*"CEREG"*|*"CPIN"*|*"CFUN"*)
                quick_commands="$quick_commands $cmd"
                ;;
            *)
                slow_commands="$slow_commands $cmd"
                ;;
        esac
    done
    
    # Process quick commands first with shorter timeout
    if [ -n "$quick_commands" ]; then
        process_command_batch "$quick_commands" 10
    fi
    
    # Then process slower commands
    if [ -n "$slow_commands" ]; then
        process_command_batch "$slow_commands" $INDIVIDUAL_TIMEOUT
    fi
}

# Process a batch of commands using the queue manager
process_command_batch() {
    local commands="$1"
    local timeout="${2:-$INDIVIDUAL_TIMEOUT}"
    local first=1
    
    for cmd in $commands; do
        [ $first -eq 0 ] && printf ','
        first=0
        
        # Use queue manager for better performance and queuing
        local escaped_cmd=$(urlencode_simple "$cmd")
        local priority=5  # Medium priority for batch operations
        
        # Submit to queue manager
        local response=$(REQUEST_METHOD="GET" QUERY_STRING="command=$escaped_cmd&priority=$priority&timeout=$timeout" "$QUEUE_MANAGER" 2>/dev/null)
        
        # Extract command ID
        local cmd_id=""
        if [ -n "$response" ]; then
            cmd_id=$(echo "$response" | grep -o '"command_id":"[^"]*"' | cut -d'"' -f4)
            [ -z "$cmd_id" ] && cmd_id=$(echo "$response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
        fi
        
        local escaped_cmd_display=$(escape_json "$cmd")
        
        if [ -n "$cmd_id" ]; then
            # Wait for result with polling
            local result_file="/tmp/at_queue/results/$cmd_id"
            local wait_time=0
            local max_wait=$timeout
            
            while [ $wait_time -lt $max_wait ]; do
                if [ -f "$result_file" ]; then
                    local result_content=$(cat "$result_file" 2>/dev/null)
                    if [ -n "$result_content" ]; then
                        # Extract response from result
                        local cmd_response=$(echo "$result_content" | grep -o '"response":"[^"]*"' | cut -d'"' -f4)
                        local cmd_status=$(echo "$result_content" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
                        
                        if [ "$cmd_status" = "success" ] && [ -n "$cmd_response" ]; then
                            printf '{"command":"%s","response":"%s","status":"success"}' \
                                "$escaped_cmd_display" "$(escape_json "$cmd_response")"
                        else
                            printf '{"command":"%s","response":"Command failed","status":"error"}' \
                                "$escaped_cmd_display"
                        fi
                        
                        # Cleanup result file
                        rm -f "$result_file" 2>/dev/null
                        break
                    fi
                fi
                
                sleep 0.2
                wait_time=$((wait_time + 1))
            done
            
            # If we didn't get a result, report timeout
            if [ $wait_time -ge $max_wait ]; then
                printf '{"command":"%s","response":"Command timed out","status":"timeout"}' \
                    "$escaped_cmd_display"
                rm -f "$result_file" 2>/dev/null
            fi
        else
            # Direct execution fallback if queue manager fails
            local output=$(execute_at_command "$cmd" "$timeout")
            local cmd_status=$?
            
            if [ $cmd_status -eq 0 ] && [ -n "$output" ]; then
                printf '{"command":"%s","response":"%s","status":"success"}' \
                    "$escaped_cmd_display" "$(escape_json "$output")"
            else
                printf '{"command":"%s","response":"Direct execution failed","status":"error"}' \
                    "$escaped_cmd_display"
            fi
        fi
    done
}

# Enhanced batch processing with optimizations
process_all_commands() {
    local commands="$1"
    local priority="${2:-5}"
    
    printf '['
    group_commands "$commands"
    printf ']\r\n'
    
    return 0
}

# Cleanup on exit
cleanup() {
    exit 0
}

# Set up signal handlers
trap cleanup INT TERM

# Enhanced command sets with better organization
COMMAND_SET_1='AT+QUIMSLOT? AT+CNUM AT+COPS? AT+CIMI AT+ICCID AT+CGSN AT+CPIN? AT+CGDCONT? AT+CREG? AT+CFUN? AT+QENG="servingcell" AT+QTEMP AT+CGCONTRDP'
COMMAND_SET_2='AT+QCAINFO=1;+QCAINFO;+QCAINFO=0 AT+QRSRP AT+QMAP="WWAN" AT+C5GREG=2;+C5GREG? AT+CGREG=2;+CGREG? AT+QRSRQ AT+QSINR'
COMMAND_SET_3='AT+CGMI AT+CGMM AT+QGMR AT+CNUM AT+CIMI AT+ICCID AT+CGSN AT+QMAP="LANIP" AT+QMAP="WWAN" AT+QGETCAPABILITY'
COMMAND_SET_4='AT+QMAP="MPDN_RULE" AT+QMAP="DHCPV4DNS" AT+QCFG="usbnet" AT+QNWCFG="3gpp_rel"'
COMMAND_SET_5='AT+QRSRP AT+QRSRQ AT+QSINR AT+QCAINFO AT+QSPN'
COMMAND_SET_6='AT+CEREG=2;+CEREG? AT+C5GREG=2;+C5GREG? AT+CPIN? AT+CGDCONT? AT+CGCONTRDP AT+QMAP="WWAN" AT+QRSRP AT+QTEMP'
COMMAND_SET_7='AT+QNWPREFCFG="policy_band" AT+QNWPREFCFG="lte_band";+QNWPREFCFG="nsa_nr5g_band";+QNWPREFCFG="nr5g_band"'
COMMAND_SET_8='AT+QNWLOCK="common/4g" AT+QNWLOCK="common/5g" AT+QNWLOCK="save_ctrl"'
COMMAND_SET_9='AT+QNWCFG="lte_time_advance",1;+QNWCFG="lte_time_advance" AT+QNWCFG="nr5g_time_advance",1;+QNWCFG="nr5g_time_advance"'
COMMAND_SET_10='AT+QNWPREFCFG="mode_pref" AT+QNWPREFCFG="nr5g_disable_mode" AT+QMBNCFG="AutoSel" AT+QMBNCFG="list"'

# Parse command set with validation - OpenWrt compatible
COMMAND_SET=$(echo "$QUERY_STRING" | grep -o 'set=[0-9]\+' | cut -d'=' -f2 | tr -cd '0-9')
if [ -z "$COMMAND_SET" ] || [ "$COMMAND_SET" -lt 1 ] || [ "$COMMAND_SET" -gt 10 ]; then
    COMMAND_SET=1
fi

# Select appropriate command set
case "$COMMAND_SET" in
    1) COMMANDS="$COMMAND_SET_1" ;;
    2) COMMANDS="$COMMAND_SET_2" ;;
    3) COMMANDS="$COMMAND_SET_3" ;;
    4) COMMANDS="$COMMAND_SET_4" ;;
    5) COMMANDS="$COMMAND_SET_5" ;;
    6) COMMANDS="$COMMAND_SET_6" ;;
    7) COMMANDS="$COMMAND_SET_7" ;;
    8) COMMANDS="$COMMAND_SET_8" ;;
    9) COMMANDS="$COMMAND_SET_9" ;;
    10) COMMANDS="$COMMAND_SET_10" ;;
esac

# Set priority based on command type
PRIORITY=5  # Medium-high priority for data fetching

# Check for high priority commands
if echo "$COMMANDS" | grep -qi "QSCAN"; then
    PRIORITY=1
elif echo "$COMMANDS" | grep -qi "COPS\|CFUN"; then
    PRIORITY=3
fi

# Execute batch processing with timeout protection
(
    # Set overall timeout for the entire script using OpenWrt-compatible method
    if command -v timeout >/dev/null 2>&1; then
        timeout $BATCH_TIMEOUT sh -c '
            process_all_commands "$1" "$2"
        ' _ "$COMMANDS" "$PRIORITY"
    else
        # BusyBox timeout fallback
        (
            process_all_commands "$COMMANDS" "$PRIORITY" &
            local main_pid=$!
            
            (sleep $BATCH_TIMEOUT && kill -TERM $main_pid 2>/dev/null) &
            local timeout_pid=$!
            
            wait $main_pid
            local exit_status=$?
            kill $timeout_pid 2>/dev/null
            
            if [ $exit_status -eq 143 ] || [ $exit_status -eq 124 ]; then
                printf '[{"command":"batch","response":"Script execution timed out","status":"timeout"}]\r\n'
            fi
        )
    fi
) || {
    # Handle script timeout
    printf '[{"command":"batch","response":"Script execution timed out","status":"timeout"}]\r\n'
}
