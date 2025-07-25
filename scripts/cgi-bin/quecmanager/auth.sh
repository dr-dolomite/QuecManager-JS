#!/bin/sh

# Set Content-Type for CGI script
echo "Content-type: application/json"
echo ""

# Read POST data
read -r POST_DATA

# Debug log for generated hash
DEBUG_LOG="/tmp/auth.log"
AUTH_FILE="/tmp/auth_success"
# Extract the password from POST data (URL encoded)
USER="root"
INPUT_PASSWORD=$(echo "$POST_DATA" | grep -o 'password=[^&]*' | cut -d= -f2-)

# URL-decode the password while preserving most special characters
# First decode percent-encoded sequences
urldecode() {
    local encoded="${1//+/ }"
    printf '%b' "${encoded//%/\\x}"
}

# Decode the password
INPUT_PASSWORD=$(urldecode "$INPUT_PASSWORD")

# Basic validation to reject & and $ characters
if echo "$INPUT_PASSWORD" | grep -q '[&$]'; then
    echo '{"state":"failed", "message":"Password contains forbidden characters (& or $)"}'
    exit 1
fi

# Sanitize the password for shell usage
INPUT_PASSWORD=$(printf '%s' "$INPUT_PASSWORD" | sed 's/[\"]/\\&/g')

# Extract the hashed password from /etc/shadow for the specified user
USER_SHADOW_ENTRY=$(grep "^$USER:" /etc/shadow)

if [ -z "$USER_SHADOW_ENTRY" ]; then
    echo '{"state":"failed", "message":"User not found"}'
    exit 1
fi

# Extract the password hash (it's the second field, colon-separated)
USER_HASH=$(echo "$USER_SHADOW_ENTRY" | cut -d: -f2)

# Extract the salt (MD5 uses the $1$ prefix followed by the salt)
SALT=$(echo "$USER_HASH" | cut -d'$' -f3)

# Generate a hash from the input password using the same salt
# Use printf to avoid issues with special characters in echo
GENERATED_HASH=$(printf '%s' "$INPUT_PASSWORD" | openssl passwd -1 -salt "$SALT" -stdin)

# Log generated hash for debugging
printf "Generated hash: %s\n" "$GENERATED_HASH" >> "$DEBUG_LOG"

# Compare the generated hash with the one in the shadow file
if [ "$GENERATED_HASH" = "$USER_HASH" ]; then
    TOKEN=$(head -c 16 /dev/urandom | hexdump -v -e '/1 "%02x"')
    CREATED_DATE=$(date +"%Y-%m-%dT%H:%M:%S")
    touch ${AUTH_FILE}
    echo "${CREATED_DATE} ${TOKEN}" >> ${AUTH_FILE}
    echo "" >> ${AUTH_FILE}
    echo "{\"state\":\"success\",\"token\":\"${TOKEN}\"}"
else
    # Remove token from file
    if [ -n ${TOKEN} ]; then
        sed -i -e "s/.*${TOKEN}.*//g" ${AUTH_FILE} 2>/dev/null
    fi
    # Remove extra empty lines
    sed -i -e ":a;N;$!ba;s/\n//g" ${AUTH_FILE} 2>/dev/null
    echo '{"state":"failed", "message":"Authentication failed"}'
fi

# AUTH_FILE cleanup process, Remove any token lines older than 2 hours from AUTH_FILE
MAX_AGE=$((2 * 3600)) # 2 hours in seconds
NOW_TIME=$(date +%s)
TMP_FILE=$(mktemp)
while read -r line; do
    if [ -n "$(echo "$line" | tr -d '[:space:]')" ]; then
        # Extract the date from the line and convert it to a timestamp
        TOKEN_DATE=$(echo "$line" | awk '{print $1}' | sed 's/T/ /')
        TOKEN_TIME=$(date -d "$TOKEN_DATE" +%s 2>/dev/null)
        # If date is valid and not older than MAX_AGE, keep the line
        if [ -n "$TOKEN_TIME" ] && [ $((NOW_TIME - TOKEN_TIME)) -le $MAX_AGE ]; then
            echo "$line" >> "$TMP_FILE"
        fi
    fi
done < "$AUTH_FILE"

mv "$TMP_FILE" "$AUTH_FILE"