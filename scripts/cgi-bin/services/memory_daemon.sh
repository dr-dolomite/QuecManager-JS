#!/bin/sh

set -eu

# Ensure PATH for OpenWrt/BusyBox
export PATH="/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

TMP_DIRwhile true; do
  read_config
  if [ "$ENABLED" != "true" ]; then log "Disabled in config"; exit 0; fi
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  
  # Get memory information using /proc/meminfo (more reliable on OpenWrt)
  if [ -r "/proc/meminfo" ]; then
    # Extract values from /proc/meminfo (values are in kB)
    TOTAL_KB=$(grep "^MemTotal:" /proc/meminfo | awk '{print $2}' || echo "0")
    AVAIL_KB=$(grep "^MemAvailable:" /proc/meminfo | awk '{print $2}' || echo "0")
    FREE_KB=$(grep "^MemFree:" /proc/meminfo | awk '{print $2}' || echo "0")
    
    # If MemAvailable is not available (older kernels), use MemFree
    if [ "$AVAIL_KB" = "0" ]; then
      AVAIL_KB="$FREE_KB"
    fi
    
    # Convert to bytes (multiply by 1024)
    TOTAL_BYTES=$((TOTAL_KB * 1024))
    AVAIL_BYTES=$((AVAIL_KB * 1024))
    USED_BYTES=$((TOTAL_BYTES - AVAIL_BYTES))
    
    json="{"total": $TOTAL_BYTES, "used": $USED_BYTES, "available": $AVAIL_BYTES , "timestamp": "$ts" }"
  else
    # Fallback if /proc/meminfo is not available
    log "Warning: /proc/meminfo not readable, using fallback"
    json="{"total": 0, "used": 0, "available": 0, "timestamp": "$ts", "error": "meminfo_unavailable" }"
  fiuecmanager"
OUT_JSON="$TMP_DIR/memory.json"
PID_FILE="$TMP_DIR/memory_daemon.pid"
LOG_FILE="$TMP_DIR/memory_daemon.log"
CONFIG_FILE="/etc/quecmanager/settings/memory_settings.conf"
[ -f "$CONFIG_FILE" ] || CONFIG_FILE="/tmp/quecmanager/settings/memory_settings.conf"
DEFAULT_INTERVAL=1

ensure_tmp_dir() { [ -d "$TMP_DIR" ] || mkdir -p "$TMP_DIR" || exit 1; }

log() {
  printf '%s - %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG_FILE" 2>/dev/null || true
}

daemon_is_running() {
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      # Avoid false positive if PID reused
      if [ -r "/proc/$pid/cmdline" ] && grep -q "memory_daemon.sh" "/proc/$pid/cmdline" 2>/dev/null; then
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

create_default_config() {
  # Check if any config file exists
  local primary_config="/etc/quecmanager/settings/memory_settings.conf"
  local fallback_config="/tmp/quecmanager/settings/memory_settings.conf"
  
  if [ ! -f "$primary_config" ] && [ ! -f "$fallback_config" ]; then
    log "No config file found, creating default configuration"
    
    # Try to create in primary location first
    if mkdir -p "/etc/quecmanager/settings" 2>/dev/null; then
      {
        echo "MEMORY_ENABLED=true"
        echo "MEMORY_INTERVAL=1"
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
      echo "MEMORY_ENABLED=true"
      echo "MEMORY_INTERVAL=1"
    } > "$fallback_config" && {
      chmod 644 "$fallback_config" 2>/dev/null || true
      CONFIG_FILE="$fallback_config"
      log "Created default config at $fallback_config"
      return 0
    }
    
    log "Failed to create default config file"
    return 1
  fi
}

read_config() {
  ENABLED="true"; INTERVAL="$DEFAULT_INTERVAL"
  if [ -f "$CONFIG_FILE" ]; then
    MEMORY_ENABLED=$(grep -E "^MEMORY_ENABLED=" "$CONFIG_FILE" | tail -n1 | cut -d'=' -f2 | tr -d '\r') || true
    MEMORY_INTERVAL=$(grep -E "^MEMORY_INTERVAL=" "$CONFIG_FILE" | tail -n1 | cut -d'=' -f2 | tr -d '\r') || true
    case "${MEMORY_ENABLED:-}" in true|1|on|yes|enabled) ENABLED=true ;; *) ENABLED=false ;; esac
    if echo "${MEMORY_INTERVAL:-}" | grep -qE '^[0-9]+$'; then
      if [ "$MEMORY_INTERVAL" -ge 1 ] && [ "$MEMORY_INTERVAL" -le 10 ]; then
        INTERVAL="$MEMORY_INTERVAL"
      fi
    fi
  fi
}

write_json_atomic() {
  tmpfile="$(mktemp "$TMP_DIR/memory.XXXXXX" 2>/dev/null || true)"
  if [ -n "${tmpfile:-}" ] && [ -w "$TMP_DIR" ]; then
    printf '%s' "$1" > "$tmpfile" 2>/dev/null || true
    mv -f "$tmpfile" "$OUT_JSON" 2>/dev/null || printf '%s' "$1" > "$OUT_JSON"
  else
    printf '%s' "$1" > "$OUT_JSON"
  fi
}

ensure_tmp_dir
log "Starting memory daemon"
if daemon_is_running; then log "Already running"; exit 0; fi

# Create default config if none exists
create_default_config

trap cleanup EXIT INT TERM 
write_pid

while true; do
  read_config
  if [ "$ENABLED" != "true" ]; then log "Disabled in config"; exit 0; fi
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  
  # Get memory information
  free_output=$(free -b)
  memory_info=$(echo "$free_output" | awk '/Mem:/ {print "{\"total\": " $2 ", \"used\": " $3 ", \"available\": " $7 "}"}')
  
  # Add timestamp to the JSON
  
  write_json_atomic "$json"
  log "Wrote: $json"
  sleep "$INTERVAL"
done