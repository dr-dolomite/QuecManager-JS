# Real-time Speed Monitor Setup

This document provides setup instructions for the WebSocket-based real-time speed monitoring feature.

## Prerequisites

1. **websocat installation** (required for WebSocket server functionality)
   ```bash
   opkg update
   opkg install websocat
   ```

2. **bc calculator** (for floating-point calculations)
   ```bash
   opkg install bc
   ```

## File Structure

```
scripts/cgi-bin/quecmanager/experimental/
├── realtime_speed_monitor.sh          # Main monitoring script
└── speed_monitor_control.sh           # CGI control endpoint

hooks/
└── use-realtime-speed.ts              # React WebSocket hook

components/experimental/
└── realtime-speed-monitor.tsx         # React component
```

## Configuration

### Network Interface
By default, the monitor uses `rmnet_data0`. To change this:

1. Edit `realtime_speed_monitor.sh`
2. Change the `INTERFACE` variable:
   ```bash
   INTERFACE="your_interface_name"  # e.g., wwan0, eth0, etc.
   ```

### WebSocket Port
Default port is `8080`. To change:

1. Edit `realtime_speed_monitor.sh`:
   ```bash
   WEBSOCKET_PORT="8080"  # Change to desired port
   ```

2. Update the React hook in `use-realtime-speed.ts`:
   ```typescript
   websocketUrl: 'ws://127.0.0.1:YOUR_PORT'
   ```

## Usage

### Starting the Monitor
Via CGI endpoint:
```bash
curl -X POST -H "Content-Type: application/json" \
     -d '{"action":"start"}' \
     http://your-device/cgi-bin/quecmanager/experimental/speed_monitor_control.sh
```

Via direct script:
```bash
/www/cgi-bin/quecmanager/experimental/realtime_speed_monitor.sh start
```

### Stopping the Monitor
```bash
curl -X POST -H "Content-Type: application/json" \
     -d '{"action":"stop"}' \
     http://your-device/cgi-bin/quecmanager/experimental/speed_monitor_control.sh
```

### Checking Status
```bash
curl -X GET \
     http://your-device/cgi-bin/quecmanager/experimental/speed_monitor_control.sh
```

## Data Format

The WebSocket sends JSON data with the following structure:

```json
{
  "download_kbps": 1500,
  "upload_kbps": 200,
  "download_mbps": 1.5,
  "upload_mbps": 0.2,
  "interface": "rmnet_data0",
  "timestamp": 1640995200
}
```

## Troubleshooting

### Common Issues

1. **WebSocket connection fails**
   - Check if websocat is installed: `which websocat`
   - Verify the monitoring service is running: `pgrep -f websocat`
   - Check if the port is available: `netstat -ln | grep :8080`

2. **Interface not found error**
   - List available interfaces: `ls /sys/class/net/`
   - Update the `INTERFACE` variable in the script

3. **Permission errors**
   - Ensure scripts are executable: `chmod +x /www/cgi-bin/quecmanager/experimental/*.sh`
   - Check CGI permissions in web server configuration

### Logs and Debugging

Monitor system logs for errors:
```bash
logread | grep -i "speed\|websocat"
```

Check process status:
```bash
ps | grep websocat
```

### Performance Considerations

- The monitor updates every second by default
- WebSocket data frames are small (~100 bytes each)
- History is limited to 60 data points (1 minute) in the UI
- CPU usage is minimal due to efficient WebSocket implementation

## Security Notes

- The WebSocket server binds to 127.0.0.1 (localhost only)
- No authentication is implemented - suitable for local device access only
- Consider implementing authentication for remote access scenarios

## Customization

### Changing Update Interval
Edit the `sleep 1` line in `realtime_speed_monitor.sh` to change update frequency:
```bash
sleep 0.5  # 500ms updates (higher frequency)
sleep 2    # 2-second updates (lower frequency)
```

### Adding Additional Metrics
The monitoring script can be extended to include:
- Latency measurements
- Signal strength correlation
- Interface statistics (errors, drops)
- Multi-interface monitoring

### UI Customization
The React component supports:
- Chart customization via recharts props
- Custom styling with Tailwind classes  
- Additional statistics display
- Export functionality

## Architecture Overview

```
[Shell Script] → [WebSocket via websocat] → [React Frontend]
     ↑                    ↑                        ↑
[Network Stats]    [JSON Data Stream]      [Live UI Updates]
```

1. **Data Collection**: Shell script reads network statistics from `/sys/class/net/`
2. **Data Streaming**: websocat provides WebSocket server functionality
3. **Real-time Updates**: React hook manages connection and state
4. **UI Display**: Component renders live charts and statistics