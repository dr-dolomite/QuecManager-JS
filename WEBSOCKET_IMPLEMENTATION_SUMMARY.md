# Server Client
#!/bin/sh

INTERFACE="rmnet_data0"  # Change to your interface
#INTERFACE="br-lan"
#INTERFACE=eth0
while true; do
    RX_BYTES=$(cat /sys/class/net/$INTERFACE/statistics/rx_bytes)
    TX_BYTES=$(cat /sys/class/net/$INTERFACE/statistics/tx_bytes)

    sleep 1

    RX_BYTES_NEW=$(cat /sys/class/net/$INTERFACE/statistics/rx_bytes)
    TX_BYTES_NEW=$(cat /sys/class/net/$INTERFACE/statistics/tx_bytes)

    RX_RATE=$((($RX_BYTES_NEW - $RX_BYTES)))  # Kbps
    TX_RATE=$((($TX_BYTES_NEW - $TX_BYTES)))  # Kbps

    #printf "Download: %d | Upload: %d \r" $RX_RATE $TX_RATE
    printf "Upload: %d | Download: %d \r" $RX_RATE $TX_RATE
    #echo "{ \"type\": \"bandwidth\", \"data\": {\"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"upload\": ${RX_RATE}, \"download\": ${TX_RATE} }}" | websocat --one-message ws://localhost:8838/traffic-monitor
    echo "{ \"type\": \"bandwidth\", \"data\": {\"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"upload\": ${TX_RATE}, \"download\": ${RX_RATE} }}" | websocat --one-message ws://localhost:8838/traffic-monitor

    RX_BYTES=$RX_BYTES_NEW
    TX_BYTES=$TX_BYTES_NEW
done


# Server
websocat -t -E ws-l:0.0.0.0:8838 log:broadcast:mirror: &>/tmp/websocat