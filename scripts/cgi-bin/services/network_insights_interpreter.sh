#!/bin/sh
# Network Insights Interpreter Service
# Monitors qcainfo.json and generates network event interpretations
# OpenWrt/BusyBox compatible version

# Configuration
QCAINFO_FILE="/www/signal_graphs/qcainfo.json"
INTERPRETED_FILE="/tmp/interpreted_result.json"
LAST_ENTRY_FILE="/tmp/last_qcainfo_entry.json"
LOCKFILE="/tmp/network_interpreter.lock"
MAX_INTERPRETATIONS=50

# Logging function (OpenWrt compatible)
log_message() {
    if command -v logger >/dev/null 2>&1; then
        logger -t network_interpreter -p daemon.info "$1"
    else
        # Use simpler date format for BusyBox
        echo "$(date) [network_interpreter] $1" >&2
    fi
}

# Convert datetime to timestamp (OpenWrt/BusyBox compatible)
datetime_to_timestamp() {
    local datetime="$1"
    # Try GNU date first, fallback to string comparison for BusyBox
    if date -d "$datetime" +%s >/dev/null 2>&1; then
        date -d "$datetime" +%s
    else
        # For BusyBox, just return the datetime string for string comparison
        # This is less precise but works for sequential comparison
        echo "$datetime"
    fi
}

# Compare timestamps/datetime strings (OpenWrt compatible)
is_datetime_newer() {
    local datetime1="$1"
    local datetime2="$2"
    
    local ts1=$(datetime_to_timestamp "$datetime1")
    local ts2=$(datetime_to_timestamp "$datetime2")
    
    # If we got numeric timestamps, compare numerically
    if [ "$ts1" -eq "$ts1" ] 2>/dev/null && [ "$ts2" -eq "$ts2" ] 2>/dev/null; then
        [ "$ts1" -gt "$ts2" ]
    else
        # Fall back to string comparison (works for ISO format)
        [ "$datetime1" \> "$datetime2" ]
    fi
}

# Parse QCAINFO output to extract band information and PCI data
parse_qcainfo_bands() {
    local output="$1"
    
    # Clean up the output - remove escape sequences and extra characters
    local clean_output=$(echo "$output" | tr -d '\r' | sed 's/\\r//g; s/\\n/\n/g')
    
    # Extract all band information from QCAINFO lines
    echo "$clean_output" | grep "+QCAINFO:" | while IFS= read -r line; do
        if echo "$line" | grep -q "LTE BAND"; then
            band=$(echo "$line" | sed -n 's/.*"LTE BAND \([0-9][0-9]*\)".*/B\1/p')
            if [ -n "$band" ]; then
                echo "LTE:$band"
            fi
        elif echo "$line" | grep -q "NR5G BAND"; then
            band=$(echo "$line" | sed -n 's/.*"NR5G BAND \([0-9][0-9]*\)".*/N\1/p')
            if [ -n "$band" ]; then
                echo "NR5G:$band"
            fi
        fi
    done
}

# Parse PCI information from QCAINFO output
parse_qcainfo_pci() {
    local output="$1"
    
    # Clean up the output
    local clean_output=$(echo "$output" | tr -d '\r' | sed 's/\\r//g; s/\\n/\n/g')
    
    # Extract PCI information from PCC (Primary Component Carrier) and SCC (Secondary Component Carrier) lines
    local pci_list=""
    
    # Get PCC PCI (Primary Cell)
    local pcc_pci=$(echo "$clean_output" | grep '+QCAINFO: "PCC"' | head -1 | sed -n 's/.*+QCAINFO: "PCC",[0-9]*,\([0-9]*\).*/\1/p')
    if [ -n "$pcc_pci" ]; then
        pci_list="PCC:$pcc_pci"
    fi
    
    # Get SCC PCIs (Secondary Cells)
    local scc_count=0
    echo "$clean_output" | grep '+QCAINFO: "SCC"' | while IFS= read -r line; do
        local scc_pci=$(echo "$line" | sed -n 's/.*+QCAINFO: "SCC",[0-9]*,\([0-9]*\).*/\1/p')
        if [ -n "$scc_pci" ]; then
            scc_count=$((scc_count + 1))
            if [ -n "$pci_list" ]; then
                pci_list="$pci_list,SCC$scc_count:$scc_pci"
            else
                pci_list="SCC$scc_count:$scc_pci"
            fi
        fi
    done
    
    echo "$pci_list"
}

