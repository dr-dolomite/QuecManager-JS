#!/bin/sh

set -eu

# Ensure PATH for OpenWrt/BusyBox
export PATH="/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# Load centralized logging
. /www/cgi-bin/services/quecmanager_logger.sh

TMP_DIR="/tmp/quecmanager"
OUT_JSON="$TMP_DIR/ping_latency.json"
REALTIME_JSON="$TMP_DIR/ping_realtime.json"
MINUTELY_JSON="$TMP_DIR/ping_minutely.json"
HOURLY_JSON="$TMP_DIR/ping_hourly.json"
DAILY_JSON="$TMP_DIR/ping_daily.json"
PID_FILE="$TMP_DIR/ping_daemon.pid"
DEFAULT_HOST="8.8.8.8"
DEFAULT_INTERVAL=10
SCRIPT_NAME="ping_daemon"
UCI_CONFIG="quecmanager"

# Data retention settings
MAX_REALTIME_ENTRIES=15      # Real-time rolling window (continuous ping)
MAX_MINUTELY_ENTRIES=60      # Collect every minute (max 60 for 1 hour)
MAX_HOURLY_ENTRIES=24        # Keep 24 hourly entries (1 day)
MAX_DAILY_ENTRIES=365        # Keep 1 year of daily data

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

append_to_realtime() {
  # Append to real-time rolling window (max 15 entries)
  echo "$1" >> "$REALTIME_JSON" 2>/dev/null || true
  
  # Keep only last 15 entries
  if [ -f "$REALTIME_JSON" ]; then
    line_count=$(wc -l < "$REALTIME_JSON" 2>/dev/null || echo "0")
    if [ "$line_count" -gt "$MAX_REALTIME_ENTRIES" ]; then
      tail -n "$MAX_REALTIME_ENTRIES" "$REALTIME_JSON" > "$REALTIME_JSON.tmp" 2>/dev/null || true
      mv -f "$REALTIME_JSON.tmp" "$REALTIME_JSON" 2>/dev/null || true
    fi
  fi
}

collect_minutely() {
  # Collect the latest entry from real-time data every minute
  if [ ! -f "$REALTIME_JSON" ]; then
    return
  fi
  
  # Get the latest entry from real-time data
  latest_entry=$(tail -n 1 "$REALTIME_JSON" 2>/dev/null || echo "")
  
  if [ -n "$latest_entry" ]; then
    # Append to minutely file
    echo "$latest_entry" >> "$MINUTELY_JSON" 2>/dev/null || true
    log "Collected minutely entry: $latest_entry"
    
    # Keep only last 60 entries
    if [ -f "$MINUTELY_JSON" ]; then
      line_count=$(wc -l < "$MINUTELY_JSON" 2>/dev/null || echo "0")
      if [ "$line_count" -gt "$MAX_MINUTELY_ENTRIES" ]; then
        tail -n "$MAX_MINUTELY_ENTRIES" "$MINUTELY_JSON" > "$MINUTELY_JSON.tmp" 2>/dev/null || true
        mv -f "$MINUTELY_JSON.tmp" "$MINUTELY_JSON" 2>/dev/null || true
      fi
    fi
  fi
}

aggregate_hourly() {
  # Aggregate minutely data into hourly average
  if [ ! -f "$MINUTELY_JSON" ]; then
    return
  fi
  
  current_hour=$(date -u +"%Y-%m-%dT%H:00:00Z")
  
  # Check if we already have an entry for this hour
  if [ -f "$HOURLY_JSON" ]; then
    if grep -q "\"timestamp\":\"$current_hour\"" "$HOURLY_JSON" 2>/dev/null; then
      return  # Already aggregated this hour
    fi
  fi
  
  # Calculate averages from all minutely entries
  total_latency=0
  total_packet_loss=0
  count=0
  
  while IFS= read -r line; do
    latency=$(echo "$line" | grep -oE '"latency":[0-9]+' | cut -d':' -f2)
    packet_loss=$(echo "$line" | grep -oE '"packet_loss":[0-9]+' | cut -d':' -f2)
    
    if [ -n "$latency" ] && [ "$latency" != "null" ]; then
      total_latency=$((total_latency + latency))
      total_packet_loss=$((total_packet_loss + packet_loss))
      count=$((count + 1))
    fi
  done < "$MINUTELY_JSON"
  
  # If we have data, create hourly aggregate
  if [ "$count" -gt 0 ]; then
    avg_latency=$((total_latency / count))
    avg_packet_loss=$((total_packet_loss / count))
    
    hourly_json="{\"timestamp\":\"$current_hour\",\"host\":\"$HOST\",\"latency\":$avg_latency,\"packet_loss\":$avg_packet_loss,\"sample_count\":$count}"
    
    # Append to hourly file
    echo "$hourly_json" >> "$HOURLY_JSON" 2>/dev/null || true
    log "Created hourly aggregate: $hourly_json"
    
    # Keep only last 24 hourly entries
    if [ -f "$HOURLY_JSON" ]; then
      line_count=$(wc -l < "$HOURLY_JSON" 2>/dev/null || echo "0")
      if [ "$line_count" -gt "$MAX_HOURLY_ENTRIES" ]; then
        tail -n "$MAX_HOURLY_ENTRIES" "$HOURLY_JSON" > "$HOURLY_JSON.tmp" 2>/dev/null || true
        mv -f "$HOURLY_JSON.tmp" "$HOURLY_JSON" 2>/dev/null || true
      fi
    fi
    
    # Clear minutely file after aggregation
    > "$MINUTELY_JSON" 2>/dev/null || true
  fi
}

