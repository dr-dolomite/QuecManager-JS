#!/bin/sh

AUTH_FILE="/tmp/auth_success"
MAX_AGE=$((2 * 3600)) # 2 hours in seconds
NOW_TIME=$(date +%s)

if $1; then
    TOKEN=$1
else
    TOKEN=$(head -c 16 /dev/urandom | hexdump -v -e '/1 "%02x"')
    CREATED_DATE=$(date +"%Y-%m-%dT%H:%M:%S")
    touch ${AUTH_FILE}
    echo "${CREATED_DATE} ${TOKEN}" >> ${AUTH_FILE}
    echo "" >> ${AUTH_FILE}
fi

if ! -f $AUTH_FILE; then
    echo '{"state":"failed", "message":"Authentication file not found"}'
    EXIT_CODE=2
fi

if [ -z "$TOKEN" ] || "${TOKEN}" = "" || [ $(grep "${TOKEN}" "${AUTH_FILE}" | wc -l) -eq 0 ]; then
    echo "{\"response\": { \"status\": \"error\", \"raw_output\": \"Not Authorized\" }, \"command\": {\"timestamp\": \"$(date +%Y%m%d'T'%H%M%S)\"}, \"error\":\"Not Authorized\"}"
    EXIT_CODE=1
fi


if grep -q $TOKEN $AUTH_FILE; then
    echo "{\"state\":\"success\", \"token\":\"$TOKEN\"}"
    EXIT_CODE=0
fi



TMP_FILE=$(mktemp)
# AUTH_FILE cleanup process, Remove any token lines older than 2 hours from AUTH_FILE
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

exit $EXIT_CODE