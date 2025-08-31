#!/bin/sh

# Remove token from file
AUTH_RESPONSE=$(./auth-token.sh removeToken "${HTTP_AUTHORIZATION}")
EXIT_CODE=$?

echo "Content-Type: application/json"
echo "Cache-Control: no-cache, no-store, must-revalidate"
echo "Pragma: no-cache"
echo "Expires: 0"
echo ""



echo $AUTH_RESPONSE
exit $EXIT_CODE