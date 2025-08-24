#!/bin/sh

set -eu

# Ensure PATH for OpenWrt/BusyBox
export PATH="/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

TMP_DIR="/tmp/quecmanager"
OUT_JSON="$TMP_DIR/ping_latency.json"
PID_FILE="$TMP_DIR/ping_daemon.pid"
LOG_FILE="$TMP_DIR/ping_daemon.log"
CONFIG_FILE="/etc/quecmanager/settings/ping_settings.conf"
[ -f "$CONFIG_FILE" ] || CONFIG_FILE="/tmp/quecmanager/settings/ping_settings.conf"
DEFAULT_HOST="8.8.8.8"
DEFAULT_INTERVAL=5

ensure_tmp_dir() { [ -d "$TMP_DIR" ] || mkdir -p "$TMP_DIR" || exit 1; }

log() {
  printf '%s - %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG_FILE" 2>/dev/null || true
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

read_config() {
  ENABLED="true"; HOST="$DEFAULT_HOST"; INTERVAL="$DEFAULT_INTERVAL"
  if [ -f "$CONFIG_FILE" ]; then
    PING_ENABLED=$(grep -E "^PING_ENABLED=" "$CONFIG_FILE" | tail -n1 | cut -d'=' -f2 | tr -d '\r') || true
    PING_HOST=$(grep -E "^PING_HOST=" "$CONFIG_FILE" | tail -n1 | cut -d'=' -f2 | tr -d '\r') || true
    PING_INTERVAL=$(grep -E "^PING_INTERVAL=" "$CONFIG_FILE" | tail -n1 | cut -d'=' -f2 | tr -d '\r') || true
    case "${PING_ENABLED:-}" in true|1|on|yes|enabled) ENABLED=true ;; *) ENABLED=false ;; esac
    [ -n "${PING_HOST:-}" ] && HOST="$PING_HOST"
    if echo "${PING_INTERVAL:-}" | grep -qE '^[0-9]+$'; then
      if [ "$PING_INTERVAL" -ge 1 ] && [ "$PING_INTERVAL" -le 3600 ]; then
        INTERVAL="$PING_INTERVAL"
      fi
    fi
  fi
}

# Create default config if none exists
create_default_config() {
  local primary_config="/etc/quecmanager/settings/ping_settings.conf"
  local fallback_config="/tmp/quecmanager/settings/ping_settings.conf"
  
  # Check if either config exists
  if [ -f "$primary_config" ] || [ -f "$fallback_config" ]; then
    return 0
  fi
  
  # Try to create in primary location first
  if mkdir -p "/etc/quecmanager/settings" 2>/dev/null; then
    {
      echo "PING_ENABLED=true"
      echo "PING_HOST=$DEFAULT_HOST"
      echo "PING_INTERVAL=$DEFAULT_INTERVAL"
    } > "$primary_config" 2>/dev/null && {
      chmod 644 "$primary_config" 2>/dev/null || true
      CONFIG_FILE="$primary_config"
      log "Created default config at $primary_config"
      return 0
    }
  fi
  
  # Fallback to tmp location
  mkdir -p "/tmp/quecmanager/settings" 2>/dev/null || true
  {
    echo "PING_ENABLED=true"
    echo "PING_HOST=$DEFAULT_HOST"
    echo "PING_INTERVAL=$DEFAULT_INTERVAL"
  } > "$fallback_config" && {
    chmod 644 "$fallback_config" 2>/dev/null || true
    CONFIG_FILE="$fallback_config"
    log "Created default config at $fallback_config"
    return 0
  }
  
  log "Failed to create default config file"
  return 1
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

# Create default config if none exists
create_default_config

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
