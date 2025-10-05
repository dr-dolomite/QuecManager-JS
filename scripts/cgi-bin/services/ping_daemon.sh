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
STATE_FILE="$TMP_DIR/ping_daemon_state"
DEFAULT_HOST="8.8.8.8"
DEFAULT_INTERVAL=10
SCRIPT_NAME="ping_daemon"
UCI_CONFIG="quecmanager"

# Data retention settings
MAX_REALTIME_ENTRIES=15      # Real-time rolling window
MAX_MINUTELY_ENTRIES=60      # Keep 60 minutes (1 hour)
MAX_HOURLY_ENTRIES=24        # Keep 24 hours (1 day)
MAX_DAILY_ENTRIES=365        # Keep 1 year

ensure_tmp_dir() { [ -d "$TMP_DIR" ] || mkdir -p "$TMP_DIR" || exit 1; }

log() { qm_log_info "daemon" "$SCRIPT_NAME" "$1"; }

daemon_is_running() {
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
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

# Initialize UCI config
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
  
  init_uci_config
  
  PING_ENABLED=$(uci get "$UCI_CONFIG.ping_monitoring.enabled" 2>/dev/null || echo "1")
  PING_HOST=$(uci get "$UCI_CONFIG.ping_monitoring.host" 2>/dev/null || echo "$DEFAULT_HOST")
  PING_INTERVAL=$(uci get "$UCI_CONFIG.ping_monitoring.interval" 2>/dev/null || echo "$DEFAULT_INTERVAL")
  
  case "${PING_ENABLED:-}" in 
    true|1|on|yes|enabled) ENABLED=true ;; 
    *) ENABLED=false ;; 
  esac
  
  [ -n "${PING_HOST:-}" ] && HOST="$PING_HOST"
  
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

# Optimized: single function to trim files
trim_file() {
  local file="$1"
  local max_lines="$2"
  
  if [ -f "$file" ]; then
    line_count=$(wc -l < "$file" 2>/dev/null || echo "0")
    if [ "$line_count" -gt "$max_lines" ]; then
      tail -n "$max_lines" "$file" > "$file.tmp" 2>/dev/null && mv -f "$file.tmp" "$file" 2>/dev/null || true
    fi
  fi
}

append_to_realtime() {
  echo "$1" >> "$REALTIME_JSON" 2>/dev/null || true
  trim_file "$REALTIME_JSON" "$MAX_REALTIME_ENTRIES"
}

# Save daemon state (last aggregation times)
save_state() {
  cat > "$STATE_FILE" <<EOF
last_minutely_hour=$1
last_hourly_day=$2
last_daily_month=$3
EOF
}

# Load daemon state
load_state() {
  if [ -f "$STATE_FILE" ]; then
    . "$STATE_FILE"
  else
    last_minutely_hour=""
    last_hourly_day=""
    last_daily_month=""
  fi
}

