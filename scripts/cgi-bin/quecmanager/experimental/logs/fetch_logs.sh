#!/bin/sh

# QuecManager Log Viewer API
# Provides centralized log access for the web interface

. /www/cgi-bin/services/quecmanager_logger.sh

# CGI Headers
printf "Content-Type: application/json\r\n"
printf "Access-Control-Allow-Origin: *\r\n"
printf "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
printf "Access-Control-Allow-Headers: Content-Type\r\n"
printf "\r\n"

# Initialize logs if needed
qm_init_logs

# Parse query parameters
QUERY_STRING="${QUERY_STRING:-}"
CATEGORY=""
SCRIPT=""
LEVEL=""
LINES="50"
SINCE=""

# Simple parameter parsing
if [ -n "$QUERY_STRING" ]; then
    for param in $(echo "$QUERY_STRING" | tr '&' ' '); do
        case "$param" in
            category=*)
                CATEGORY=$(echo "$param" | cut -d'=' -f2 | sed 's/%20/ /g' | tr -d '"')
                ;;
            script=*)
                SCRIPT=$(echo "$param" | cut -d'=' -f2 | sed 's/%20/ /g' | tr -d '"')
                ;;
            level=*)
                LEVEL=$(echo "$param" | cut -d'=' -f2 | sed 's/%20/ /g' | tr -d '"')
                ;;
            lines=*)
                LINES=$(echo "$param" | cut -d'=' -f2 | tr -d '"')
                ;;
            since=*)
                SINCE=$(echo "$param" | cut -d'=' -f2 | sed 's/%20/ /g' | tr -d '"')
                ;;
        esac
    done
fi

# Validate lines parameter
if ! echo "$LINES" | grep -qE '^[0-9]+$' || [ "$LINES" -gt 1000 ]; then
    LINES="50"
fi

# Function to get available categories
get_categories() {
    printf '{\n'
    printf '  "categories": [\n'
    if [ -d "$QM_LOG_DAEMONS" ]; then
        printf '    "daemons"'
        [ -d "$QM_LOG_SERVICES" ] || [ -d "$QM_LOG_SETTINGS" ] || [ -d "$QM_LOG_SYSTEM" ] && printf ','
        printf '\n'
    fi
    if [ -d "$QM_LOG_SERVICES" ]; then
        printf '    "services"'
        [ -d "$QM_LOG_SETTINGS" ] || [ -d "$QM_LOG_SYSTEM" ] && printf ','
        printf '\n'
    fi
    if [ -d "$QM_LOG_SETTINGS" ]; then
        printf '    "settings"'
        [ -d "$QM_LOG_SYSTEM" ] && printf ','
        printf '\n'
    fi
    if [ -d "$QM_LOG_SYSTEM" ]; then
        printf '    "system"\n'
    fi
    printf '  ]\n'
    printf '}\n'
}

# Function to get available scripts for a category
get_scripts() {
    local cat_dir=""
    case "$CATEGORY" in
        "daemons") cat_dir="$QM_LOG_DAEMONS" ;;
        "services") cat_dir="$QM_LOG_SERVICES" ;;
        "settings") cat_dir="$QM_LOG_SETTINGS" ;;
        "system") cat_dir="$QM_LOG_SYSTEM" ;;
        *) 
            printf '{"error": "Invalid category"}\n'
            return 1
            ;;
    esac
    
    if [ ! -d "$cat_dir" ]; then
        printf '{"scripts": []}\n'
        return 0
    fi
    
    printf '{\n'
    printf '  "scripts": [\n'
    
    first=true
    for logfile in "$cat_dir"/*.log; do
        if [ -f "$logfile" ]; then
            if [ "$first" = "false" ]; then
                printf ',\n'
            fi
            script_name=$(basename "$logfile" .log)
            printf '    "%s"' "$script_name"
            first=false
        fi
    done
    
    printf '\n  ]\n'
    printf '}\n'
}

# Function to get log entries
get_logs() {
    local logfile=""
    
    if [ -n "$CATEGORY" ] && [ -n "$SCRIPT" ]; then
        logfile=$(qm_get_logfile "$CATEGORY" "$SCRIPT")
    else
        printf '{"error": "Category and script parameters required"}\n'
        return 1
    fi
    
    if [ ! -f "$logfile" ]; then
        printf '{"entries": [], "total": 0}\n'
        return 0
    fi
    
    # Get log entries with optional filtering
    local temp_file="/tmp/quecmanager_log_view.$$"
    
    # Start with all entries
    cat "$logfile" > "$temp_file" 2>/dev/null
    
    # Filter by level if specified
    if [ -n "$LEVEL" ]; then
        grep "\[$LEVEL\]" "$temp_file" > "${temp_file}.filtered" 2>/dev/null || touch "${temp_file}.filtered"
        mv "${temp_file}.filtered" "$temp_file"
    fi
    
    # Filter by time if specified (simple grep for now)
    if [ -n "$SINCE" ]; then
        grep "$SINCE" "$temp_file" > "${temp_file}.filtered" 2>/dev/null || touch "${temp_file}.filtered"
        mv "${temp_file}.filtered" "$temp_file"
    fi
    
    # Get total count
    local total_count=$(wc -l < "$temp_file" 2>/dev/null || echo "0")
    
    # Get last N lines
    tail -n "$LINES" "$temp_file" > "${temp_file}.final" 2>/dev/null || touch "${temp_file}.final"
    
    printf '{\n'
    printf '  "entries": [\n'
    
    first=true
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            if [ "$first" = "false" ]; then
                printf ',\n'
            fi
            
            # Parse log line (format: [timestamp] [level] [script] [pid] message)
            timestamp=$(echo "$line" | sed -n 's/^\[\([^]]*\)\].*/\1/p')
            level=$(echo "$line" | sed -n 's/^[^]]*\] \[\([^]]*\)\].*/\1/p')
            script=$(echo "$line" | sed -n 's/^[^]]*\] [^]]*\] \[\([^]]*\)\].*/\1/p')
            pid=$(echo "$line" | sed -n 's/^[^]]*\] [^]]*\] [^]]*\] \[PID:\([^]]*\)\].*/\1/p')
            message=$(echo "$line" | sed 's/^[^]]*\] [^]]*\] [^]]*\] [^]]*\] //')
            
            # Escape quotes in message
            message=$(echo "$message" | sed 's/"/\\"/g')
            
            printf '    {\n'
            printf '      "timestamp": "%s",\n' "$timestamp"
            printf '      "level": "%s",\n' "$level"
            printf '      "script": "%s",\n' "$script"
            printf '      "pid": "%s",\n' "$pid"
            printf '      "message": "%s"\n' "$message"
            printf '    }'
            
            first=false
        fi
    done < "${temp_file}.final"
    
    printf '\n  ],\n'
    printf '  "total": %s,\n' "$total_count"
    printf '  "showing": %s\n' "$LINES"
    printf '}\n'
    
    # Cleanup temp files
    rm -f "$temp_file" "${temp_file}.filtered" "${temp_file}.final" 2>/dev/null || true
}

# Main logic
case "$REQUEST_METHOD" in
    "GET")
        if [ -z "$CATEGORY" ]; then
            # Return available categories
            get_categories
        elif [ -z "$SCRIPT" ]; then
            # Return available scripts for category
            get_scripts
        else
            # Return log entries
            get_logs
        fi
        ;;
    "OPTIONS")
        # Handle CORS preflight
        exit 0
        ;;
    *)
        printf '{"error": "Method not allowed"}\n'
        ;;
esac
