# Internet Quality Monitor - 3-Tier Data Collection

## Overview
Implemented a 3-tier data collection and visualization approach for network quality monitoring with Real Time, Hourly, and Daily views.

## Architecture

### Data Collection Tiers

#### 1. Real Time Tab
- **Purpose**: Continuous ping monitoring with rolling window
- **Collection**: Every 10 seconds (ping interval)
- **Storage**: `ping_realtime.json`
- **Retention**: Maximum 15 entries (rolling window)
- **Display**: Shows time with minute precision (HH:MM)

#### 2. Hourly Tab
- **Purpose**: Minute-based aggregation for hourly view
- **Collection Process**:
  1. Every minute: Latest entry from real-time data is collected
  2. Stored in `ping_minutely.json` (max 60 entries)
  3. Every hour: All minutely entries are averaged
  4. Hourly aggregate stored in `ping_hourly.json`
  5. Minutely file is cleared after aggregation
- **Retention**: Maximum 24 hourly entries (1 day)
- **Display**: Shows hour only (HH:00)
- **Edge Case Handling**: If user boots mid-hour, averages actual count of minutely entries (not fixed 60)

#### 3. Daily Tab
- **Purpose**: Daily aggregation from hourly data
- **Collection Process**:
  1. Every day: All 24 hourly entries are averaged
  2. Daily aggregate stored in `ping_daily.json`
- **Retention**: Maximum 365 daily entries (1 year)
- **Display**: Shows date (MMM DD)
- **Note**: Only creates daily aggregate when at least 24 hourly entries are available

## Backend Changes

### ping_daemon.sh
**File**: `scripts/cgi-bin/services/ping_daemon.sh`

**Key Changes**:
- Changed default interval from 5s to 10s
- Replaced time-based bucketing with 3-tier collection system
- New data files:
  - `ping_realtime.json` - Real-time rolling window (15 max)
  - `ping_minutely.json` - Minute-based collection buffer (60 max)
  - `ping_hourly.json` - Hourly aggregates (24 max)
  - `ping_daily.json` - Daily aggregates (365 max)

**New Functions**:
- `append_to_realtime()` - Appends to real-time rolling window
- `collect_minutely()` - Collects latest real-time entry every minute
- `aggregate_hourly()` - Averages minutely data into hourly entry
- `aggregate_daily()` - Averages hourly data into daily entry

**Time Tracking**:
```bash
last_collect_minute=$(date -u +%M)    # Track minute changes
last_aggregate_hour=$(date -u +%H)    # Track hour changes
last_aggregate_day=$(date -u +%d)     # Track day changes
```

### Fetch Scripts

#### fetch_historical.sh
**File**: `scripts/cgi-bin/quecmanager/home/ping/fetch_historical.sh`

**Changes**:
- Updated to read from `ping_realtime.json` instead of `ping_historical.json`
- Returns up to 15 real-time entries

#### fetch_hourly.sh
**File**: `scripts/cgi-bin/quecmanager/home/ping/fetch_hourly.sh`

**No changes needed** - Already returns hourly data from `ping_hourly.json`

#### fetch_daily.sh (NEW)
**File**: `scripts/cgi-bin/quecmanager/home/ping/fetch_daily.sh`

**Purpose**: Fetch daily aggregated data
- Reads from `ping_daily.json`
- Returns array of daily entries
- Same response format as other fetch scripts

## Frontend Changes

### internet-quality.tsx
**File**: `components/experimental/internet-quality.tsx`

**Key Updates**:

1. **Type Definitions**:
```typescript
interface DailyPingData {
  timestamp: string;
  host: string;
  latency: number;
  packet_loss: number;
  sample_count: number;
}

type ViewMode = "realtime" | "hourly" | "daily";
```

2. **State Management**:
```typescript
const [realtimeDataArray, setRealtimeDataArray] = useState<PingData[]>([]);
const [hourlyDataArray, setHourlyDataArray] = useState<HourlyPingData[]>([]);
const [dailyDataArray, setDailyDataArray] = useState<DailyPingData[]>([]);
const [viewMode, setViewMode] = useState<ViewMode>("realtime");
```

3. **Data Fetching**:
- `fetchRealtimeData()` - Fetches from `fetch_historical.sh`
- `fetchHourlyData()` - Fetches from `fetch_hourly.sh`
- `fetchDailyData()` - Fetches from `fetch_daily.sh`
- All three fetch functions called every 10 seconds

