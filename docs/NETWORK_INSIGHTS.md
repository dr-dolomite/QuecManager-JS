# Network Insights Interpreter

A comprehensive network monitoring3. **Service Integration**: The service is automatically managed by QuecManager services:
   ```bash
   # Service is started automatically with QuecManager
   /etc/init.d/quecmanager_services start
   
   # Check service status
   /etc/init.d/quecmanager_services status
   ```hat analyzes cellular modem data and provides human-readable interpretations of network changes.

## Overview

The Network Insights Interpreter monitors your cellular modem's QCAINFO data and automatically detects and categorizes network events:

- **Band Changes**: When your modem switches between different LTE or NR5G bands
- **Carrier Aggregation Events**: When CA is activated/deactivated or carrier count changes
- **Network Mode Changes**: Transitions between LTE, 5G SA, and NSA modes
- **Signal Events**: Signal loss and restoration events

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ log_signal_     │    │ network_insights_│    │ React Dashboard │
│ metrics.sh      │───▶│ interpreter.sh   │───▶│ Component       │
│                 │    │                  │    │                 │
│ Logs QCAINFO    │    │ Analyzes Changes │    │ Displays Events │
│ every 60s       │    │ every 61s        │    │ with UI         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ qcainfo.json    │    │ interpreted_     │    │ Network Insights│
│ /www/signal_    │    │ result.json      │    │ Web Page        │
│ graphs/         │    │ /tmp/            │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Files Structure

### Core Scripts

- `scripts/cgi-bin/services/network_insights_interpreter.sh` - Main interpreter daemon
- `scripts/cgi-bin/quecmanager/experimental/fetch_interpretations.sh` - Data fetcher
- `scripts/etc/init.d/quecmanager_services` - Service management (includes network insights)

### Frontend Components

- `app/dashboard/experimental/network-insights/page.tsx` - Main UI page
- `hooks/use-network-interpretations.ts` - React hook for data fetching

### Data Files
- `/www/signal_graphs/qcainfo.json` - Raw QCAINFO data (input)
- `/tmp/interpreted_result.json` - Generated interpretations (output)
- `/tmp/last_qcainfo_entry.json` - Processing state

## Installation

1. **Deploy Scripts**: Copy all scripts to their respective locations on the router
   ```bash
   # Copy interpreter script
   cp scripts/cgi-bin/services/network_insights_interpreter.sh /scripts/cgi-bin/services/
   chmod +x /scripts/cgi-bin/services/network_insights_interpreter.sh
   
   # Copy service management
   cp scripts/cgi-bin/quecmanager/experimental/network_insights_service.sh /scripts/cgi-bin/quecmanager/experimental/
   chmod +x /scripts/cgi-bin/quecmanager/experimental/network_insights_service.sh
   ```

2. **Ensure Dependencies**: Make sure the following are available:
   - `jq` command for JSON processing
   - Signal metrics logging is active (generates qcainfo.json)
   - Web server with CGI support

3. **Start Service**: Either via web interface or command line:
   ```bash
   # Via command line
   /scripts/cgi-bin/quecmanager/experimental/network_insights_service.sh start
   
   # Via web interface
   # Navigate to Dashboard → Experimental → Network Insights
   # Use the service management card to start the service
   ```

## Usage

### Web Interface

1. **Navigate** to Dashboard → Experimental → Network Insights
2. **View Events**: Real-time display of network events with color-coded categories
3. **Statistics**: Overview of event counts by category

Note: The monitoring service runs automatically as part of QuecManager services.

### Command Line

```bash
# Check overall service status
/etc/init.d/quecmanager_services status

# Restart all QuecManager services (including network insights)
/etc/init.d/quecmanager_services restart

# Process current data once (manual test)
/scripts/cgi-bin/services/network_insights_interpreter.sh process
```

## Event Categories

### Band Changes
- **Detection**: Changes in LTE BAND or NR5G BAND entries
- **Examples**:
  - "New bands added: B1, B7"
  - "Bands removed: B3"
  - "Band sequence changed from (B1,B3) to (B3,B7)"