collect_minutely() {
  # Get current hour identifier (YYYY-MM-DD-HH)
  current_hourly_id=$(date -u +"%Y-%m-%d-%H")
  
  # Load state
  load_state
  
  # If we're in a new hour, aggregate the PREVIOUS hour's real-time data
  if [ "$current_hourly_id" != "${last_minutely_hour:-}" ]; then
    if [ -f "$REALTIME_JSON" ]; then
      # Calculate average from all real-time entries in the PREVIOUS hour
      total_latency=0
      total_packet_loss=0
      valid_count=0
      
      while IFS= read -r line; do
        latency=$(echo "$line" | grep -oE '"latency":[0-9]+' | cut -d':' -f2)
        packet_loss=$(echo "$line" | grep -oE '"packet_loss":[0-9]+' | cut -d':' -f2)
        
        if [ -n "$latency" ]; then
          total_latency=$((total_latency + latency))
          total_packet_loss=$((total_packet_loss + packet_loss))
          valid_count=$((valid_count + 1))
        fi
      done < "$REALTIME_JSON"
      
      # Create minutely entry if we have data
      if [ "$valid_count" -gt 0 ]; then
        avg_latency=$((total_latency / valid_count))
        avg_packet_loss=$((total_packet_loss / valid_count))
        
        # Use the START of the previous hour
        prev_hour_ts=$(date -u -d "-1 hour" +"%Y-%m-%dT%H:00:00Z" 2>/dev/null || date -u +"%Y-%m-%dT%H:00:00Z")
        
        minutely_json="{\"timestamp\":\"$prev_hour_ts\",\"host\":\"$HOST\",\"latency\":$avg_latency,\"packet_loss\":$avg_packet_loss,\"sample_count\":$valid_count}"
        
        echo "$minutely_json" >> "$MINUTELY_JSON" 2>/dev/null || true
        log "Collected minutely entry for previous hour: $minutely_json"
        
        trim_file "$MINUTELY_JSON" "$MAX_MINUTELY_ENTRIES"
      fi
    fi
    
    # Update state
    save_state "$current_hourly_id" "${last_hourly_day:-}" "${last_daily_month:-}"
  fi
}

aggregate_hourly() {
  # Get current day identifier (YYYY-MM-DD)
  current_day_id=$(date -u +"%Y-%m-%d")
  
  # Load state
  load_state
  
  # If we're in a new day, aggregate the PREVIOUS day's minutely data
  if [ "$current_day_id" != "${last_hourly_day:-}" ]; then
    if [ -f "$MINUTELY_JSON" ]; then
      # We need at least a few minutely entries to make an hourly aggregate
      line_count=$(wc -l < "$MINUTELY_JSON" 2>/dev/null || echo "0")
      
      if [ "$line_count" -ge 6 ]; then  # At least 6 minutely samples (10 minutes worth if collecting every minute)
        total_latency=0
        total_packet_loss=0
        valid_count=0
        
        while IFS= read -r line; do
          latency=$(echo "$line" | grep -oE '"latency":[0-9]+' | cut -d':' -f2)
          packet_loss=$(echo "$line" | grep -oE '"packet_loss":[0-9]+' | cut -d':' -f2)
          
          if [ -n "$latency" ]; then
            total_latency=$((total_latency + latency))
            total_packet_loss=$((total_packet_loss + packet_loss))
            valid_count=$((valid_count + 1))
          fi
        done < "$MINUTELY_JSON"
        
        if [ "$valid_count" -gt 0 ]; then
          avg_latency=$((total_latency / valid_count))
          avg_packet_loss=$((total_packet_loss / valid_count))
          
          # Use the START of the previous day
          prev_day_ts=$(date -u -d "-1 day" +"%Y-%m-%dT00:00:00Z" 2>/dev/null || date -u +"%Y-%m-%dT00:00:00Z")
          
          hourly_json="{\"timestamp\":\"$prev_day_ts\",\"host\":\"$HOST\",\"latency\":$avg_latency,\"packet_loss\":$avg_packet_loss,\"sample_count\":$valid_count}"
          
          echo "$hourly_json" >> "$HOURLY_JSON" 2>/dev/null || true
          log "Created hourly aggregate for previous day: $hourly_json"
          
          trim_file "$HOURLY_JSON" "$MAX_HOURLY_ENTRIES"
          
          # Clear minutely data after successful aggregation
          > "$MINUTELY_JSON" 2>/dev/null || true
        fi
      fi
    fi
    
    # Update state
    save_state "${last_minutely_hour:-}" "$current_day_id" "${last_daily_month:-}"
  fi
}

