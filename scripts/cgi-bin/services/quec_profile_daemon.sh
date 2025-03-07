#!/bin/sh
# Location: /www/cgi-bin/services/quec_profile_daemon.sh
# Debug version with early error detection

# Create a direct log file immediately
DIRECT_LOG="/tmp/quecprofiles_direct.log"
echo "==== Script started at $(date) ====" > "$DIRECT_LOG"
chmod 666 "$DIRECT_LOG"

# Log startup directly to file and to syslog
echo "Script started with arguments: $@" >> "$DIRECT_LOG"
logger -t quecprofiles -p daemon.info "Script started with arguments: $@"

# Enable shell debugging to trace execution
set -x

# Configuration
QUEUE_DIR="/tmp/at_queue"
TOKEN_FILE="$QUEUE_DIR/token"
TRACK_FILE="/tmp/quecprofiles_active"
CHECK_TRIGGER="/tmp/quecprofiles_check"
STATUS_FILE="/tmp/quecprofiles_status.json"
DEBUG_LOG="/tmp/quecprofiles_debug.log"
DETAILED_LOG="/tmp/quecprofiles_detailed.log"
COMMAND_TIMEOUT=10     # Default timeout for AT commands in seconds
QUEUE_PRIORITY=3       # Medium-high priority (1 is highest for cell scan)
MAX_TOKEN_WAIT=15      # Maximum seconds to wait for token acquisition
MAX_RETRIES=12         # Maximum number of retries (at 5 seconds each)

# Early directory creation
mkdir -p "$QUEUE_DIR" 2>> "$DIRECT_LOG"
echo "Basic directories created" >> "$DIRECT_LOG"

# Function to log messages with timestamps and multiple destinations
log_message() {
    local message="$1"
    local level="${2:-info}"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    local log_prefix="[PROFILE_DAEMON]"
    
    # Also log directly to our debug file
    echo "[$timestamp] [$level] $log_prefix $message" >> "$DIRECT_LOG"
    
    # Log to system log
    logger -t quecprofiles -p "daemon.$level" "daemon: $log_prefix $message"
    
    # Try to log to debug file with timestamp
    if [ ! -f "$DEBUG_LOG" ]; then
        touch "$DEBUG_LOG" 2>> "$DIRECT_LOG"
        chmod 644 "$DEBUG_LOG" 2>> "$DIRECT_LOG"
    fi
    echo "[$timestamp] [$level] $log_prefix $message" >> "$DEBUG_LOG" 2>> "$DIRECT_LOG"
    
    # Try to log to detailed log with more context
    if [ ! -f "$DETAILED_LOG" ]; then
        touch "$DETAILED_LOG" 2>> "$DIRECT_LOG"
        chmod 644 "$DETAILED_LOG" 2>> "$DIRECT_LOG"
    fi
    echo "[$timestamp] [$level] $log_prefix $message" >> "$DETAILED_LOG" 2>> "$DIRECT_LOG"
    
    # For critical errors, also log to system console
    if [ "$level" = "error" ] || [ "$level" = "crit" ]; then
        echo "quecprofiles: $log_prefix $message" > /dev/console 2>> "$DIRECT_LOG"
    fi
}

# Log startup
log_message "Script initialization completed" "info"

# Function to update track file with status
update_track() {
    local status="$1"
    local message="$2"
    local profile="${3:-unknown}"
    local progress="${4:-0}"
    
    echo "update_track called with: status=$status, message=$message, profile=$profile, progress=$progress" >> "$DIRECT_LOG"
    
    # Create JSON status
    cat > "$STATUS_FILE" <<EOF
{
    "status": "$status",
    "message": "$message",
    "profile": "$profile",
    "progress": $progress,
    "timestamp": "$(date +%s)"
}
EOF
    
    # Create simple track file for easy checking
    if [ "$status" = "idle" ]; then
        rm -f "$TRACK_FILE" 2>> "$DIRECT_LOG"
    else
        echo "$status:$profile:$progress" > "$TRACK_FILE"
        chmod 644 "$TRACK_FILE" 2>> "$DIRECT_LOG"
    fi
    
    log_message "Status updated: $status - $message ($progress%)" "info"
}