# Get primary PCI from PCI list
get_primary_pci() {
    local pci_list="$1"
    echo "$pci_list" | sed -n 's/.*PCC:\([0-9]*\).*/\1/p'
}

# Get secondary PCIs from PCI list
get_secondary_pcis() {
    local pci_list="$1"
    echo "$pci_list" | grep -o 'SCC[0-9]*:[0-9]*' | sed 's/SCC[0-9]*://' | tr '\n' ',' | sed 's/,$//'
}

# Compare PCI configurations and generate interpretation
compare_pci_configurations() {
    local base_pci_list="$1"
    local new_pci_list="$2"
    
    local base_primary=$(get_primary_pci "$base_pci_list")
    local new_primary=$(get_primary_pci "$new_pci_list")
    local base_secondary=$(get_secondary_pcis "$base_pci_list")
    local new_secondary=$(get_secondary_pcis "$new_pci_list")
    
    local pci_interpretations=""
    
    # Check for primary PCI changes
    if [ -n "$base_primary" ] && [ -n "$new_primary" ] && [ "$base_primary" != "$new_primary" ]; then
        pci_interpretations="Primary cell PCI changed from $base_primary to $new_primary"
    fi
    
    # Check for secondary PCI changes
    if [ "$base_secondary" != "$new_secondary" ]; then
        if [ -n "$pci_interpretations" ]; then
            pci_interpretations="$pci_interpretations; "
        fi
        
        if [ -z "$base_secondary" ] && [ -n "$new_secondary" ]; then
            pci_interpretations="${pci_interpretations}Secondary cells added (PCI: $new_secondary)"
        elif [ -n "$base_secondary" ] && [ -z "$new_secondary" ]; then
            pci_interpretations="${pci_interpretations}Secondary cells removed (was PCI: $base_secondary)"
        elif [ -n "$base_secondary" ] && [ -n "$new_secondary" ]; then
            pci_interpretations="${pci_interpretations}Secondary cell PCIs changed from ($base_secondary) to ($new_secondary)"
        fi
    fi
    
    echo "$pci_interpretations"
}

# Get network mode from bands
get_network_mode() {
    local bands="$1"
    local has_lte=false
    local has_nr5g=false
    
    if echo "$bands" | grep -q "LTE:"; then
        has_lte=true
    fi
    if echo "$bands" | grep -q "NR5G:"; then
        has_nr5g=true
    fi
    
    if [ "$has_lte" = true ] && [ "$has_nr5g" = true ]; then
        echo "NSA"
    elif [ "$has_lte" = true ]; then
        echo "LTE"
    elif [ "$has_nr5g" = true ]; then
        echo "SA"
    else
        echo "NO_SIGNAL"
    fi
}

# Get band list from parsed bands
get_band_list() {
    local bands="$1"
    if [ -z "$bands" ]; then
        echo ""
        return
    fi
    echo "$bands" | sed 's/LTE://g; s/NR5G://g' | sort -u | tr '\n' ',' | sed 's/,$//'
}

# Get carrier count
get_carrier_count() {
    local bands="$1"
    if [ -z "$bands" ]; then
        echo "0"
        return
    fi
    echo "$bands" | wc -l
}