aggregate_daily() {
  # Aggregate hourly data into daily average
  if [ ! -f "$HOURLY_JSON" ]; then
    return
  fi
  
  current_date=$(date -u +"%Y-%m-%dT00:00:00Z")
  
  # Check if we already have an entry for this day
  if [ -f "$DAILY_JSON" ]; then
    if grep -q "\"timestamp\":\"$current_date\"" "$DAILY_JSON" 2>/dev/null; then
      return  # Already aggregated this day
    fi
  fi
  
  # Calculate averages from all hourly entries (up to 24)
  total_latency=0
  total_packet_loss=0
  count=0
  
  while IFS= read -r line; do
    latency=$(echo "$line" | grep -oE '"latency":[0-9]+' | cut -d':' -f2)
    packet_loss=$(echo "$line" | grep -oE '"packet_loss":[0-9]+' | cut -d':' -f2)
    
    if [ -n "$latency" ] && [ "$latency" != "null" ]; then
      total_latency=$((total_latency + latency))
      total_packet_loss=$((total_packet_loss + packet_loss))
      count=$((count + 1))
    fi
  done < "$HOURLY_JSON"
  
  # If we have at least 24 hourly entries (full day), create daily aggregate
  if [ "$count" -ge 24 ]; then
    avg_latency=$((total_latency / count))
    avg_packet_loss=$((total_packet_loss / count))
    
    daily_json="{\"timestamp\":\"$current_date\",\"host\":\"$HOST\",\"latency\":$avg_latency,\"packet_loss\":$avg_packet_loss,\"sample_count\":$count}"
    
    # Append to daily file
    echo "$daily_json" >> "$DAILY_JSON" 2>/dev/null || true
    log "Created daily aggregate: $daily_json"
    
    # Keep only last year of daily entries
    if [ -f "$DAILY_JSON" ]; then
      line_count=$(wc -l < "$DAILY_JSON" 2>/dev/null || echo "0")
      if [ "$line_count" -gt "$MAX_DAILY_ENTRIES" ]; then
        tail -n "$MAX_DAILY_ENTRIES" "$DAILY_JSON" > "$DAILY_JSON.tmp" 2>/dev/null || true
        mv -f "$DAILY_JSON.tmp" "$DAILY_JSON" 2>/dev/null || true
      fi
    fi
  fi
}

ensure_tmp_dir
log "Starting ping daemon"
if daemon_is_running; then log "Already running"; exit 0; fi

trap cleanup EXIT INT TERM 
write_pid

# Track when we last collected/aggregated data
last_collect_minute=$(date -u +%M)
last_aggregate_hour=$(date -u +%H)
last_aggregate_day=$(date -u +%d)
iteration_count=0

while true; do
  read_config
  if [ "$ENABLED" != "true" ]; then log "Disabled in config"; exit 0; fi
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  PING_BIN="$(command -v ping || echo /bin/ping)"
  
  # Send 5 pings to measure packet loss (increase deadline to ensure all pings complete)
  output="$("$PING_BIN" -c 5 -W 2 "$HOST" 2>/dev/null || true)"
  
  # Check if we have statistics section (ping completed)
  if echo "$output" | grep -q "packets transmitted"; then
    # Extract packet loss percentage from statistics
    packet_loss="$(echo "$output" | grep -oE '[0-9]+% packet loss' | grep -oE '[0-9]+' | head -n1)"
    [ -z "$packet_loss" ] && packet_loss=0
    
    # Extract average latency from "round-trip min/avg/max = X/Y/Z ms"
    if echo "$output" | grep -q "round-trip"; then
      latency_ms="$(echo "$output" | grep -oE 'round-trip[^=]*= [0-9.]+/[0-9.]+/[0-9.]+' | grep -oE '[0-9.]+/[0-9.]+/[0-9.]+' | cut -d'/' -f2 | cut -d'.' -f1)"
      [ -z "$latency_ms" ] && latency_ms=0
    else
      latency_ms=0
    fi
    
    json="{\"timestamp\":\"$ts\",\"host\":\"$HOST\",\"latency\":$latency_ms,\"packet_loss\":$packet_loss,\"ok\":true}"
  else
    # No statistics = complete failure
    json="{\"timestamp\":\"$ts\",\"host\":\"$HOST\",\"latency\":null,\"packet_loss\":100,\"ok\":false}"
  fi
  
  # Write to current ping file (backwards compatibility)
  write_json_atomic "$json"
  
  # Append to real-time rolling window
  append_to_realtime "$json"
  log "Wrote: $json"
  
  # Collect minutely data (every minute)
  current_minute=$(date -u +%M)
  if [ "$current_minute" != "$last_collect_minute" ]; then
    collect_minutely
    last_collect_minute="$current_minute"
  fi
  
  # Aggregate hourly data (once per hour)
  current_hour=$(date -u +%H)
  if [ "$current_hour" != "$last_aggregate_hour" ]; then
    aggregate_hourly
    last_aggregate_hour="$current_hour"
  fi
  
  # Aggregate daily data (once per day)
  current_day=$(date -u +%d)
  if [ "$current_day" != "$last_aggregate_day" ]; then
    aggregate_daily
    last_aggregate_day="$current_day"
  fi
  
  sleep "$INTERVAL"
done
