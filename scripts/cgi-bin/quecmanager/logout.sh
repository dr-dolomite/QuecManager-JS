#!/bin/sh
# Get token from Request Header Authorization
USER_TOKEN="${HTTP_AUTHORIZATION}"
# Remove token from file
sed -i -e "s/.*${USER_TOKEN}.*//g" /tmp/auth_success 2>/dev/null
# Remove extra empty lines


echo "Content-Type: application/json"
echo "Cache-Control: no-cache, no-store, must-revalidate"
echo "Pragma: no-cache"
echo "Expires: 0"
echo ""


sed -i -e ":a;N;$!ba;s/\n//g" /tmp/auth_success 2>/dev/null

echo '{"state":"success", "message":"Logged out successfully"}'