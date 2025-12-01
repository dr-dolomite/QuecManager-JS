#!/bin/sh

# Auth Token Verification Script
# Checks if the provided auth token is still valid on the backend

echo "Content-type: application/json"
echo ""

AUTH_FILE="/tmp/quecmanager/auth_success"
TOKEN="${HTTP_AUTHORIZATION}"

# Check if token is provided
if [ -z "$TOKEN" ]; then
    echo '{"state":"invalid", "message":"No token provided"}'
    exit 0
fi

# Check if auth file exists (it won't after a reboot)
if [ ! -f "$AUTH_FILE" ]; then
    echo '{"state":"invalid", "message":"Auth file not found"}'
    exit 0
fi

# Check if token exists in auth file
if grep -q "$TOKEN" "$AUTH_FILE" 2>/dev/null; then
    echo '{"state":"valid", "message":"Token is valid"}'
else
    echo '{"state":"invalid", "message":"Token not found"}'
fi

exit 0
