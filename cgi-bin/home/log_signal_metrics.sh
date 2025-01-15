#!/bin/sh

# Configuration
LOGDIR="/www/signal_graphs"
MAX_ENTRIES=10
INTERVAL=20
QUEUE_FILE="/tmp/at_pipe.txt"
LOCK_KEYWORD="FETCH_DATA_LOCK"
PAUSE_FILE="/tmp/signal_logging.pause"
MAX_LOCK_WAIT=30
LOCK_CHECK_INTERVAL=0.5

# Ensure the directory exists
mkdir -p "$LOGDIR"

# Function to check if a process is still running
is_process_running() {
    local PID=$1
    [ -d "/proc/$PID" ] && return 0 || return 1
}

# Function to get lock owner PID
get_lock_owner() {
    grep -o "${LOCK_KEYWORD}.*" "$QUEUE_FILE" | cut -d'"' -f6 2>/dev/null
}

# Function to check stale locks
check_stale_lock() {
    local LOCK_PID=$(get_lock_owner)
    if [ -n "$LOCK_PID" ] && ! is_process_running "$LOCK_PID"; then
        logger -t signal_metrics "Removing stale lock from PID $LOCK_PID"
        remove_lock
        return 0
    fi
    return 1
}

# Function to add lock entry
add_lock() {
    local RETRIES=0
    local MAX_RETRIES=60
    
    while [ $RETRIES -lt $MAX_RETRIES ]; do
        if ! grep -q "$LOCK_KEYWORD" "$QUEUE_FILE"; then
            printf '{"id":"%s","timestamp":"%s","command":"%s","status":"lock","pid":"%s"}\n' \
                "${LOCK_KEYWORD}" \
                "$(date '+%H:%M:%S')" \
                "${LOCK_KEYWORD}" \
                "$$" >> "$QUEUE_FILE"
            
            if grep -q "\"pid\":\"$$\"" "$QUEUE_FILE"; then
                return 0
            fi
        else
            check_stale_lock && continue
        fi
        
        RETRIES=$((RETRIES + 1))
        sleep $LOCK_CHECK_INTERVAL
    done
    
    logger -t signal_metrics "Failed to acquire lock after $MAX_LOCK_WAIT seconds"
    return 1
}

# Function to remove lock entry
remove_lock() {
    sed -i "/${LOCK_KEYWORD}.*\"pid\":\"$$\"/d" "$QUEUE_FILE"
}

# Enhanced clean_output function to properly handle multiline responses
clean_output() {
    local output=""
    # Skip first line (echo of command)
    read -r line
    
    # Read and concatenate remaining lines until "OK" or empty line
    while read -r line; do
        case "$line" in
            "OK"|"")
                continue
                ;;
            *)
                if [ -n "$output" ]; then
                    output="$output\\n$line"
                else
                    output="$line"
                fi
                ;;
        esac
    done
    
    echo "$output"
}

# Function to execute AT command with proper output handling
execute_at_command() {
    local COMMAND="$1"
    local RETRY_COUNT=0
    local MAX_RETRIES=3
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if add_lock; then
            local OUTPUT=$(sms_tool at "$COMMAND" -t 4 2>/dev/null | clean_output)
            local STATUS=$?
            remove_lock
            
            if [ $STATUS -eq 0 ] && [ -n "$OUTPUT" ]; then
                echo "$OUTPUT"
                return 0
            fi
            
            logger -t signal_metrics "AT command failed (attempt $((RETRY_COUNT + 1))): $COMMAND"
            RETRY_COUNT=$((RETRY_COUNT + 1))
            [ $RETRY_COUNT -lt $MAX_RETRIES ] && sleep 1
        else
            logger -t signal_metrics "Failed to acquire lock for command: $COMMAND"
            return 1
        fi
    done
    
    logger -t signal_metrics "AT command failed after $MAX_RETRIES attempts: $COMMAND"
    return 1
}

# Function to log signal metric
log_signal_metric() {
    [ -f "$PAUSE_FILE" ] && return
    
    local COMMAND="$1"
    local FILENAME="$2"
    local LOGFILE="$LOGDIR/$FILENAME"
    
    if ! mkdir -p "$(dirname "$LOGFILE")" 2>/dev/null; then
        logger -t signal_metrics "Failed to create log directory: $LOGDIR"
        return 1
    fi
    
    local TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    local SIGNAL_OUTPUT=$(execute_at_command "$COMMAND")
    
    if [ -z "$SIGNAL_OUTPUT" ]; then
        logger -t signal_metrics "No output received for command: $COMMAND"
        return 1
    fi
    
    [ ! -s "$LOGFILE" ] && echo "[]" > "$LOGFILE"
    
    local TEMP_FILE="${LOGFILE}.tmp.$$"
    if ! jq --arg dt "$TIMESTAMP" \
            --arg out "$SIGNAL_OUTPUT" \
            '. + [{"datetime": $dt, "output": $out}] | .[-'"$MAX_ENTRIES"':]' \
            "$LOGFILE" > "$TEMP_FILE"; then
        logger -t signal_metrics "Failed to update JSON file: $LOGFILE"
        rm -f "$TEMP_FILE"
        return 1
    fi
    
    if ! mv "$TEMP_FILE" "$LOGFILE"; then
        logger -t signal_metrics "Failed to save JSON file: $LOGFILE"
        rm -f "$TEMP_FILE"
        return 1
    fi
    
    return 0
}

# Function to log data usage
log_data_usage() {
    [ -f "$PAUSE_FILE" ] && return
    log_signal_metric "AT+QGDCNT?;+QGDNRCNT?" "data_usage.json"
}

# Main continuous logging function
start_continuous_logging() {
    local FAIL_COUNT=0
    local MAX_FAILS=5
    
    logger -t signal_metrics "Starting continuous signal metrics logging (PID: $$)"
    
    trap 'logger -t signal_metrics "Stopping signal metrics logging"; remove_lock; exit 0' INT TERM
    
    while true; do
        if [ ! -f "$PAUSE_FILE" ]; then
            local SUCCESS=true
            
            log_signal_metric "AT+QRSRP" "rsrp.json" || SUCCESS=false
            log_signal_metric "AT+QRSRQ" "rsrq.json" || SUCCESS=false
            log_signal_metric "AT+QSINR" "sinr.json" || SUCCESS=false
            log_data_usage || SUCCESS=false
            
            if ! $SUCCESS; then
                FAIL_COUNT=$((FAIL_COUNT + 1))
                logger -t signal_metrics "Logging cycle failed ($FAIL_COUNT/$MAX_FAILS)"
                
                if [ $FAIL_COUNT -ge $MAX_FAILS ]; then
                    logger -t signal_metrics "Too many consecutive failures, stopping logger"
                    exit 1
                fi
            else
                FAIL_COUNT=0
            fi
        fi
        
        sleep "$INTERVAL"
    done
}

# Start the continuous logging
start_continuous_logging