4. **Tabs Component**:
```tsx
<Tabs defaultValue="realtime" onValueChange={(value) => setViewMode(value as ViewMode)}>
  <TabsList>
    <TabsTrigger value="realtime">Real Time</TabsTrigger>
    <TabsTrigger value="hourly">Hourly</TabsTrigger>
    <TabsTrigger value="daily">Daily</TabsTrigger>
  </TabsList>
```

5. **Dynamic Chart Data**:
```typescript
const chartData =
  viewMode === "realtime" ? realtimeDataArray.map(...) :
  viewMode === "hourly" ? hourlyDataArray.map(...) :
  dailyDataArray.map(...);
```

6. **View-Specific Formatting**:
- **Real Time**: HH:MM format
- **Hourly**: HH:00 format
- **Daily**: MMM DD format

7. **Dynamic Descriptions**:
```typescript
const getViewInfo = () => {
  switch (viewMode) {
    case "realtime":
      return {
        description: "Real-time view - Continuous ping (max 15 entries)",
        footer: `Showing ${chartData.length} data points (rolling window)`,
        dataType: "Real-time data",
      };
    // ... hourly and daily cases
  }
};
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      ping_daemon.sh                         │
│                    (10-second interval)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  append_to_realtime()    │
        │  ping_realtime.json      │
        │  (15 entries max)        │
        └──────┬───────────────────┘
               │
               │ Every Minute
               ▼
        ┌──────────────────────────┐
        │  collect_minutely()      │
        │  ping_minutely.json      │
        │  (60 entries max)        │
        └──────┬───────────────────┘
               │
               │ Every Hour
               ▼
        ┌──────────────────────────┐
        │  aggregate_hourly()      │
        │  ping_hourly.json        │
        │  (24 entries max)        │
        │  Clear minutely file     │
        └──────┬───────────────────┘
               │
               │ Every Day (when 24 hours available)
               ▼
        ┌──────────────────────────┐
        │  aggregate_daily()       │
        │  ping_daily.json         │
        │  (365 entries max)       │
        └──────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Frontend Component                       │
└─────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
 fetch_historical.sh  fetch_hourly.sh    fetch_daily.sh
 (realtime.json)      (hourly.json)      (daily.json)
        │                    │                    │
        └────────────────────┴────────────────────┘
                             │
                             ▼
                    internet-quality.tsx
                    (3 tabs with charts)
```

## Benefits

1. **Efficient Storage**: Rolling windows and aggregation prevent unlimited data growth
2. **Multi-Granularity View**: Users can see different time scales (seconds, hours, days)
3. **Edge Case Handling**: Gracefully handles system boots mid-hour/mid-day
4. **Performance**: Auto-refresh every 10 seconds without overwhelming the system
5. **Historical Context**: Daily data provides long-term trend analysis (up to 1 year)

## Testing Recommendations

1. **Real-Time Tab**: Should populate within 10-20 seconds after enabling ping monitoring
2. **Hourly Tab**: Requires at least 1 minute of data collection, full view after 1 hour
3. **Daily Tab**: Requires at least 24 hours of continuous monitoring
4. **Mid-Hour Boot**: Start daemon mid-hour, verify hourly aggregate uses actual sample count
5. **Auto-Refresh**: Verify all three tabs update every 10 seconds
6. **Data Rotation**: Verify old entries are removed (15 realtime, 60 minutely, 24 hourly, 365 daily)

## File Changes Summary

### Modified Files:
- `scripts/cgi-bin/services/ping_daemon.sh` - Complete rewrite of data collection logic
- `scripts/cgi-bin/quecmanager/home/ping/fetch_historical.sh` - Updated to use ping_realtime.json
- `components/experimental/internet-quality.tsx` - Changed from 2 tabs to 3 tabs

### New Files:
- `scripts/cgi-bin/quecmanager/home/ping/fetch_daily.sh` - Fetch daily aggregated data

### Data Files:
- `/tmp/quecmanager/ping_realtime.json` - Real-time rolling window (15 max)
- `/tmp/quecmanager/ping_minutely.json` - Minute collection buffer (60 max, cleared hourly)
- `/tmp/quecmanager/ping_hourly.json` - Hourly aggregates (24 max)
- `/tmp/quecmanager/ping_daily.json` - Daily aggregates (365 max)
- `/tmp/quecmanager/ping_latency.json` - Current ping (maintained for backward compatibility)

## Migration Notes

- **Backward Compatibility**: `ping_latency.json` is still written for existing components
- **Automatic Migration**: No manual intervention needed - daemon automatically creates new files
- **Data Loss**: Old `ping_historical.json` data will not be migrated (new collection starts fresh)
- **UCI Config**: No changes to UCI configuration needed
