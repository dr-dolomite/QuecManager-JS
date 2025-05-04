#!/bin/sh

SPEEDTEST=false
FIRMWARE_VERSION=$(sms_tool at -t 3 'AT+QGMR' | sed -n '2p' | tr -d '\r')
MODEM_TYPE=$(sms_tool at -t 3 'AT+CGMM' | sed -n '2p' | tr -d '\r')
MODEM_MANUFACTURER=$(sms_tool at -t 3 'AT+CGMI' | sed -n '2p' | tr -d '\r')

if [ command -v speedtest >/dev/null 2>&1 ]; then
    SPEEDTEST=true
fi

RESPONSE="Content-Type: application/json\n"
RESPONSE="${RESPONSE}Cache-Control: no-cache, no-store, must-revalidate\n"
RESPONSE="${RESPONSE}Pragma: no-cache\n"
RESPONSE="${RESPONSE}Expires: 0\n\n"
RESPONSE="${RESPONSE}{\n"
RESPONSE="${RESPONSE}  \"speedtest\": ${SPEEDTEST},\n"
RESPONSE="${RESPONSE}  \"firmware\": \"${FIRMWARE_VERSION}\",\n"
RESPONSE="${RESPONSE}  \"modem\": \"${MODEM_TYPE}\",\n"
RESPONSE="${RESPONSE}  \"manufacturer\": \"${MODEM_MANUFACTURER}\"\n"
RESPONSE="${RESPONSE}}\n"

echo -e "${RESPONSE}"