### Carrier Aggregation
- **Detection**: Changes in carrier count
- **Examples**:
  - "Carrier Aggregation activated - Now using 3 carriers"
  - "Carrier Aggregation deactivated - Single carrier mode"
  - "Additional carriers aggregated - Carriers increased from 2 to 4"

### Network Mode Changes
- **Detection**: Mode transitions between LTE/SA/NSA
- **Logic**:
  - LTE only: Only LTE BAND entries present
  - 5G SA: Only NR5G BAND entries present  
  - NSA: Both LTE BAND and NR5G BAND entries present
- **Examples**:
  - "Network mode changed from LTE to NSA"
  - "Network mode changed from NSA to 5G SA"

### Signal Events
- **Detection**: Absence or presence of signal data
- **Examples**:
  - "Signal lost - No cellular connection detected"
  - "Signal restored - Connected to LTE network (B3)"

## Configuration

### Timing Settings
```bash
# In network_insights_interpreter.sh
SLEEP_INTERVAL=61  # Check for changes every 61 seconds
MAX_INTERPRETATIONS=50  # Keep last 50 interpretations

# In use-network-interpretations.ts
autoRefreshInterval=30000  # Refresh UI every 30 seconds
```

### File Locations
```bash
# Data files
QCAINFO_FILE="/www/signal_graphs/qcainfo.json"
INTERPRETED_FILE="/tmp/interpreted_result.json"
LAST_ENTRY_FILE="/tmp/last_qcainfo_entry.json"

# Lock and log files
LOCKFILE="/tmp/network_interpreter.lock"
LOGFILE="/tmp/network_interpreter.log"
```

## Troubleshooting

### Service Won't Start

1. Check if script is executable: `ls -la /scripts/cgi-bin/services/network_insights_interpreter.sh`
2. Verify dependencies: `which jq` and check for qcainfo.json
3. Check QuecManager services: `/etc/init.d/quecmanager_services status`
4. Check system logs: `logread | grep network_interpreter`

### No Interpretations Generated
1. Verify qcainfo.json exists and has data: `cat /www/signal_graphs/qcainfo.json`
2. Check if service is processing: `ps aux | grep network_insights`
3. Run test mode: `/scripts/cgi-bin/services/network_insights_interpreter.sh test`

### Parsing Issues
1. Check QCAINFO format - ensure it contains proper "LTE BAND" or "NR5G BAND" strings
2. Verify JSON structure in qcainfo.json
3. Test band parsing functions individually

### Web Interface Issues
1. Check CGI permissions and web server configuration
2. Verify fetch_interpretations.sh is accessible
3. Check browser console for JavaScript errors

## Testing

Use the provided test scripts to validate functionality:

```bash
# Test band parsing logic
./scripts/test_band_parsing.sh

# Test with sample data (local environment)
./scripts/test_network_insights_local.sh

# Test processing manually on router
/scripts/cgi-bin/services/network_insights_interpreter.sh process
```

## Example Interpretations

Real-world examples of generated interpretations:

```json
[
  {
    "datetime": "2025-08-24 19:20:53", 
    "interpretation": "Signal lost - No cellular connection detected"
  },
  {
    "datetime": "2025-08-24 19:21:55",
    "interpretation": "Signal restored - Connected to LTE network (B1,B3); Carrier Aggregation activated - Now using 3 carriers"
  },
  {
    "datetime": "2025-08-24 19:25:02",
    "interpretation": "Network mode changed from LTE to NSA; New bands added: N41"
  }
]
```

## Performance Notes

- **Memory Usage**: Minimal - processes data sequentially and maintains small JSON files
- **CPU Impact**: Low - only processes when changes are detected
- **Storage**: Limited to configured MAX_INTERPRETATIONS (default: 50 events)
- **Network**: No external dependencies, all processing is local

## Future Enhancements

Potential improvements for future versions:

1. **Advanced Metrics**: RSRP/RSRQ change detection
2. **Alerting**: Push notifications for critical events
3. **Historical Analysis**: Long-term trend analysis
4. **Export Functions**: CSV/PDF export of event history
5. **Custom Rules**: User-configurable interpretation rules
6. **Performance Metrics**: CA efficiency analysis