# Check script environment
which logger >> "$DIRECT_LOG" 2>&1
which sms_tool >> "$DIRECT_LOG" 2>&1
which jsonfilter >> "$DIRECT_LOG" 2>&1
which uci >> "$DIRECT_LOG" 2>&1

# Function to acquire token directly with retries
acquire_token() {
    local lock_id="QUECPROFILES_$(date +%s)_$$"
    local priority="$QUEUE_PRIORITY"
    local max_attempts=$MAX_TOKEN_WAIT
    local attempt=0
    
    echo "acquire_token: Starting acquisition with priority $priority" >> "$DIRECT_LOG"
    log_message "Attempting to acquire AT queue token with priority $priority" "debug"
    
    while [ $attempt -lt $max_attempts ]; do
        # Check if token file exists
        if [ -f "$TOKEN_FILE" ]; then
            local current_holder=$(cat "$TOKEN_FILE" | jsonfilter -e '@.id' 2>/dev/null)
            echo "acquire_token: Token exists, held by $current_holder" >> "$DIRECT_LOG"
            local current_priority=$(cat "$TOKEN_FILE" | jsonfilter -e '@.priority' 2>/dev/null)
            local timestamp=$(cat "$TOKEN_FILE" | jsonfilter -e '@.timestamp' 2>/dev/null)
            local current_time=$(date +%s)
            
            # Check for expired token (> 30 seconds old)
            if [ $((current_time - timestamp)) -gt 30 ] || [ -z "$current_holder" ]; then
                # Remove expired token
                echo "acquire_token: Found expired token, removing" >> "$DIRECT_LOG"
                log_message "Found expired token from $current_holder, removing" "debug"
                rm -f "$TOKEN_FILE" 2>/dev/null
            elif [ $priority -lt $current_priority ]; then
                # Preempt lower priority token
                echo "acquire_token: Preempting lower priority token" >> "$DIRECT_LOG"
                log_message "Preempting token from $current_holder (priority: $current_priority) with our priority $priority" "debug"
                rm -f "$TOKEN_FILE" 2>/dev/null
            else
                # Try again - higher priority token exists
                echo "acquire_token: Cannot preempt, waiting (attempt $attempt)" >> "$DIRECT_LOG"
                log_message "Token held by $current_holder with priority $current_priority, our priority $priority is not higher, retrying... (attempt $attempt/$max_attempts)" "debug"
                sleep 0.5
                attempt=$((attempt + 1))
                continue
            fi
        fi
        
        # Try to create token file
        echo "acquire_token: Attempting to create token file" >> "$DIRECT_LOG"
        echo "{\"id\":\"$lock_id\",\"priority\":$priority,\"timestamp\":$(date +%s)}" > "$TOKEN_FILE" 2>/dev/null
        chmod 644 "$TOKEN_FILE" 2>/dev/null
        
        # Verify we got the token
        local holder=$(cat "$TOKEN_FILE" 2>/dev/null | jsonfilter -e '@.id' 2>/dev/null)
        if [ "$holder" = "$lock_id" ]; then
            echo "acquire_token: Successfully acquired token" >> "$DIRECT_LOG"
            log_message "Successfully acquired token with ID $lock_id and priority $priority" "debug"
            echo "$lock_id"
            return 0
        fi
        
        echo "acquire_token: Failed to acquire token, will retry" >> "$DIRECT_LOG"
        sleep 0.5
        attempt=$((attempt + 1))
    done
    
    echo "acquire_token: Failed after $max_attempts attempts" >> "$DIRECT_LOG"
    log_message "Failed to acquire token after $max_attempts attempts" "error"
    return 1
}

