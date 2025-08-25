#!/bin/sh

# QuecManager Centralized Logging Helper
# OpenWrt/BusyBox compatible logging system
# Usage: source this file and use qm_log function

set -e

# Base log directory
QM_LOG_BASE="/tmp/quecmanager/logs"

# Log categories
QM_LOG_DAEMONS="$QM_LOG_BASE/daemons"
QM_LOG_SERVICES="$QM_LOG_BASE/services"
QM_LOG_SETTINGS="$QM_LOG_BASE/settings"
QM_LOG_SYSTEM="$QM_LOG_BASE/system"

# Log levels
QM_LOG_ERROR="ERROR"
QM_LOG_WARN="WARN"
QM_LOG_INFO="INFO"
QM_LOG_DEBUG="DEBUG"

# Maximum log file size (in KB) - keep small for OpenWrt
QM_LOG_MAX_SIZE=500

# Initialize log directories
qm_init_logs() {
    mkdir -p "$QM_LOG_DAEMONS" "$QM_LOG_SERVICES" "$QM_LOG_SETTINGS" "$QM_LOG_SYSTEM" 2>/dev/null || true
}

# Get log file path based on category and script name
qm_get_logfile() {
    local category="$1"
    local script_name="$2"
    
    case "$category" in
        "daemon"|"daemons")
            echo "$QM_LOG_DAEMONS/${script_name}.log"
            ;;
        "service"|"services")
            echo "$QM_LOG_SERVICES/${script_name}.log"
            ;;
        "setting"|"settings")
            echo "$QM_LOG_SETTINGS/${script_name}.log"
            ;;
        "system")
            echo "$QM_LOG_SYSTEM/${script_name}.log"
            ;;
        *)
            echo "$QM_LOG_SYSTEM/unknown.log"
            ;;
    esac
}

# Simple log rotation - keep it OpenWrt compatible
qm_rotate_log() {
    local logfile="$1"
    
    if [ -f "$logfile" ]; then
        # Get file size in KB (use du for BusyBox compatibility)
        local size_kb=$(du -k "$logfile" 2>/dev/null | cut -f1)
        
        if [ "${size_kb:-0}" -gt "$QM_LOG_MAX_SIZE" ]; then
            # Simple rotation: keep last 2 versions
            [ -f "${logfile}.1" ] && mv "${logfile}.1" "${logfile}.2" 2>/dev/null || true
            mv "$logfile" "${logfile}.1" 2>/dev/null || true
            touch "$logfile" 2>/dev/null || true
        fi
    fi
}

# Main logging function
# Usage: qm_log "category" "script_name" "level" "message"
qm_log() {
    local category="$1"
    local script_name="$2" 
    local level="$3"
    local message="$4"
    
    # Initialize if needed
    qm_init_logs
    
    # Get log file path
    local logfile=$(qm_get_logfile "$category" "$script_name")
    
    # Rotate if needed
    qm_rotate_log "$logfile"
    
    # Create log entry with OpenWrt compatible date
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date)
    local pid="$$"
    
    # Write log entry
    printf '[%s] [%s] [%s] [PID:%s] %s\n' "$timestamp" "$level" "$script_name" "$pid" "$message" >> "$logfile" 2>/dev/null || true
}

# Convenience functions for different log levels
qm_log_error() {
    qm_log "$1" "$2" "$QM_LOG_ERROR" "$3"
}

qm_log_warn() {
    qm_log "$1" "$2" "$QM_LOG_WARN" "$3"
}

qm_log_info() {
    qm_log "$1" "$2" "$QM_LOG_INFO" "$3"
}

qm_log_debug() {
    qm_log "$1" "$2" "$QM_LOG_DEBUG" "$3"
}

# Cleanup old logs (called periodically)
qm_cleanup_logs() {
    # Remove .2 backup files older than 1 day to save space
    find "$QM_LOG_BASE" -name "*.2" -type f -mtime +1 -delete 2>/dev/null || true
}
