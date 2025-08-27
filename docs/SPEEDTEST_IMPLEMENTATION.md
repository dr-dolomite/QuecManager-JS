# Speedtest Implementation for OpenWRT

This document describes the improved speedtest implementation designed to work reliably with OpenWRT and busybox.

## Overview

The speedtest feature allows users to test their internet connection speed (download, upload, and latency) directly from the web interface. The implementation consists of frontend React components and backend shell scripts.

## Backend Scripts

All scripts are located in `/www/cgi-bin/quecmanager/home/speedtest/` on the OpenWRT device.

### Scripts Overview

1. **start_speedtest.sh** - Initiates a new speedtest
2. **speedtest_status.sh** - Returns current test status and results
3. **stop_speedtest.sh** - Stops/cancels a running test
4. **check_speedtest.sh** - Verifies speedtest binary installation
5. **cleanup_speedtest.sh** - Cleans up stale files and processes

### Features

- **Busybox Compatibility**: All scripts use only POSIX shell features compatible with busybox
- **Process Management**: Proper PID tracking and cleanup
- **Timeout Protection**: 5-minute timeout to prevent hung processes
- **Error Handling**: Comprehensive error detection and reporting
- **File Validation**: JSON validation and file integrity checks
- **Automatic Cleanup**: Stale file detection and removal

## Installation

### Prerequisites

1. Speedtest CLI binary must be installed on OpenWRT:
   ```bash
   # Download and install speedtest binary
   wget -O /usr/bin/speedtest https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-aarch64.tgz
   chmod +x /usr/bin/speedtest
   ```

2. Accept the license (first time only):
   ```bash
   speedtest --accept-license
   ```

### Script Installation

1. Copy all scripts to `/www/cgi-bin/quecmanager/home/speedtest/`
2. Make scripts executable:
   ```bash
   chmod +x /www/cgi-bin/quecmanager/home/speedtest/*.sh
   ```

3. Verify installation:
   ```bash
   curl "http://your-device/cgi-bin/quecmanager/home/speedtest/check_speedtest.sh"
   ```

## Usage

### Starting a Test

```javascript
fetch('/cgi-bin/quecmanager/home/speedtest/start_speedtest.sh')
  .then(response => response.json())
  .then(data => console.log(data));
```

Expected response:
```json
{"status":"started","timestamp":1640995200}
```

### Checking Status

```javascript
fetch('/cgi-bin/quecmanager/home/speedtest/speedtest_status.sh')
  .then(response => response.json())
  .then(data => console.log(data));
```

Possible responses:
- `{"status":"not_running","timestamp":...}` - No test running
- `{"status":"initializing","message":"...","timestamp":...}` - Test starting
- `{"type":"ping","ping":{"progress":0.5},...}` - Ping test in progress
- `{"type":"download","download":{"bandwidth":...},...}` - Download test
- `{"type":"upload","upload":{"bandwidth":...},...}` - Upload test
- `{"type":"result","download":{},"upload":{},"ping":{},...}` - Final results

### Stopping a Test

```javascript
fetch('/cgi-bin/quecmanager/home/speedtest/stop_speedtest.sh')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Health Check

```javascript
fetch('/cgi-bin/quecmanager/home/speedtest/check_speedtest.sh')
  .then(response => response.json())
  .then(data => console.log(data));
```

## Frontend Implementation

The React component (`speedtest-card.tsx`) handles:

- **State Management**: Tracks test progress and results
- **Polling**: Regular status updates during test execution
- **Error Handling**: User-friendly error messages
- **UI States**: Loading, testing, results, and error states
- **Session Storage**: Persists results between page refreshes
- **Cooldown**: Prevents rapid test execution

### Key Features

- Real-time progress updates
- Visual speed indicators
- Detailed connection information
- Test cancellation
- Error recovery
- Results persistence

## Troubleshooting

### Common Issues

1. **Test gets stuck at "Starting"**
   - Check if speedtest binary is installed: `which speedtest`
   - Verify binary permissions: `ls -la $(which speedtest)`
   - Check license acceptance: `speedtest --help`

2. **Process cleanup issues**
   - Run cleanup script: `curl .../cleanup_speedtest.sh`
   - Manually kill processes: `killall speedtest`

3. **Permission errors**
   - Ensure scripts are executable: `chmod +x *.sh`
   - Check web server permissions

4. **JSON parsing errors**
   - Verify speedtest output format: `speedtest --format=json`
   - Check for binary corruption

### Debug Information

Logs are written to `/tmp/speedtest.log` during test execution. Check this file for detailed error information.

### Manual Testing

Test scripts manually:
```bash
# Check binary
/www/cgi-bin/quecmanager/home/speedtest/check_speedtest.sh

# Start test
/www/cgi-bin/quecmanager/home/speedtest/start_speedtest.sh

# Check status
/www/cgi-bin/quecmanager/home/speedtest/speedtest_status.sh

# Stop test
/www/cgi-bin/quecmanager/home/speedtest/stop_speedtest.sh

# Cleanup
/www/cgi-bin/quecmanager/home/speedtest/cleanup_speedtest.sh
```

## Security Considerations

- Scripts validate input and sanitize output
- No user input is directly executed
- Temporary files use secure permissions
- Process isolation prevents system interference
- Timeout protection prevents resource exhaustion

## Performance Notes

- Tests use minimal system resources
- Background execution doesn't block web interface
- Automatic cleanup prevents file accumulation
- Configurable timeouts prevent hung processes
- Optimized polling intervals balance responsiveness and efficiency
