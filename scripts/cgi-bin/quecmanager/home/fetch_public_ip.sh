#!/bin/sh

# Path: /www/cgi-bin/quecmanager

# Set content type to JSON
echo "Content-Type: application/json"
echo ""

# Check for internet connectivity by pinging 8.8.8.8 twice
ping -c 2 8.8.8.8 >/dev/null 2>&1

# If ping fails, return error immediately
if [ $? -ne 0 ]; then
  echo '{"error": "Failed to fetch public IP"}'
  exit 1
fi

# Fetch public IP using multiple fallback methods
PUBLIC_IP=$(
  curl -s https://api.ipify.org 2>/dev/null || \
  wget -qO- https://api.ipify.org 2>/dev/null || \
  uclient-fetch -qO- https://api.ipify.org 2>/dev/null
)

# Handle errors
if [ -z "$PUBLIC_IP" ]; then
  echo '{"error": "Failed to fetch public IP"}'
  exit 1
fi

# Return JSON response
echo "{\"public_ip\": \"$PUBLIC_IP\"}"