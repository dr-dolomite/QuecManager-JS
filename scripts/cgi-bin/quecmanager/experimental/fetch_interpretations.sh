#!/bin/sh
# Simple script to fetch interpreted QCAINFO results

INTERPRETED_FILE="/tmp/interpreted_result.json"

# Set content type for JSON
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Check if file exists
if [ ! -f "$INTERPRETED_FILE" ]; then
    echo "[]"
    exit 0
fi

# Return the JSON content
cat "$INTERPRETED_FILE"
