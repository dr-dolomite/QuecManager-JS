#!/bin/sh

# Tailscale Peers Fetcher
# Fetches and parses the list of Tailscale peers

echo "Content-type: application/json"
echo ""

# Check if tailscale command is available
if ! command -v tailscale >/dev/null 2>&1; then
    echo '{"status":"error","peers":[],"total":0,"online":0,"offline":0,"message":"Tailscale command not found","error":"Tailscale is not installed or not in PATH"}'
    exit 0
fi

# Run tailscale status and capture output
ts_status=$(tailscale status 2>&1)

# Check if logged out
if echo "$ts_status" | grep -q "Logged out"; then
    echo '{"status":"error","peers":[],"total":0,"online":0,"offline":0,"message":"Not authenticated","error":"Device is not authenticated with Tailscale"}'
    exit 0
fi

# Create temp file to store parsed peers
temp_file="/tmp/tailscale_peers_$$.json"
> "$temp_file"

# Initialize counters
total_peers=0
online_peers=0
offline_peers=0

# Parse each line of tailscale status output
# Save to temp file first to avoid subshell issues with pipes
echo "$ts_status" > "/tmp/tailscale_status_$$.txt"

while IFS= read -r line; do
    # Skip empty lines and health check lines
    if [ -z "$line" ] || echo "$line" | grep -q "^#"; then
        continue
    fi
    
    # Parse peer line format: IP HOSTNAME USER OS STATUS [additional info]
    ip=$(echo "$line" | awk '{print $1}')
    hostname=$(echo "$line" | awk '{print $2}')
    user=$(echo "$line" | awk '{print $3}')
    os=$(echo "$line" | awk '{print $4}')
    status_flag=$(echo "$line" | awk '{print $5}')
    
    # Skip if IP doesn't look valid (basic check for 100.x.x.x pattern)
    if ! echo "$ip" | grep -q "^100\."; then
        continue
    fi
    
    # Remove @ symbol from user and handle empty user
    user=$(echo "$user" | sed 's/@//g')
    if [ -z "$user" ]; then
        user="unknown"
    fi
    
    # Handle empty hostname
    if [ -z "$hostname" ] || [ "$hostname" = "-" ]; then
        hostname="unknown"
    fi
    
    # Handle empty OS
    if [ -z "$os" ] || [ "$os" = "-" ]; then
        os="unknown"
    fi
    
    # Determine online/offline status
    # "-" means online/active, "offline" in status_flag means offline
    if echo "$line" | grep -q "offline"; then
        peer_status="offline"
    else
        peer_status="online"
    fi
    
    # Escape any quotes in the values to prevent JSON issues
    hostname=$(echo "$hostname" | sed 's/"/\\"/g')
    user=$(echo "$user" | sed 's/"/\\"/g')
    
    # Output peer JSON object to temp file
    echo "{\"ip\":\"$ip\",\"hostname\":\"$hostname\",\"user\":\"$user\",\"os\":\"$os\",\"status\":\"$peer_status\"}" >> "$temp_file"
done < "/tmp/tailscale_status_$$.txt"

# Clean up status temp file
rm -f "/tmp/tailscale_status_$$.txt"

# Count peers and online/offline status
if [ -f "$temp_file" ]; then
    total_peers=$(wc -l < "$temp_file" | tr -d ' ')
    online_peers=$(grep -c '"status":"online"' "$temp_file" 2>/dev/null || echo "0")
    offline_peers=$(grep -c '"status":"offline"' "$temp_file" 2>/dev/null || echo "0")
fi

# Build final JSON response
echo -n '{"status":"success","peers":['

# Output peers from temp file with comma separation
first_peer=true
if [ -f "$temp_file" ] && [ -s "$temp_file" ]; then
    while IFS= read -r peer_json; do
        if [ "$first_peer" = true ]; then
            first_peer=false
        else
            echo -n ","
        fi
        echo -n "$peer_json"
    done < "$temp_file"
fi

# Close peers array and add metadata
echo -n "],"
echo -n "\"total\":$total_peers,"
echo -n "\"online\":$online_peers,"
echo -n "\"offline\":$offline_peers,"
echo "\"message\":\"Successfully fetched $total_peers peer(s)\"}"

# Clean up temp file
rm -f "$temp_file"

exit 0
