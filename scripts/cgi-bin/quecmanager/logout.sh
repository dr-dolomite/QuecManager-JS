#!/bin/sh
# Get token from Request Header Authorization
USER_TOKEN="${HTTP_AUTHORIZATION}"
# Remove token from file
sed -i -e "s/.*${USER_TOKEN}.*//g" /tmp/auth_success 2>/dev/null
# Remove extra empty lines
sed -i '/^\s*$/d' /tmp/auth_success 2>/dev/null


echo "Content-Type: application/json"
echo "Cache-Control: no-cache, no-store, must-revalidate"
echo "Pragma: no-cache"
echo "Expires: 0"
echo ""



echo '{"state":"success", "message":"Logged out successfully"}'