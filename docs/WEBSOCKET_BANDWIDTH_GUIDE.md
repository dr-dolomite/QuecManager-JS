# WebSocket Bandwidth Monitor Implementation

This guide shows you how to use WebSockets in the QuecManager-JS project to retrieve bandwidth monitoring data from `ws://192.168.224.1:8838/bandwidth-monitor`.

## Quick Start

### 1. Using the Custom Hook

The easiest way to use the bandwidth monitor is with the custom hook:

```typescript
import { useBandwidthMonitor } from '@/hooks/use-bandwidth-monitor';

function BandwidthDisplay() {
  const { 
    bandwidthData, 
    isConnected, 
    error, 
    formatSpeed, 
    formatBytes 
  } = useBandwidthMonitor();

  if (!isConnected) return <div>Connecting...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!bandwidthData) return <div>Waiting for data...</div>;

  return (
    <div>
      <h3>Bandwidth Monitor</h3>
      <p>Download: {formatSpeed(bandwidthData.downloadSpeed)}</p>
      <p>Upload: {formatSpeed(bandwidthData.uploadSpeed)}</p>
    </div>
  );
}
```

### 2. Direct WebSocket Usage

For more control, you can use WebSocket directly:

```typescript
import { useEffect, useRef, useState } from 'react';

function DirectWebSocketExample() {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    // Connect to bandwidth monitor WebSocket
    ws.current = new WebSocket('ws://192.168.224.1:8838/bandwidth-monitor');
    
    ws.current.onopen = () => {
      console.log('Connected to bandwidth monitor');
      setConnected(true);
    };
    
    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'bandwidth') {
          setData(message.data);
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };
    
    ws.current.onclose = () => {
      setConnected(false);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return (
    <div>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      {data && (
        <div>
          <p>Download: {(data.downloadSpeed / 1024 / 1024).toFixed(2)} MB/s</p>
          <p>Upload: {(data.uploadSpeed / 1024 / 1024).toFixed(2)} MB/s</p>
        </div>
      )}
    </div>
  );
}
```

## Features

### Automatic Reconnection
The hook includes automatic reconnection with exponential backoff:
- Attempts to reconnect up to 5 times
- Uses exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)
- Manual reconnect option available

### Error Handling
- Connection errors are caught and reported
- Invalid message parsing is handled gracefully
- Connection status is always available

### Data Formatting
Built-in utilities for formatting:
- `formatSpeed(bytesPerSecond)` - converts to "1.5 MB/s" format
- `formatBytes(bytes)` - converts to "1.5 GB" format

## WebSocket Server Requirements

The WebSocket server at `ws://192.168.224.1:8838/bandwidth-monitor` should send messages in this format:

```json
{
  "type": "bandwidth",
  "data": {
    "timestamp": "2025-09-24T10:30:00.000Z",
    "downloadSpeed": 1024000,
    "uploadSpeed": 256000,
    "totalDownload": 5368709120,
    "totalUpload": 1073741824,
    "latency": 25,
    "signalStrength": -75
  }
}
```

Error messages:
```json
{
  "type": "error",
  "data": "Connection failed"
}
```

Status messages:
```json
{
  "type": "status", 
  "data": "Monitoring started"
}
```

## Integration Examples

### In a Dashboard Component
```typescript
function Dashboard() {
  const { bandwidthData, isConnected, formatSpeed } = useBandwidthMonitor();
  
  return (
    <div className="dashboard">
      <div className="bandwidth-section">
        <h2>Real-time Bandwidth</h2>
        <div className="metrics">
          <div className="metric">
            <label>Download</label>
            <span>{bandwidthData ? formatSpeed(bandwidthData.downloadSpeed) : '--'}</span>
          </div>
          <div className="metric">
            <label>Upload</label>
            <span>{bandwidthData ? formatSpeed(bandwidthData.uploadSpeed) : '--'}</span>
          </div>
        </div>
        <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Live' : 'Offline'}
        </div>
      </div>
    </div>
  );
}
```

### With Charts (using recharts)
```typescript
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

function BandwidthChart() {
  const { bandwidthData } = useBandwidthMonitor();
  const [history, setHistory] = useState<Array<{time: string, download: number, upload: number}>>([]);

  useEffect(() => {
    if (bandwidthData) {
      setHistory(prev => [...prev.slice(-50), {
        time: new Date(bandwidthData.timestamp).toLocaleTimeString(),
        download: bandwidthData.downloadSpeed / 1024 / 1024, // Convert to MB/s
        upload: bandwidthData.uploadSpeed / 1024 / 1024
      }]);
    }
  }, [bandwidthData]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={history}>
        <XAxis dataKey="time" />
        <YAxis />
        <Line type="monotone" dataKey="download" stroke="#8884d8" name="Download (MB/s)" />
        <Line type="monotone" dataKey="upload" stroke="#82ca9d" name="Upload (MB/s)" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

## Troubleshooting

1. **Connection fails**: Make sure the WebSocket server is running at `ws://192.168.224.1:8838/bandwidth-monitor`
2. **No data received**: Check that the server sends messages in the correct format
3. **Frequent disconnections**: The hook will auto-reconnect, but check server stability
4. **Type errors**: Ensure `@types/react` is installed and TypeScript configuration is correct

## Files Created/Modified

1. `types/types.ts` - Added bandwidth monitoring types
2. `hooks/use-bandwidth-monitor.ts` - Custom hook for WebSocket connection
3. `components/examples/bandwidth-monitor-example.tsx` - Example component
4. `components/home/bandwidth-monitor.tsx` - Full-featured component
5. `docs/WEBSOCKET_BANDWIDTH_GUIDE.md` - This documentation