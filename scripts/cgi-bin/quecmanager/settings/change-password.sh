#!/bin/sh

# Set Content-Type for CGI script
echo "Content-type: application/json"
echo ""

TOKEN="${HTTP_AUTHORIZATION}"

# Read POST data
read -r POST_DATA

# Debug log for generated hash
DEBUG_LOG="/tmp/password_change.log"
AUTH_FILE="/tmp/auth_success"

# Get Token from Authorization Header on Request
if [ ! -f $AUTH_FILE  ]; then
    echo "{\"error\":\"Unauthenticated Request\"}"
    exit 1
fi

if [ -z "$TOKEN" ] || "${TOKEN}" = "" || [ $(grep "${TOKEN}" "${AUTH_FILE}" | wc -l) -eq 0 ]; then
    echo "{\"response\": { \"status\": \"error\", \"raw_output\": \"Not Authorized\" }, \"command\": {\"timestamp\": \"$(date +%Y%m%d'T'%H%M%S)\"}, \"error\":\"Not Authorized\"}"
    exit 1
fi

# Check if token is within 2 hours
TOKEN_LINE=$(grep "${TOKEN}" "${AUTH_FILE}")
TOKEN_DATE=$(echo "$TOKEN_LINE" | awk '{print $1}' | sed 's/T/ /')
TOKEN_TIME=$(date -d "$TOKEN_DATE" +%s 2>/dev/null)
NOW_TIME=$(date +%s)
MAX_AGE=$((2 * 3600)) # 2 hours in seconds

if [ -z "$TOKEN_TIME" ] || [ $((NOW_TIME - TOKEN_TIME)) -gt $MAX_AGE ]; then
    echo "{ \"response\": { \"status\": \"error\", \"raw_output\": \"Token expired. Reauthenticate to get new token.\" }, \"command\": {\"timestamp\": \"$(date +%Y%m%d'T'%H%M%S)\"}, \"error\":\"Token expired\"}" 
    # Cleanup/Remove token from file
    sed -i -e "s/.*${TOKEN}.*//g" /tmp/auth_success 2>/dev/null
    exit 1
fi


# Extract the passwords from POST data (URL encoded)
USER="root"
OLD_PASSWORD=$(echo "$POST_DATA" | grep -o 'oldPassword=[^&]*' | cut -d= -f2-)
NEW_PASSWORD=$(echo "$POST_DATA" | grep -o 'newPassword=[^&]*' | cut -d= -f2-)

# URL-decode the passwords (replace + with space and decode %XX)
urldecode() {
    local encoded="${1//+/ }"
    printf '%b' "${encoded//%/\\x}"
}

OLD_PASSWORD=$(urldecode "$OLD_PASSWORD")
NEW_PASSWORD=$(urldecode "$NEW_PASSWORD")

# Basic validation to reject & and $ characters
if echo "$OLD_PASSWORD$NEW_PASSWORD" | grep -q '[&$]'; then
    echo '{"state":"failed","message":"Password contains forbidden characters (& or $)"}'
    exit 1
fi

# Extract the hashed password from /etc/shadow for the specified user
USER_SHADOW_ENTRY=$(grep "^$USER:" /etc/shadow)

if [ -z "$USER_SHADOW_ENTRY" ]; then
    echo '{"state":"failed","message":"User not found"}'
    exit 1
fi

# Extract the password hash (second field, colon-separated)
USER_HASH=$(echo "$USER_SHADOW_ENTRY" | cut -d: -f2)

# Extract the salt (MD5 uses the $1$ prefix followed by the salt)
SALT=$(echo "$USER_HASH" | cut -d'$' -f3)

# Generate hash from old password using the same salt
OLD_GENERATED_HASH=$(printf '%s' "$OLD_PASSWORD" | openssl passwd -1 -salt "$SALT" -stdin)

# Verify old password
if [ "$OLD_GENERATED_HASH" != "$USER_HASH" ]; then
    echo '{"state":"failed","message":"Current password is incorrect"}'
    exit 1
fi

# Create a temporary file for the new password
PASS_FILE=$(mktemp)
chmod 600 "$PASS_FILE"

# Write the new password twice (for confirmation)
printf '%s\n%s\n' "$NEW_PASSWORD" "$NEW_PASSWORD" > "$PASS_FILE"

# Change password using passwd command
ERROR_OUTPUT=$(passwd "$USER" < "$PASS_FILE" 2>&1)
RESULT=$?

# Log the operation
echo "Password change attempt. Result: $RESULT. Time: $(date)" >> "$DEBUG_LOG"
if [ $RESULT -ne 0 ]; then
    echo "Error output: $ERROR_OUTPUT" >> "$DEBUG_LOG"
fi

# Clean up
rm -f "$PASS_FILE"

# Return result
if [ $RESULT -eq 0 ]; then
    echo '{"state":"success","message":"Password changed successfully"}'
else
    echo '{"state":"failed","message":"Failed to change password"}'
fi