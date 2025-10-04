# QuecManager Package Update System - Changelog

## Version: Enhanced with Comprehensive Logging

### Changes Made

#### 1. Enhanced Backend Scripts with Logging

**upgrade_package.sh**
- ✅ Added centralized logging system integration
- ✅ Logs script start and completion
- ✅ Logs package detection (stable vs beta)
- ✅ Logs current and available versions
- ✅ Checks if upgrade is needed before attempting (prevents unnecessary upgrades)
- ✅ Logs upgrade command execution
- ✅ Logs exit codes and error output
- ✅ Returns more detailed error information in JSON response
- ✅ Includes debug information in responses

**check_package_info.sh**
- ✅ Added logging system integration
- ✅ Logs package detection process
- ✅ Logs version checking
- ✅ Logs update availability determination
- ✅ Better error reporting

**update_package_list.sh**
- ✅ Added logging system integration
- ✅ Logs opkg update execution
- ✅ Logs exit codes and output
- ✅ Returns opkg output in JSON response

#### 2. New Log Viewer Script

**view_logs.sh** (NEW)
- Allows viewing logs via HTTP API
- Supports querying specific script logs
- Can list all available log files
- Configurable number of lines to return

#### 3. Enhanced Frontend Error Handling

**quemanager-update.tsx**
- ✅ Added console logging for all API responses
- ✅ Enhanced error messages with exit codes
- ✅ Shows detailed error information in toasts
- ✅ Logs complete error objects to console for debugging
- ✅ Handles "already up to date" scenario gracefully
- ✅ Better user feedback for all scenarios

#### 4. Documentation

**PACKAGE_UPDATE_DEBUGGING.md** (NEW)
- Complete debugging guide
- Log location and format documentation
- Common issues and solutions
- Manual testing commands
- Log viewing methods (SSH and API)
- Best practices

### Log Files Created

All logs stored in `/tmp/quecmanager/logs/settings/`:
- `upgrade_package.log` - Main upgrade operations
- `check_package_info.log` - Package detection and version checks
- `update_package_list.log` - Repository update operations

### Log Entry Format

```
[YYYY-MM-DD HH:MM:SS] [LEVEL] [SCRIPT_NAME] [PID:12345] Message
```

**Example:**
```
[2025-10-04 12:30:45] [INFO] [upgrade_package] [PID:12345] Upgrade package script started
[2025-10-04 12:30:45] [DEBUG] [upgrade_package] [PID:12345] Checking for installed QuecManager packages
[2025-10-04 12:30:45] [INFO] [upgrade_package] [PID:12345] Detected stable package: sdxpinn-quecmanager
[2025-10-04 12:30:45] [INFO] [upgrade_package] [PID:12345] Current version: 2.3.2
[2025-10-04 12:30:45] [INFO] [upgrade_package] [PID:12345] Available version: 2.4.0
[2025-10-04 12:30:45] [INFO] [upgrade_package] [PID:12345] Starting upgrade from 2.3.2 to 2.4.0
[2025-10-04 12:30:45] [DEBUG] [upgrade_package] [PID:12345] Running: opkg upgrade sdxpinn-quecmanager
[2025-10-04 12:30:50] [DEBUG] [upgrade_package] [PID:12345] Upgrade exit code: 0
[2025-10-04 12:30:50] [INFO] [upgrade_package] [PID:12345] Upgrade successful! New version: 2.4.0
[2025-10-04 12:30:50] [INFO] [upgrade_package] [PID:12345] Upgrade package script completed
```

### Debugging Methods

#### Via SSH/Terminal
```bash
# View upgrade logs
tail -n 50 /tmp/quecmanager/logs/settings/upgrade_package.log

# Follow logs in real-time
tail -f /tmp/quecmanager/logs/settings/upgrade_package.log
```

#### Via API
```bash
# Get upgrade logs via HTTP
curl "http://192.168.225.1/cgi-bin/quecmanager/settings/view_logs.sh?script=upgrade_package&category=settings&lines=50"
```

#### Browser Console
- Open Developer Tools (F12)
- Check Console tab for API responses
- All errors logged with full details

### Key Improvements

1. **Visibility**: Can now see exactly what's happening during upgrade
2. **Debugging**: Detailed logs help identify issues quickly
3. **Error Details**: Exit codes, error messages, and command output captured
4. **Prevention**: Checks if upgrade is needed before attempting
5. **User Feedback**: Better error messages in frontend
6. **API Access**: Can view logs via HTTP requests

### Common Issues Now Logged

- Package not found (with details of what was checked)
- Version already up to date (prevents unnecessary upgrade)
- Upgrade command failures (with exit codes)
- Network errors during package list update
- Insufficient space errors
- Package conflicts

### Next Steps for User

1. **Enable the scripts** (if not already):
   ```bash
   chmod +x /www/cgi-bin/quecmanager/settings/*.sh
   ```

2. **Try the upgrade again** and check logs:
   ```bash
   tail -n 100 /tmp/quecmanager/logs/settings/upgrade_package.log
   ```

3. **Review the debugging guide**:
   See `docs/PACKAGE_UPDATE_DEBUGGING.md` for detailed troubleshooting

4. **Check browser console**:
   Open F12 Developer Tools and look for logged errors

### Files Modified

1. `scripts/cgi-bin/quecmanager/settings/upgrade_package.sh`
2. `scripts/cgi-bin/quecmanager/settings/check_package_info.sh`
3. `scripts/cgi-bin/quecmanager/settings/update_package_list.sh`
4. `components/settings/quemanager-update.tsx`

### Files Created

1. `scripts/cgi-bin/quecmanager/settings/view_logs.sh`
2. `docs/PACKAGE_UPDATE_DEBUGGING.md`
3. `docs/PACKAGE_UPDATE_LOGGING_CHANGELOG.md` (this file)