aggregate_daily() {
  # Get current month identifier (YYYY-MM)
  current_month_id=$(date -u +"%Y-%m")
  
  # Load state
  load_state
  
  # If we're in a new month, aggregate the PREVIOUS month's hourly data
  if [ "$current_month_id" != "${last_daily_month:-}" ]; then
    if [ -f "$HOURLY_JSON" ]; then
      line_count=$(wc -l < "$HOURLY_JSON" 2>/dev/null || echo "0")
      
      # Need at least 12 hourly entries to make a meaningful daily aggregate
      if [ "$line_count" -ge 12 ]; then
        total_latency=0
        total_packet_loss=0
        valid_count=0
        
        while IFS= read -r line; do
          latency=$(echo "$line" | grep -oE '"latency":[0-9]+' | cut -d':' -f2)
          packet_loss=$(echo "$line" | grep -oE '"packet_loss":[0-9]+' | cut -d':' -f2)
          
          if [ -n "$latency" ]; then
            total_latency=$((total_latency + latency))
            total_packet_loss=$((total_packet_loss + packet_loss))
            valid_count=$((valid_count + 1))
          fi
        done < "$HOURLY_JSON"
        
        if [ "$valid_count" -gt 0 ]; then
          avg_latency=$((total_latency / valid_count))
          avg_packet_loss=$((total_packet_loss / valid_count))
          
          # Use the first day of the previous month
          prev_month_ts=$(date -u -d "-1 month" +"%Y-%m-01T00:00:00Z" 2>/dev/null || date -u +"%Y-%m-01T00:00:00Z")
          
          daily_json="{\"timestamp\":\"$prev_month_ts\",\"host\":\"$HOST\",\"latency\":$avg_latency,\"packet_loss\":$avg_packet_loss,\"sample_count\":$valid_count}"
          
          echo "$daily_json" >> "$DAILY_JSON" 2>/dev/null || true
          log "Created daily aggregate for previous month: $daily_json"
          
          trim_file "$DAILY_JSON" "$MAX_DAILY_ENTRIES"
        fi
      fi
    fi
    
    # Update state
    save_state "${last_minutely_hour:-}" "${last_hourly_day:-}" "$current_month_id"
  fi
}

ensure_tmp_dir
log "Starting ping daemon"
if daemon_is_running; then log "Already running"; exit 0; fi

trap cleanup EXIT INT TERM 
write_pid

# Initialize state
load_state

while true; do
  read_config
  if [ "$ENABLED" != "true" ]; then log "Disabled in config"; exit 0; fi
  
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  PING_BIN="$(command -v ping || echo /bin/ping)"
  
  # Send 5 pings with 2 second timeout per ping
  output="$("$PING_BIN" -c 5 -W 2 "$HOST" 2>/dev/null || true)"
  
  if echo "$output" | grep -q "packets transmitted"; then
    packet_loss="$(echo "$output" | grep -oE '[0-9]+% packet loss' | grep -oE '[0-9]+' | head -n1)"
    [ -z "$packet_loss" ] && packet_loss=0
    
    if echo "$output" | grep -q "round-trip"; then
      latency_ms="$(echo "$output" | grep -oE 'round-trip[^=]*= [0-9.]+/[0-9.]+/[0-9.]+' | grep -oE '[0-9.]+/[0-9.]+/[0-9.]+' | cut -d'/' -f2 | cut -d'.' -f1)"
      [ -z "$latency_ms" ] && latency_ms=0
    else
      latency_ms=0
    fi
    
    json="{\"timestamp\":\"$ts\",\"host\":\"$HOST\",\"latency\":$latency_ms,\"packet_loss\":$packet_loss,\"ok\":true}"
  else
    json="{\"timestamp\":\"$ts\",\"host\":\"$HOST\",\"latency\":null,\"packet_loss\":100,\"ok\":false}"
  fi
  
  # Write current ping
  write_json_atomic "$json"
  append_to_realtime "$json"
  log "Wrote: $json"
  
  # Perform aggregations (these check internally if it's time to aggregate)
  collect_minutely
  aggregate_hourly
  aggregate_daily
  
  sleep "$INTERVAL"
done