#!/bin/sh
echo "Content-Type: text/event-stream"
echo "Cache-Control: no-cache"
echo "Connection: keep-alive"
echo ""

cat /tmp/realtime_spd.json