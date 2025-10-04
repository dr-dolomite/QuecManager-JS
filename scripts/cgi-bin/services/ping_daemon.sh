#!/bin/sh

set -eu

# Ensure PATH for OpenWrt/BusyBox
export PATH="/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

TMP_DIR="/tmp/quecmanager"
OUT_JSON="$TMP_DIR/ping_latency.json"
PID_FILE="$TMP_DIR/ping_daemon.pid"
DEFAULT_HOST="8.8.8.8"
DEFAULT_INTERVAL=5
SCRIPT_NAME="ping_daemon"
UCI_CONFIG="quecmanager"

ensure_tmp_dir() { [ -d "$TMP_DIR" ] || mkdir -p "$TMP_DIR" || exit 1; }

log() {
  qm_log_info "daemon" "$SCRIPT_NAME" "$1"
}

daemon_is_running() {
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      # Avoid false positive if PID reused
      if [ -r "/proc/$pid/cmdline" ] && grep -q "ping_daemon.sh" "/proc/$pid/cmdline" 2>/dev/null; then
        return 0 
      else
        rm -f "$PID_FILE" 2>/dev/null || true
      fi
    fi
  fi
  return 1
}

write_pid() { echo "$$" > "$PID_FILE"; }

cleanup() { rm -f "$PID_FILE" 2>/dev/null || true; }

# Initialize UCI config if it doesn't exist
init_uci_config() {
  if ! uci get "$UCI_CONFIG.ping_monitoring" >/dev/null 2>&1; then
    uci set "$UCI_CONFIG.ping_monitoring=ping_monitoring"
    uci set "$UCI_CONFIG.ping_monitoring.enabled=1"
    uci set "$UCI_CONFIG.ping_monitoring.host=$DEFAULT_HOST"
    uci set "$UCI_CONFIG.ping_monitoring.interval=$DEFAULT_INTERVAL"
    uci commit "$UCI_CONFIG"
    log "Initialized UCI ping monitoring config with defaults"
  fi
}

read_config() {
  ENABLED="true"; HOST="$DEFAULT_HOST"; INTERVAL="$DEFAULT_INTERVAL"
  
  # Initialize if needed
  init_uci_config
  
  # Read from UCI
  PING_ENABLED=$(uci get "$UCI_CONFIG.ping_monitoring.enabled" 2>/dev/null || echo "1")
  PING_HOST=$(uci get "$UCI_CONFIG.ping_monitoring.host" 2>/dev/null || echo "$DEFAULT_HOST")
  PING_INTERVAL=$(uci get "$UCI_CONFIG.ping_monitoring.interval" 2>/dev/null || echo "$DEFAULT_INTERVAL")
  
  # Normalize enabled flag
  case "${PING_ENABLED:-}" in 
    true|1|on|yes|enabled) ENABLED=true ;; 
    *) ENABLED=false ;; 
  esac
  
  # Set host
  [ -n "${PING_HOST:-}" ] && HOST="$PING_HOST"
  
  # Validate and set interval
  if echo "${PING_INTERVAL:-}" | grep -qE '^[0-9]+$'; then
    if [ "$PING_INTERVAL" -ge 1 ] && [ "$PING_INTERVAL" -le 3600 ]; then
      INTERVAL="$PING_INTERVAL"
    fi
  fi
}



write_json_atomic() {
  tmpfile="$(mktemp "$TMP_DIR/ping_latency.XXXXXX" 2>/dev/null || true)"
  if [ -n "${tmpfile:-}" ] && [ -w "$TMP_DIR" ]; then
    printf '%s' "$1" > "$tmpfile" 2>/dev/null || true
    mv -f "$tmpfile" "$OUT_JSON" 2>/dev/null || printf '%s' "$1" > "$OUT_JSON"
  else
    printf '%s' "$1" > "$OUT_JSON"
  fi
}

ensure_tmp_dir
log "Starting ping daemon"
if daemon_is_running; then log "Already running"; exit 0; fi

trap cleanup EXIT INT TERM 
write_pid

while true; do
  read_config
  if [ "$ENABLED" != "true" ]; then log "Disabled in config"; exit 0; fi
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  PING_BIN="$(command -v ping || echo /bin/ping)"
  output="$("$PING_BIN" -c 1 -w 2 "$HOST" 2>/dev/null || true)"
  if echo "$output" | grep -q "time="; then
    latency_ms="$(echo "$output" | grep -o 'time=[0-9.]*' | head -n1 | cut -d'=' -f2 | cut -d'.' -f1)"; [ -z "$latency_ms" ] && latency_ms=0
    json="{\"timestamp\":\"$ts\",\"host\":\"$HOST\",\"latency\":$latency_ms,\"ok\":true}"
  else
    json="{\"timestamp\":\"$ts\",\"host\":\"$HOST\",\"latency\":null,\"ok\":false}"
  fi
  write_json_atomic "$json"
  log "Wrote: $json"
  sleep "$INTERVAL"
done
