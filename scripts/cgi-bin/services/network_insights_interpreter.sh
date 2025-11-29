#!/bin/sh
# Network Insights Interpreter Service
# Monitors qcainfo.json and generates network event interpretations
# OpenWrt/BusyBox compatible version

# Source centralized logging
. "/www/cgi-bin/services/quecmanager_logger.sh"

# Configuration
QCAINFO_FILE="/www/signal_graphs/qcainfo.json"
SERVINGCELL_FILE="/www/signal_graphs/servingcell.json"
INTERPRETED_FILE="/tmp/interpreted_result.json"
LAST_ENTRY_FILE="/tmp/last_qcainfo_entry.json"
LAST_SERVINGCELL_ENTRY_FILE="/tmp/last_servingcell_entry.json"
QUECWATCH_EVENTS_FILE="/tmp/quecwatch_events.json"
LAST_QUECWATCH_ENTRY_FILE="/tmp/last_quecwatch_entry.json"
LOCKFILE="/tmp/network_interpreter.lock"
MAX_INTERPRETATIONS=50

# Logging configuration
LOG_CATEGORY="services"
SCRIPT_NAME="network_insights_interpreter"

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

# Parse servingcell output to extract PCI information for SA mode
parse_servingcell_pci() {
    local output="$1"
    
    # Clean up the output
    local clean_output=$(echo "$output" | tr -d '\r' | sed 's/\\r//g; s/\\n/\n/g')
    
    # Extract PCI from servingcell for different modes
    # SA mode: +QENG: "servingcell","NOCONN","NR5G-SA","FDD",<freq>,<band>,<earfcn>,<PCI>,...
    # NSA mode might also have useful PCI info in servingcell
    
    local pci=""
    
    # Try to extract PCI from NR5G-SA format first
    pci=$(echo "$clean_output" | grep '+QENG: "servingcell"' | grep 'NR5G-SA' | sed -n 's/.*+QENG: "servingcell","[^"]*","NR5G-SA","[^"]*",[^,]*,[^,]*,[^,]*,\([0-9]*\).*/\1/p' | head -1)
    
    # If no SA PCI found, try LTE format (for fallback)
    if [ -z "$pci" ]; then
        pci=$(echo "$clean_output" | grep '+QENG: "servingcell"' | grep 'LTE' | sed -n 's/.*+QENG: "servingcell","[^"]*","LTE","[^"]*",[^,]*,[^,]*,[^,]*,\([0-9]*\).*/\1/p' | head -1)
    fi
    
    if [ -n "$pci" ]; then
        echo "PCC:$pci"
    fi
}

