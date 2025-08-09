#!/bin/sh
# Simple QCAINFO Interpreter

# Configuration
QCAINFO_FILE="/www/signal_graphs/qcainfo.json"
INTERPRETED_FILE="/tmp/interpreted_result.json"
DEBUG_LOG="/tmp/qcainfo_interpreter.log"
INTERVAL=15

# Simple logging function
log() {
    echo "$(date): $1" >> "$DEBUG_LOG"
}

# Parse QCAINFO output to extract band and EARFCN
parse_entry() {
    local output="$1"
    local datetime="$2"
    
    # Extract band and EARFCN using simple grep
    local band=$(echo "$output" | grep -o 'LTE BAND [0-9]*' | head -1)
    local earfcn=$(echo "$output" | grep -o '+QCAINFO: "PCC",[0-9]*' | grep -o '[0-9]*' | head -1)
    local pci=$(echo "$output" | grep -o '+QCAINFO: "PCC",[0-9]*,[0-9]*' | grep -o ',[0-9]*,' | tr -d ',' | head -1)
    
    # Check for SCC (carrier aggregation)
    local has_scc=""
    if echo "$output" | grep -q '+QCAINFO: "SCC"'; then
        has_scc="yes"
    else
        has_scc="no"
    fi
    
    echo "${datetime}|${band}|${earfcn}|${pci}|${has_scc}"
}

# Compare two entries and generate interpretation
generate_interpretation() {
    local old_entry="$1"
    local new_entry="$2"
    
    # Parse entries
    local old_datetime=$(echo "$old_entry" | cut -d'|' -f1)
    local old_band=$(echo "$old_entry" | cut -d'|' -f2)
    local old_earfcn=$(echo "$old_entry" | cut -d'|' -f3)
    local old_pci=$(echo "$old_entry" | cut -d'|' -f4)
    local old_scc=$(echo "$old_entry" | cut -d'|' -f5)
    
    local new_datetime=$(echo "$new_entry" | cut -d'|' -f1)
    local new_band=$(echo "$new_entry" | cut -d'|' -f2)
    local new_earfcn=$(echo "$new_entry" | cut -d'|' -f3)
    local new_pci=$(echo "$new_entry" | cut -d'|' -f4)
    local new_scc=$(echo "$new_entry" | cut -d'|' -f5)
    
    local time_only=$(echo "$new_datetime" | awk '{print $2}' | cut -d: -f1,2)
    local interpretation=""
    
    # Check for band change
    if [ "$old_band" != "$new_band" ]; then
        interpretation="${interpretation}At ${time_only}, your modem changed primary band from ${old_band} to ${new_band}. "
    fi
    
    # Check for EARFCN change
    if [ "$old_earfcn" != "$new_earfcn" ]; then
        interpretation="${interpretation}At ${time_only}, your modem changed primary EARFCN from ${old_earfcn} to ${new_earfcn}. "
    fi
    
    # Check for PCI change
    if [ "$old_pci" != "$new_pci" ]; then
        interpretation="${interpretation}At ${time_only}, your modem changed primary PCI from ${old_pci} to ${new_pci}. "
    fi
    
    # Check for carrier aggregation changes
    if [ "$old_scc" = "no" ] && [ "$new_scc" = "yes" ]; then
        interpretation="${interpretation}At ${time_only}, your modem activated carrier aggregation. "
    elif [ "$old_scc" = "yes" ] && [ "$new_scc" = "no" ]; then
        interpretation="${interpretation}At ${time_only}, your modem deactivated carrier aggregation. "
    fi
    
    echo "$interpretation"
}

# Add interpretation to JSON file without jq
add_interpretation() {
    local interpretation="$1"
    local datetime="$2"
    
    if [ -z "$interpretation" ]; then
        return
    fi
    
    # Initialize file if it doesn't exist
    if [ ! -f "$INTERPRETED_FILE" ]; then
        echo "[]" > "$INTERPRETED_FILE"
    fi
    
    # Read existing content
    local existing_content=$(cat "$INTERPRETED_FILE")
    
    # Escape quotes in interpretation
    local escaped_interpretation=$(echo "$interpretation" | sed 's/"/\\"/g')
    
    # Create new entry
    local new_entry="{\"datetime\":\"$datetime\",\"interpretation\":\"$escaped_interpretation\"}"
    
    # Add to array
    if [ "$existing_content" = "[]" ]; then
        echo "[$new_entry]" > "$INTERPRETED_FILE"
    else
        # Remove closing bracket, add comma and new entry
        echo "$existing_content" | sed 's/]$//' > "$INTERPRETED_FILE.tmp"
        echo ",$new_entry]" >> "$INTERPRETED_FILE.tmp"
        mv "$INTERPRETED_FILE.tmp" "$INTERPRETED_FILE"
    fi
    
    log "Added interpretation: $interpretation"
}