# Simple test function to avoid AT command dependency
test_get_iccid() {
    echo "Running test_get_iccid function" >> "$DIRECT_LOG"
    log_message "Using test ICCID function" "info"
    echo "89860619050002889601"
    return 0
}

# Basic initialization check
check_basic_status() {
    log_message "Checking basic status" "info"
    echo "test" > /tmp/quecprofiles_test_$$
    if [ -f "/tmp/quecprofiles_test_$$" ]; then
        log_message "Basic file operations working" "info"
        rm -f /tmp/quecprofiles_test_$$
    else
        log_message "Failed to write test file" "error"
    fi
    
    # Check directory access
    if [ -d "$QUEUE_DIR" ]; then
        log_message "Queue directory exists" "info"
    else
        log_message "Queue directory does not exist" "error"
        mkdir -p "$QUEUE_DIR" 2>/dev/null
    fi
    
    # Test token file access
    echo '{"test":"value"}' > "$TOKEN_FILE.test"
    if [ -f "$TOKEN_FILE.test" ]; then
        log_message "Token file test successful" "info"
        rm -f "$TOKEN_FILE.test"
    else
        log_message "Failed to create test token file" "error"
    fi
    
    # Check for sms_tool
    if which sms_tool >/dev/null 2>&1; then
        log_message "sms_tool is available" "info"
    else
        log_message "sms_tool is not available" "error"
    fi
}

# Function to find and apply matching profile - simplified test version
test_check_and_apply_profiles() {
    local iccid
    
    log_message "Starting profile check (TEST MODE)" "info"
    update_track "checking" "Checking AT queue system readiness (TEST MODE)" "unknown" "0"
    
    # Use test function to get ICCID
    iccid=$(test_get_iccid)
    log_message "Test ICCID: $iccid" "info"
    
    # Find matching profile in UCI config
    local profile_found=0
    local profile_count=$(uci -q show quecprofiles | grep -c "=profile$")
    log_message "Found $profile_count profile(s) in configuration" "info"
    
    # Simulate profile not found
    log_message "No matching profile found for test ICCID: $iccid (TEST MODE)" "info"
    update_track "idle" "No matching profile found (TEST MODE)" "unknown" "0"
    
    return 0
}

# Main debug function - simplified for diagnosing startup issues
debug_main() {
    log_message "==== Starting QuecProfiles daemon (DEBUG MODE) ====" "info"
    update_track "idle" "Daemon started in debug mode" "unknown" "0"
    
    # Check basic functionality
    check_basic_status
    
    # Try test profile check
    test_check_and_apply_profiles
    
    log_message "Debug test completed successfully" "info"
}

# Function to show usage information
show_usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -f    Run in foreground (default: background)"
    echo "  -d    Enable debug output to console"
    echo "  -c    Check profiles once and exit"
    echo "  -h    Show this help message"
}

# Parse command line arguments
RUN_FOREGROUND=0
CHECK_ONCE=0
DEBUG_OUTPUT=0

while getopts "fdch" opt; do
    case $opt in
        f) RUN_FOREGROUND=1 ;;
        d) DEBUG_OUTPUT=1 ;;
        c) CHECK_ONCE=1 ;;
        h) show_usage; exit 0 ;;
        ?) show_usage; exit 1 ;;
    esac
done

# Log parsed arguments
echo "Parsed arguments: RUN_FOREGROUND=$RUN_FOREGROUND, CHECK_ONCE=$CHECK_ONCE, DEBUG_OUTPUT=$DEBUG_OUTPUT" >> "$DIRECT_LOG"

# If debug output is enabled, redirect output to console
if [ $DEBUG_OUTPUT -eq 1 ]; then
    # Redirect all output to both console and log file
    echo "Debug output enabled, redirecting to console" >> "$DIRECT_LOG"
    # exec > >(tee -a "$DETAILED_LOG") 2>&1
    log_message "Debug output enabled" "info"
fi

# Run debug test
log_message "Running in debug test mode" "info"
debug_main
echo "Debug script completed at $(date)" >> "$DIRECT_LOG"

exit 0