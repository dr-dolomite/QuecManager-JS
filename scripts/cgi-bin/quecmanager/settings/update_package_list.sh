#!/bin/sh

# QuecManager Package Update Script (Optimized with Locking)
# Updates the package list from repositories with smart caching

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

# Configuration
CACHE_FILE="/tmp/opkg_last_update"
LOCK_FILE="/var/lock/opkg_update.lock"
CACHE_MAX_AGE=300  # 5 minutes in seconds (adjust as needed)
UPDATE_TIMEOUT=90
LOCK_TIMEOUT=95    # Slightly longer than UPDATE_TIMEOUT

SCRIPT_NAME="update_package_list"

# Helper function for JSON response
send_json_response() {
    local status="$1"
    local message="$2"
    local exit_code="$3"
    local output="$4"
    local cached="$5"
    local age="$6"
    
    # Escape output for JSON (more efficient)
    local output_escaped=""
    if [ -n "$output" ]; then
        output_escaped=$(printf '%s' "$output" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n' | sed 's/\\n$//')
    fi
    
    cat <<EOF
{
    "status": "$status",
    "message": "$message",
    "timestamp": "$(date -Iseconds)",
    "cached": $cached,
    "cache_age_seconds": $age,
    "exit_code": $exit_code$([ -n "$output_escaped" ] && echo ',
    "output": "'"$output_escaped"'"')
}
EOF
}

# Cleanup function to remove lock on exit
cleanup_lock() {
    if [ -f "$LOCK_FILE" ]; then
        rm -f "$LOCK_FILE"
        qm_log_debug "settings" "$SCRIPT_NAME" "Lock file removed"
    fi
}

# Set content type for JSON response
echo "Content-type: application/json"
echo ""

qm_log_info "settings" "$SCRIPT_NAME" "Update package list script started"

# Parse query string for force parameter
FORCE_UPDATE=0
if [ -n "$QUERY_STRING" ]; then
    case "$QUERY_STRING" in
        *force=1*|*force=true*) 
            FORCE_UPDATE=1
            qm_log_debug "settings" "$SCRIPT_NAME" "Force update requested via query string"
            ;;
    esac
fi

# Check if cache exists and is fresh
CURRENT_TIME=$(date +%s)
CACHE_AGE=0
SKIP_UPDATE=0

if [ -f "$CACHE_FILE" ] && [ $FORCE_UPDATE -eq 0 ]; then
    LAST_UPDATE=$(cat "$CACHE_FILE" 2>/dev/null || echo 0)
    
    # Validate that LAST_UPDATE is a number
    if [ "$LAST_UPDATE" -eq "$LAST_UPDATE" ] 2>/dev/null; then
        CACHE_AGE=$((CURRENT_TIME - LAST_UPDATE))
        
        if [ "$CACHE_AGE" -lt "$CACHE_MAX_AGE" ]; then
            SKIP_UPDATE=1
            CACHE_TIME=$(date -d "@$LAST_UPDATE" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date)
            qm_log_info "settings" "$SCRIPT_NAME" "Using cached package list (age: ${CACHE_AGE}s, max: ${CACHE_MAX_AGE}s)"
            send_json_response "success" "Package list is up to date (cached)" 0 "Using cached data from $CACHE_TIME" true "$CACHE_AGE"
            qm_log_info "settings" "$SCRIPT_NAME" "Update package list script completed (cached)"
            exit 0
        else
            qm_log_debug "settings" "$SCRIPT_NAME" "Cache expired (age: ${CACHE_AGE}s, max: ${CACHE_MAX_AGE}s)"
        fi
    else
        qm_log_debug "settings" "$SCRIPT_NAME" "Invalid cache timestamp, updating"
    fi
fi

# Try to acquire lock with timeout
LOCK_ACQUIRED=0
LOCK_WAIT_START=$(date +%s)

while [ $LOCK_ACQUIRED -eq 0 ]; do
    # Try to create lock file atomically
    if mkdir "$LOCK_FILE" 2>/dev/null; then
        LOCK_ACQUIRED=1
        qm_log_debug "settings" "$SCRIPT_NAME" "Lock acquired"
        # Set trap to clean up lock on exit
        trap cleanup_lock EXIT INT TERM
    else
        # Check if lock is stale (older than LOCK_TIMEOUT)
        if [ -d "$LOCK_FILE" ]; then
            LOCK_AGE=$((CURRENT_TIME - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo $CURRENT_TIME)))
            
            if [ "$LOCK_AGE" -gt "$LOCK_TIMEOUT" ]; then
                qm_log_debug "settings" "$SCRIPT_NAME" "Removing stale lock (age: ${LOCK_AGE}s)"
                rm -rf "$LOCK_FILE"
                continue
            fi
        fi
        
        # Check if we've been waiting too long
        LOCK_WAIT_TIME=$(($(date +%s) - LOCK_WAIT_START))
        if [ "$LOCK_WAIT_TIME" -gt 10 ]; then
            qm_log_error "settings" "$SCRIPT_NAME" "Failed to acquire lock after ${LOCK_WAIT_TIME}s - another update is in progress"
            send_json_response "error" "Another update is currently in progress. Please try again in a moment." 1 "Lock timeout - another process is updating" false 0
            exit 1
        fi
        
        qm_log_debug "settings" "$SCRIPT_NAME" "Waiting for lock (${LOCK_WAIT_TIME}s)..."
        sleep 1
    fi
done

# Run opkg update
qm_log_debug "settings" "$SCRIPT_NAME" "Running: timeout $UPDATE_TIMEOUT opkg update"

UPDATE_OUTPUT=$(timeout $UPDATE_TIMEOUT opkg update 2>&1)
UPDATE_EXIT_CODE=$?

qm_log_debug "settings" "$SCRIPT_NAME" "Update exit code: $UPDATE_EXIT_CODE"

# Handle results
case $UPDATE_EXIT_CODE in
    124)
        # Timeout occurred
        qm_log_error "settings" "$SCRIPT_NAME" "Package list update timed out after ${UPDATE_TIMEOUT} seconds"
        send_json_response "error" "Package list update timed out after ${UPDATE_TIMEOUT} seconds. Check your network connection and repository accessibility." 124 "Operation timed out" false 0
        ;;
    0)
        # Update successful - save timestamp
        echo "$CURRENT_TIME" > "$CACHE_FILE"
        qm_log_info "settings" "$SCRIPT_NAME" "Package list updated successfully"
        send_json_response "success" "Package list updated successfully" 0 "$UPDATE_OUTPUT" false 0
        ;;
    *)
        # Update failed
        qm_log_error "settings" "$SCRIPT_NAME" "Failed to update package list (exit code: $UPDATE_EXIT_CODE): $UPDATE_OUTPUT"
        send_json_response "error" "Failed to update package list" "$UPDATE_EXIT_CODE" "$UPDATE_OUTPUT" false 0
        ;;
esac

qm_log_info "settings" "$SCRIPT_NAME" "Update package list script completed"

# Lock cleanup happens automatically via trap
exit 0