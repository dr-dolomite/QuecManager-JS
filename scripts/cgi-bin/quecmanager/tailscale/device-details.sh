#!/bin/sh

# Tailscale Device Details Fetcher
# Fetches current device information from tailscale status --json

echo "Content-type: application/json"
echo ""

# Check if tailscale command is available
if ! command -v tailscale >/dev/null 2>&1; then
    echo '{"status":"error","message":"Tailscale command not found","error":"Tailscale is not installed or not in PATH"}'
    exit 1
fi

# Create temp file for JSON output
temp_json="/tmp/tailscale_status_$$.json"

# Run tailscale status --json and save to temp file
tailscale status --json > "$temp_json" 2>&1

# Check if command succeeded
if [ $? -ne 0 ]; then
    rm -f "$temp_json"
    echo '{"status":"error","message":"Failed to fetch device details","error":"Could not execute tailscale status --json"}'
    exit 1
fi

# Check if temp file exists and has content
if [ ! -f "$temp_json" ] || [ ! -s "$temp_json" ]; then
    rm -f "$temp_json"
    echo '{"status":"error","message":"Failed to fetch device details","error":"No data returned from tailscale"}'
    exit 1
fi

# Extract device information using grep and sed
hostname=$(grep '"HostName"' "$temp_json" | head -1 | sed -n 's/.*"HostName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
tailscale_ip=$(grep '"TailscaleIPs"' "$temp_json" -A 2 | grep '100\.' | head -1 | sed -n 's/.*"\(100\.[0-9.]*\)".*/\1/p')
dns_name=$(grep '"DNSName"' "$temp_json" | head -1 | sed -n 's/.*"DNSName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | sed 's/\.$//')
relay=$(grep '"Relay"' "$temp_json" | head -1 | sed -n 's/.*"Relay"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
backend_state=$(grep '"BackendState"' "$temp_json" | sed -n 's/.*"BackendState"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
online=$(grep '"Online"' "$temp_json" | head -1 | sed -n 's/.*"Online"[[:space:]]*:[[:space:]]*\([^,}]*\).*/\1/p')
key_expiry=$(grep '"KeyExpiry"' "$temp_json" | head -1 | sed -n 's/.*"KeyExpiry"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

# Extract network information
tailnet_name=$(grep '"CurrentTailnet"' "$temp_json" -A 5 | grep '"Name"' | sed -n 's/.*"Name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
magic_dns=$(grep '"MagicDNSEnabled"' "$temp_json" | sed -n 's/.*"MagicDNSEnabled"[[:space:]]*:[[:space:]]*\([^,}]*\).*/\1/p')

# Count peers - count all HostName occurrences minus the Self entry
total_peers=$(grep -c '"HostName"' "$temp_json")
total_peers=$((total_peers - 1))
if [ $total_peers -lt 0 ]; then
    total_peers=0
fi

# Count online peers
online_peers=$(grep -c '"Online"[[:space:]]*:[[:space:]]*true' "$temp_json")
if [ -z "$online_peers" ]; then
    online_peers=0
fi

# Set defaults for empty values
[ -z "$hostname" ] && hostname="Unknown"
[ -z "$tailscale_ip" ] && tailscale_ip="N/A"
[ -z "$dns_name" ] && dns_name="N/A"
[ -z "$relay" ] && relay="direct"
[ -z "$backend_state" ] && backend_state="Unknown"
[ -z "$key_expiry" ] && key_expiry=""

# Ensure boolean values are valid
if [ "$online" = "true" ]; then
    online="true"
else
    online="false"
fi

if [ "$magic_dns" = "true" ]; then
    magic_dns="true"
else
    magic_dns="false"
fi

# Clean up temp file
rm -f "$temp_json"

# Build and output JSON response
cat <<EOF
{
  "status": "success",
  "device": {
    "hostname": "$hostname",
    "tailscale_ip": "$tailscale_ip",
    "dns_name": "$dns_name",
    "relay": "$relay",
    "backend_state": "$backend_state",
    "online": $online,
    "key_expiry": "$key_expiry"
  },
  "network": {
    "tailnet_name": "$tailnet_name",
    "magic_dns_enabled": $magic_dns,
    "total_peers": $total_peers,
    "online_peers": $online_peers
  },
  "message": "Successfully fetched device details"
}
EOF