# Compare two band configurations and generate interpretation
compare_configurations() {
    local base_output="$1"
    local new_output="$2"
    local base_datetime="$3"
    local new_datetime="$4"
    
    # Parse both configurations
    local base_bands=$(parse_qcainfo_bands "$base_output")
    local new_bands=$(parse_qcainfo_bands "$new_output")
    local base_pci_list=$(parse_qcainfo_pci "$base_output")
    local new_pci_list=$(parse_qcainfo_pci "$new_output")
    
    local base_mode=$(get_network_mode "$base_bands")
    local new_mode=$(get_network_mode "$new_bands")
    
    local base_band_list=$(get_band_list "$base_bands")
    local new_band_list=$(get_band_list "$new_bands")
    
    local base_carrier_count=$(get_carrier_count "$base_bands")
    local new_carrier_count=$(get_carrier_count "$new_bands")
    
    local interpretations=""
    
    # Check for no signal condition
    if [ "$new_mode" = "NO_SIGNAL" ]; then
        if [ "$base_mode" != "NO_SIGNAL" ]; then
            interpretations="Signal lost - No cellular connection detected"
        fi
    # Check if signal was restored
    elif [ "$base_mode" = "NO_SIGNAL" ] && [ "$new_mode" != "NO_SIGNAL" ]; then
        interpretations="Signal restored - Connected to $new_mode network"
        if [ -n "$new_band_list" ]; then
            interpretations="$interpretations ($new_band_list)"
        fi
        # Check if CA was activated immediately upon signal restoration
        if [ "$new_carrier_count" -gt 1 ]; then
            interpretations="$interpretations; Carrier Aggregation activated - Now using $new_carrier_count carriers"
        fi
    else
        # Network mode changes
        if [ "$base_mode" != "$new_mode" ]; then
            case "$new_mode" in
                "LTE")
                    if [ "$base_mode" = "NSA" ]; then
                        interpretations="Network mode changed from NSA to LTE-only"
                    elif [ "$base_mode" = "SA" ]; then
                        interpretations="Network mode changed from 5G SA to LTE"
                    fi
                    ;;
                "SA")
                    if [ "$base_mode" = "LTE" ]; then
                        interpretations="Network mode changed from LTE to 5G SA"
                    elif [ "$base_mode" = "NSA" ]; then
                        interpretations="Network mode changed from NSA to 5G SA"
                    fi
                    ;;
                "NSA")
                    if [ "$base_mode" = "LTE" ]; then
                        interpretations="Network mode changed from LTE to NSA"
                    elif [ "$base_mode" = "SA" ]; then
                        interpretations="Network mode changed from 5G SA to NSA"
                    fi
                    ;;
            esac
        fi
        
        # Band changes
        if [ "$base_band_list" != "$new_band_list" ]; then
            if [ -n "$interpretations" ]; then
                interpretations="$interpretations; "
            fi
            
            # Find added and removed bands
            local added_bands=""
            local removed_bands=""
            
            # Check for new bands
            for band in $(echo "$new_band_list" | tr ',' ' '); do
                if [ -n "$band" ] && ! echo "$base_band_list" | grep -q "$band"; then
                    if [ -n "$added_bands" ]; then
                        added_bands="$added_bands, $band"
                    else
                        added_bands="$band"
                    fi
                fi
            done
            
            # Check for removed bands
            for band in $(echo "$base_band_list" | tr ',' ' '); do
                if [ -n "$band" ] && ! echo "$new_band_list" | grep -q "$band"; then
                    if [ -n "$removed_bands" ]; then
                        removed_bands="$removed_bands, $band"
                    else
                        removed_bands="$band"
                    fi
                fi
            done
            
            if [ -n "$added_bands" ] && [ -n "$removed_bands" ]; then
                interpretations="${interpretations}Band configuration changed - Added: $added_bands, Removed: $removed_bands"
            elif [ -n "$added_bands" ]; then
                interpretations="${interpretations}New bands added: $added_bands"
            elif [ -n "$removed_bands" ]; then
                interpretations="${interpretations}Bands removed: $removed_bands"
            else
                interpretations="${interpretations}Band sequence changed from ($base_band_list) to ($new_band_list)"
            fi
        fi
        
        # Carrier Aggregation changes
        if [ "$base_carrier_count" != "$new_carrier_count" ]; then
            if [ -n "$interpretations" ]; then
                interpretations="$interpretations; "
            fi
            
            if [ "$new_carrier_count" -gt 1 ] && [ "$base_carrier_count" -le 1 ]; then
                interpretations="${interpretations}Carrier Aggregation activated - Now using $new_carrier_count carriers"
            elif [ "$new_carrier_count" -le 1 ] && [ "$base_carrier_count" -gt 1 ]; then
                interpretations="${interpretations}Carrier Aggregation deactivated - Single carrier mode"
            elif [ "$new_carrier_count" -gt "$base_carrier_count" ]; then
                interpretations="${interpretations}Additional carriers aggregated - Carriers increased from $base_carrier_count to $new_carrier_count"
            elif [ "$new_carrier_count" -lt "$base_carrier_count" ]; then
                interpretations="${interpretations}Carriers reduced from $base_carrier_count to $new_carrier_count"
            fi
        fi
        
        # PCI changes - Check even when band configuration is the same
        local pci_interpretation=$(compare_pci_configurations "$base_pci_list" "$new_pci_list")
        if [ -n "$pci_interpretation" ]; then
            if [ -n "$interpretations" ]; then
                interpretations="$interpretations; "
            fi
            interpretations="${interpretations}$pci_interpretation"
        fi
    fi
    
    # Return interpretation if any changes detected
    if [ -n "$interpretations" ]; then
        echo "$interpretations"
    fi
}