# Main processing function
process_qcainfo() {
    if [ ! -f "$QCAINFO_FILE" ]; then
        log "QCAINFO file not found: $QCAINFO_FILE"
        return
    fi
    
    # Get total entries
    local total_entries=$(jq 'length' "$QCAINFO_FILE" 2>/dev/null)
    if [ -z "$total_entries" ] || [ "$total_entries" = "null" ] || [ "$total_entries" -lt 2 ]; then
        log "Not enough entries to compare (need at least 2, found: $total_entries)"
        return
    fi
    
    log "Found $total_entries entries in QCAINFO file"
    
    # Get last two entries
    local last_entry=$(jq -r '.[-1]' "$QCAINFO_FILE" 2>/dev/null)
    local second_last_entry=$(jq -r '.[-2]' "$QCAINFO_FILE" 2>/dev/null)
    
    if [ "$last_entry" = "null" ] || [ "$second_last_entry" = "null" ]; then
        log "Failed to get last two entries"
        return
    fi
    
    # Extract data from JSON entries
    local last_datetime=$(echo "$last_entry" | jq -r '.datetime')
    local last_output=$(echo "$last_entry" | jq -r '.output')
    local second_datetime=$(echo "$second_last_entry" | jq -r '.datetime')
    local second_output=$(echo "$second_last_entry" | jq -r '.output')
    
    log "Comparing entries: $second_datetime vs $last_datetime"
    
    # Parse entries
    local parsed_second=$(parse_entry "$second_output" "$second_datetime")
    local parsed_last=$(parse_entry "$last_output" "$last_datetime")
    
    log "Parsed second: $parsed_second"
    log "Parsed last: $parsed_last"
    
    # Generate interpretation
    local interpretation=$(generate_interpretation "$parsed_second" "$parsed_last")
    
    if [ -n "$interpretation" ]; then
        add_interpretation "$interpretation" "$last_datetime"
        log "Generated interpretation for $last_datetime"
    else
        log "No changes detected between $second_datetime and $last_datetime"
    fi
}

# Initialize
log "QCAINFO Interpreter started (PID: $$)"

# Initialize interpreted results file
if [ ! -f "$INTERPRETED_FILE" ]; then
    echo "[]" > "$INTERPRETED_FILE"
    log "Initialized interpreted results file"
fi

# Process all existing data once at startup
log "Processing all existing QCAINFO data..."
if [ -f "$QCAINFO_FILE" ]; then
    total=$(jq 'length' "$QCAINFO_FILE" 2>/dev/null)
    if [ "$total" -gt 1 ]; then
        # Process all consecutive pairs
        i=1
        while [ $i -lt $total ]; do
            prev_entry=$(jq -r ".[$((i-1))]" "$QCAINFO_FILE" 2>/dev/null)
            curr_entry=$(jq -r ".[$i]" "$QCAINFO_FILE" 2>/dev/null)
            
            if [ "$prev_entry" != "null" ] && [ "$curr_entry" != "null" ]; then
                prev_datetime=$(echo "$prev_entry" | jq -r '.datetime')
                prev_output=$(echo "$prev_entry" | jq -r '.output')
                curr_datetime=$(echo "$curr_entry" | jq -r '.datetime')
                curr_output=$(echo "$curr_entry" | jq -r '.output')
                
                parsed_prev=$(parse_entry "$prev_output" "$prev_datetime")
                parsed_curr=$(parse_entry "$curr_output" "$curr_datetime")
                
                interpretation=$(generate_interpretation "$parsed_prev" "$parsed_curr")
                
                if [ -n "$interpretation" ]; then
                    add_interpretation "$interpretation" "$curr_datetime"
                fi
            fi
            i=$((i + 1))
        done
        log "Completed processing all existing data ($total entries)"
    else
        log "Not enough existing data to process"
    fi
fi

# Remember last processed entry count
last_count=$(jq 'length' "$QCAINFO_FILE" 2>/dev/null)

# Main monitoring loop
log "Starting continuous monitoring (checking every $INTERVAL seconds)"
while true; do
    sleep "$INTERVAL"
    
    current_count=$(jq 'length' "$QCAINFO_FILE" 2>/dev/null)
    
    if [ "$current_count" -gt "$last_count" ]; then
        log "New entries detected: $last_count -> $current_count"
        process_qcainfo
        last_count="$current_count"
    fi
done