# Determine network mode from QCAINFO bands with enhanced SA detection
determine_network_mode() {
    local qcainfo_output="$1"
    local servingcell_output="$2"
    
    # First check servingcell for explicit SA indication
    if echo "$servingcell_output" | grep -q 'NR5G-SA'; then
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "SA mode detected from servingcell output"
        echo "SA"
        return
    fi
    
    # Fall back to band-based detection from QCAINFO
    local bands=$(parse_qcainfo_bands "$qcainfo_output")
    local has_lte=false
    local has_nr5g=false
    
    if echo "$bands" | grep -q "LTE:"; then
        has_lte=true
    fi
    if echo "$bands" | grep -q "NR5G:"; then
        has_nr5g=true
    fi
    
    if [ "$has_lte" = true ] && [ "$has_nr5g" = true ]; then
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "NSA mode detected from band combination: LTE + NR5G"
        echo "NSA"
    elif [ "$has_lte" = true ]; then
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "LTE mode detected from bands"
        echo "LTE"
    elif [ "$has_nr5g" = true ]; then
        # If only NR5G bands are present, it's likely SA
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "SA mode detected from NR5G-only bands"
        echo "SA"
    else
        echo "NO_SIGNAL"
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

# Get network mode from bands (legacy function - kept for compatibility)
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

# Compare two band configurations and generate interpretation with SA support
compare_configurations() {
    local base_qcainfo_output="$1"
    local new_qcainfo_output="$2"
    local base_servingcell_output="$3"
    local new_servingcell_output="$4"
    local base_datetime="$5"
    local new_datetime="$6"
    
    # Parse both configurations
    local base_bands=$(parse_qcainfo_bands "$base_qcainfo_output")
    local new_bands=$(parse_qcainfo_bands "$new_qcainfo_output")
    
    # Determine network modes with enhanced detection
    local base_mode=$(determine_network_mode "$base_qcainfo_output" "$base_servingcell_output")
    local new_mode=$(determine_network_mode "$new_qcainfo_output" "$new_servingcell_output")
    
    # Get PCI information based on network mode
    local base_pci_list=""
    local new_pci_list=""
    
    if [ "$base_mode" = "SA" ]; then
        base_pci_list=$(parse_servingcell_pci "$base_servingcell_output")
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Base SA mode - using servingcell PCI: $base_pci_list"
    else
        base_pci_list=$(parse_qcainfo_pci "$base_qcainfo_output")
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Base $base_mode mode - using qcainfo PCI: $base_pci_list"
    fi
    
    if [ "$new_mode" = "SA" ]; then
        new_pci_list=$(parse_servingcell_pci "$new_servingcell_output")
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "New SA mode - using servingcell PCI: $new_pci_list"
    else
        new_pci_list=$(parse_qcainfo_pci "$new_qcainfo_output")
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "New $new_mode mode - using qcainfo PCI: $new_pci_list"
    fi
    
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
        
        # PCI changes - Check even when band configuration is the same (Network Event)
        local pci_interpretation=$(compare_pci_configurations "$base_pci_list" "$new_pci_list")
        if [ -n "$pci_interpretation" ]; then
            if [ -n "$interpretations" ]; then
                interpretations="$interpretations; "
            fi
            # Mark PCI changes as Network Events for better classification
            interpretations="${interpretations}[Network Event] $pci_interpretation"
        fi
    fi
    
    # Return interpretation if any changes detected
    if [ -n "$interpretations" ]; then
        echo "$interpretations"
    fi
}

# Add interpretation to JSON file with event type classification
add_interpretation() {
    local datetime="$1"
    local interpretation="$2"
    local event_type="${3:-Configuration Change}"
    
    # Determine event type based on interpretation content if not provided
    if [ "$event_type" = "Configuration Change" ]; then
        if echo "$interpretation" | grep -q "\[Network Event\]"; then
            event_type="Network Event"
            # Remove the event type prefix from the interpretation text
            interpretation=$(echo "$interpretation" | sed 's/\[Network Event\] //')
        fi
    fi
    
    # Initialize file if it doesn't exist
    if [ ! -f "$INTERPRETED_FILE" ]; then
        echo "[]" > "$INTERPRETED_FILE"
    fi
    
    # Add new interpretation using jq with event type
    local temp_file="${INTERPRETED_FILE}.tmp.$$"
    jq --arg dt "$datetime" \
       --arg interp "$interpretation" \
       --arg type "$event_type" \
       '. + [{"datetime": $dt, "interpretation": $interp, "eventType": $type}] | .[-'"$MAX_INTERPRETATIONS"':]' \
       "$INTERPRETED_FILE" > "$temp_file" 2>/dev/null && mv "$temp_file" "$INTERPRETED_FILE"
    
    chmod 644 "$INTERPRETED_FILE"
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Added interpretation ($event_type): $interpretation"
}

# Get corresponding servingcell entry by datetime
get_servingcell_entry_by_datetime() {
    local target_datetime="$1"
    
    if [ ! -f "$SERVINGCELL_FILE" ]; then
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Servingcell file not found: $SERVINGCELL_FILE"
        echo ""
        return
    fi
    
    # Find servingcell entry with closest datetime (within 2 minutes range)
    # First try exact match, then closest within reasonable timeframe
    local exact_match=$(jq -r --arg target "$target_datetime" '
        map(select(.datetime == $target)) | first // empty
    ' "$SERVINGCELL_FILE" 2>/dev/null)
    
    if [ -n "$exact_match" ] && [ "$exact_match" != "null" ]; then
        echo "$exact_match"
        return
    fi
    
    # If no exact match, find closest entry within 2 minutes
    jq -r --arg target "$target_datetime" '
        map(select(.datetime)) | 
        map(select(
            (.datetime <= $target) and 
            (($target | gsub("-|:| "; "") | tonumber) - 
             (.datetime | gsub("-|:| "; "") | tonumber)) < 200
        )) | 
        sort_by(.datetime) | 
        last // empty
    ' "$SERVINGCELL_FILE" 2>/dev/null || echo ""
}

# Process Quecwatch events and add them to interpretations
process_quecwatch_events() {
    if [ ! -f "$QUECWATCH_EVENTS_FILE" ]; then
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Quecwatch events file not found: $QUECWATCH_EVENTS_FILE"
        return 0
    fi
    
    # Get total number of events
    local total_events=$(jq 'length' "$QUECWATCH_EVENTS_FILE" 2>/dev/null || echo "0")
    
    if [ "$total_events" -eq 0 ]; then
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "No Quecwatch events to process"
        return 0
    fi
    
    # Get the last processed event datetime
    local last_processed=""
    if [ -f "$LAST_QUECWATCH_ENTRY_FILE" ]; then
        last_processed=$(cat "$LAST_QUECWATCH_ENTRY_FILE" 2>/dev/null)
    fi
    
    # Process each event
    local i=0
    while [ "$i" -lt "$total_events" ]; do
        local event=$(jq -r ".[$i]" "$QUECWATCH_EVENTS_FILE" 2>/dev/null)
        local event_datetime=$(echo "$event" | jq -r '.datetime' 2>/dev/null)
        local event_action=$(echo "$event" | jq -r '.action' 2>/dev/null)
        local event_reason=$(echo "$event" | jq -r '.reason' 2>/dev/null)
        local event_latency=$(echo "$event" | jq -r '.latency' 2>/dev/null)
        
        # Skip if already processed
        if [ -n "$last_processed" ] && [ "$event_datetime" = "$last_processed" ]; then
            i=$((i + 1))
            continue
        fi
        
        # Only process events after the last processed one
        if [ -n "$last_processed" ]; then
            if ! is_datetime_newer "$event_datetime" "$last_processed"; then
                i=$((i + 1))
                continue
            fi
        fi
        
        # Build interpretation message
        local interpretation="QuecWatch: $event_action - $event_reason"
        if [ -n "$event_latency" ] && [ "$event_latency" != "null" ]; then
            interpretation="$interpretation (Latency: ${event_latency}ms)"
        fi
        
        # Add to interpretations with QuecWatch Action event type
        add_interpretation "$event_datetime" "$interpretation" "QuecWatch Action"
        
        i=$((i + 1))
    done
    
    # Update last processed event
    if [ "$total_events" -gt 0 ]; then
        local last_datetime=$(jq -r '.[-1].datetime' "$QUECWATCH_EVENTS_FILE" 2>/dev/null)
        echo "$last_datetime" > "$LAST_QUECWATCH_ENTRY_FILE"
    fi
}

# Process QCAINFO entries and generate interpretations with servingcell support
process_qcainfo_data() {
    if [ ! -f "$QCAINFO_FILE" ]; then
        qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "QCAINFO file not found: $QCAINFO_FILE"
        return 1
    fi
    
    # Get total number of entries
    local total_entries=$(jq 'length' "$QCAINFO_FILE" 2>/dev/null || echo "0")
    
    if [ "$total_entries" -lt 2 ]; then
        qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Not enough entries to compare ($total_entries)"
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
        local base_qcainfo_output=$(echo "$base_entry" | jq -r '.output' 2>/dev/null)
        local next_qcainfo_output=$(echo "$next_entry" | jq -r '.output' 2>/dev/null)
        
        # Get corresponding servingcell entries
        local base_servingcell_entry=$(get_servingcell_entry_by_datetime "$base_datetime")
        local next_servingcell_entry=$(get_servingcell_entry_by_datetime "$next_datetime")
        
        local base_servingcell_output=""
        local next_servingcell_output=""
        
        if [ -n "$base_servingcell_entry" ]; then
            base_servingcell_output=$(echo "$base_servingcell_entry" | jq -r '.output' 2>/dev/null)
            qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Found servingcell data for base datetime: $base_datetime"
        else
            qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "No servingcell data found for base datetime: $base_datetime"
        fi
        
        if [ -n "$next_servingcell_entry" ]; then
            next_servingcell_output=$(echo "$next_servingcell_entry" | jq -r '.output' 2>/dev/null)
            qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "Found servingcell data for next datetime: $next_datetime"
        else
            qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "No servingcell data found for next datetime: $next_datetime"
        fi
        
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
        local interpretation=$(compare_configurations "$base_qcainfo_output" "$next_qcainfo_output" "$base_servingcell_output" "$next_servingcell_output" "$base_datetime" "$next_datetime")
        
        if [ -n "$interpretation" ]; then
            add_interpretation "$next_datetime" "$interpretation"
        else
            qm_log_debug "$LOG_CATEGORY" "$SCRIPT_NAME" "No configuration changes detected between $base_datetime and $next_datetime"
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
    qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Starting network insights interpreter monitoring"
    
    while true; do
        # Acquire lock (OpenWrt compatible)
        if (set -C; echo $$ > "$LOCKFILE") 2>/dev/null; then
            trap 'rm -f "$LOCKFILE"; exit' INT TERM EXIT
            
            # Process network configuration changes
            process_qcainfo_data
            
            # Process Quecwatch events
            process_quecwatch_events
            
            # Release lock
            rm -f "$LOCKFILE"
            trap - INT TERM EXIT
        else
            qm_log_warn "$LOG_CATEGORY" "$SCRIPT_NAME" "Another instance is running, skipping this cycle"
        fi
        
        sleep 61
    done
}

# Main execution
case "${1:-monitor}" in
    "monitor")
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Starting in monitor mode"
        monitor_qcainfo
        ;;
    "process")
        qm_log_info "$LOG_CATEGORY" "$SCRIPT_NAME" "Starting in process mode (single run)"
        process_qcainfo_data
        process_quecwatch_events
        ;;
    *)
        echo "Usage: $0 {monitor|process}"
        echo "  monitor - Run continuous monitoring (default)"
        echo "  process - Process current data once"
        qm_log_error "$LOG_CATEGORY" "$SCRIPT_NAME" "Invalid argument: $1"
        exit 1
        ;;
esac
