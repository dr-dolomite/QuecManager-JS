# Updated WebSocket Bandwidth Monitor - 30-Second Historical Tracking

## Changes Made

### 1. Updated Types (`types/types.ts`)
Added new interfaces for historical bandwidth tracking:

```typescript
export interface BandwidthDataPoint {
  timestamp: string;
  downloadSpeed: number; // in bytes/second
  uploadSpeed: number; // in bytes/second
}

export interface BandwidthHistoryData {
  current: BandwidthDataPoint;
  history: BandwidthDataPoint[]; // 30-second rolling history
  averageDownloadSpeed: number;
  averageUploadSpeed: number;
  maxDownloadSpeed: number;
  maxUploadSpeed: number;
}
```

### 2. Updated Hook (`hooks/use-bandwidth-monitor.ts`)
**Key Features:**
- **30-Second Rolling History**: Maintains only the most recent 30 seconds of data
- **Speed-Only Focus**: Only tracks download and upload speeds, ignoring other data
- **Real-time Statistics**: Calculates averages and peak speeds automatically
- **Memory Efficient**: Limits to maximum 30 data points
- **Automatic Cleanup**: Removes data points older than 30 seconds

**Returns:**
```typescript
{
  historyData: BandwidthHistoryData | null; // Historical data with statistics
  isConnected: boolean;                     // Connection status
  error: string | null;                     // Error messages
  connectionStatus: string;                 // Human-readable status
  reconnect: () => void;                   // Manual reconnect function
  formatSpeed: (number) => string;         // Speed formatting utility
}
```

### 3. Updated Example Component (`components/examples/bandwidth-monitor-example.tsx`)
**New Display Sections:**
- **Current Speeds**: Real-time download/upload speeds
- **30-Second Averages**: Average speeds over the historical period
- **Peak Speeds**: Maximum speeds recorded in the last 30 seconds
- **Historical Info**: Data point count and connection details

## Usage Example

```typescript
import { useBandwidthMonitor } from '@/hooks/use-bandwidth-monitor';

function SpeedTracker() {
  const { historyData, isConnected, formatSpeed } = useBandwidthMonitor();

  if (!isConnected) return <div>Connecting...</div>;
  if (!historyData) return <div>Collecting data...</div>;

  return (
    <div>
      <h3>Current Speeds</h3>
      <p>Download: {formatSpeed(historyData.current.downloadSpeed)}</p>
      <p>Upload: {formatSpeed(historyData.current.uploadSpeed)}</p>

      <h3>30-Second Averages</h3>
      <p>Avg Download: {formatSpeed(historyData.averageDownloadSpeed)}</p>
      <p>Avg Upload: {formatSpeed(historyData.averageUploadSpeed)}</p>

      <h3>Peak Speeds (30s)</h3>
      <p>Max Download: {formatSpeed(historyData.maxDownloadSpeed)}</p>
      <p>Max Upload: {formatSpeed(historyData.maxUploadSpeed)}</p>

      <h3>History Info</h3>
      <p>Data Points: {historyData.history.length}/30</p>
      <p>Time Span: {historyData.history.length} seconds</p>
    </div>
  );
}
```

## Data Flow

1. **WebSocket Receives Data**: Raw bandwidth data from server
2. **Extract Speeds Only**: Downloads and uploads speeds are extracted
3. **Add to History**: New data point added to rolling history array
4. **Cleanup Old Data**: Points older than 30 seconds are removed
5. **Calculate Statistics**: Averages and maximums are computed
6. **Update State**: Component re-renders with new statistics

## Key Benefits

✅ **Memory Efficient**: Only stores 30 data points maximum
✅ **Real-time Stats**: Automatic calculation of averages and peaks
✅ **Speed-focused**: Ignores total data usage, latency, signal strength
✅ **Time-bounded**: Always shows exactly 30 seconds of history
✅ **Performance**: Lightweight calculations and efficient cleanup
✅ **Visual Feedback**: Clear distinction between current, average, and peak speeds

## Configuration

The hook uses these constants for history management:
```typescript
const HISTORY_DURATION_MS = 30 * 1000;  // 30 seconds
const MAX_HISTORY_POINTS = 30;          // Maximum data points
```

## Server Requirements

The WebSocket server should send the same format as before, but only the `downloadSpeed` and `uploadSpeed` fields will be used for historical tracking:

```json
{
  "type": "bandwidth",
  "data": {
    "timestamp": "2025-09-24T10:30:00.000Z",
    "downloadSpeed": 1024000,
    "uploadSpeed": 256000,
    "totalDownload": 5368709120,     // Ignored for history
    "totalUpload": 1073741824,       // Ignored for history
    "latency": 25,                   // Ignored for history
    "signalStrength": -75            // Ignored for history
  }
}
```

The implementation now focuses exclusively on tracking download and upload speeds over a 30-second rolling window, providing current values, historical averages, and peak speeds for better bandwidth monitoring insights.