# Add interpretation to JSON file
add_interpretation() {
    local datetime="$1"
    local interpretation="$2"
    
    # Initialize file if it doesn't exist
    if [ ! -f "$INTERPRETED_FILE" ]; then
        echo "[]" > "$INTERPRETED_FILE"
    fi
    
    # Add new interpretation using jq
    local temp_file="${INTERPRETED_FILE}.tmp.$$"
    jq --arg dt "$datetime" \
       --arg interp "$interpretation" \
       '. + [{"datetime": $dt, "interpretation": $interp}] | .[-'"$MAX_INTERPRETATIONS"':]' \
       "$INTERPRETED_FILE" > "$temp_file" 2>/dev/null && mv "$temp_file" "$INTERPRETED_FILE"
    
    chmod 644 "$INTERPRETED_FILE"
    log_message "Added interpretation: $interpretation"
}

# Process QCAINFO entries and generate interpretations
process_qcainfo_data() {
    if [ ! -f "$QCAINFO_FILE" ]; then
        log_message "QCAINFO file not found: $QCAINFO_FILE"
        return 1
    fi
    
    # Get total number of entries
    local total_entries=$(jq 'length' "$QCAINFO_FILE" 2>/dev/null || echo "0")
    
    if [ "$total_entries" -lt 2 ]; then
        log_message "Not enough entries to compare ($total_entries)"
        return 0
    fi
    
    # Get the last processed entry timestamp
    local last_processed=""
    if [ -f "$LAST_ENTRY_FILE" ]; then
        last_processed=$(cat "$LAST_ENTRY_FILE" 2>/dev/null)
    fi
    
    # Process entries sequentially
    local i=0
    while [ "$i" -lt $((total_entries - 1)) ]; do
        local base_entry=$(jq -r ".[$i]" "$QCAINFO_FILE" 2>/dev/null)
        local next_entry=$(jq -r ".[$(($i + 1))]" "$QCAINFO_FILE" 2>/dev/null)
        
        local base_datetime=$(echo "$base_entry" | jq -r '.datetime' 2>/dev/null)
        local next_datetime=$(echo "$next_entry" | jq -r '.datetime' 2>/dev/null)
        local base_output=$(echo "$base_entry" | jq -r '.output' 2>/dev/null)
        local next_output=$(echo "$next_entry" | jq -r '.output' 2>/dev/null)
        
        # Skip if this entry was already processed
        if [ -n "$last_processed" ] && [ "$next_datetime" = "$last_processed" ]; then
            i=$((i + 1))
            continue
        fi
        
        # Only process entries after the last processed one
        if [ -n "$last_processed" ]; then
            if ! is_datetime_newer "$next_datetime" "$last_processed"; then
                i=$((i + 1))
                continue
            fi
        fi
        
        # Compare configurations and generate interpretation
        local interpretation=$(compare_configurations "$base_output" "$next_output" "$base_datetime" "$next_datetime")
        
        if [ -n "$interpretation" ]; then
            add_interpretation "$next_datetime" "$interpretation"
        fi
        
        i=$((i + 1))
    done
    
    # Update last processed entry
    if [ "$total_entries" -gt 0 ]; then
        local last_datetime=$(jq -r '.[-1].datetime' "$QCAINFO_FILE" 2>/dev/null)
        echo "$last_datetime" > "$LAST_ENTRY_FILE"
    fi
}

# Check for new entries every 61 seconds
monitor_qcainfo() {
    log_message "Starting network insights interpreter monitoring"
    
    while true; do
        # Acquire lock (OpenWrt compatible)
        if (set -C; echo $$ > "$LOCKFILE") 2>/dev/null; then
            trap 'rm -f "$LOCKFILE"; exit' INT TERM EXIT
            
            process_qcainfo_data
            
            # Release lock
            rm -f "$LOCKFILE"
            trap - INT TERM EXIT
        else
            log_message "Another instance is running, skipping this cycle"
        fi
        
        sleep 61
    done
}

# Main execution
case "${1:-monitor}" in
    "monitor")
        monitor_qcainfo
        ;;
    "process")
        process_qcainfo_data
        ;;
    *)
        echo "Usage: $0 {monitor|process}"
        echo "  monitor - Run continuous monitoring (default)"
        echo "  process - Process current data once"
        exit 1
        ;;
esac
