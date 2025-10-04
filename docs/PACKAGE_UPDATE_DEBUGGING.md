# QuecManager Package Update - Debugging Guide

## Overview
This guide helps you debug issues with the QuecManager package update system using the comprehensive logging that has been added.

## Log Locations

All logs are stored in `/tmp/quecmanager/logs/settings/`:

- `check_package_info.log` - Package detection and version checking
- `update_package_list.log` - Package list updates (opkg update)
- `upgrade_package.log` - Package upgrade operations

## Viewing Logs

### Method 1: Via SSH/Terminal

Connect to your OpenWrt device via SSH and run:

```bash
# View upgrade package log (most recent 50 lines)
tail -n 50 /tmp/quecmanager/logs/settings/upgrade_package.log

# View all logs in real-time
tail -f /tmp/quecmanager/logs/settings/upgrade_package.log

# View package info check log
tail -n 50 /tmp/quecmanager/logs/settings/check_package_info.log

# View update list log
tail -n 50 /tmp/quecmanager/logs/settings/update_package_list.log
```

### Method 2: Via CGI Script

You can fetch logs via HTTP request:

```bash
# Get upgrade package logs
curl "http://192.168.225.1/cgi-bin/quecmanager/settings/view_logs.sh?script=upgrade_package&category=settings&lines=50"

# Get check package info logs
curl "http://192.168.225.1/cgi-bin/quecmanager/settings/view_logs.sh?script=check_package_info&category=settings&lines=50"

# List all available logs in settings category
curl "http://192.168.225.1/cgi-bin/quecmanager/settings/view_logs.sh?category=settings"
```

## Log Format

Each log entry follows this format:
```
[YYYY-MM-DD HH:MM:SS] [LEVEL] [SCRIPT_NAME] [PID:12345] Message
```

**Example:**
```
[2025-10-04 12:30:45] [INFO] [upgrade_package] [PID:12345] Upgrade package script started
[2025-10-04 12:30:45] [DEBUG] [upgrade_package] [PID:12345] Checking for installed QuecManager packages
[2025-10-04 12:30:45] [INFO] [upgrade_package] [PID:12345] Detected stable package: sdxpinn-quecmanager
```

### Log Levels
- **ERROR**: Critical failures
- **WARN**: Warnings and potential issues
- **INFO**: General information about operations
- **DEBUG**: Detailed debugging information

## Common Issues and Solutions

### Issue 1: Script Returns "No QuecManager package found"

**Symptoms:**
- Frontend shows "No QuecManager package found" error
- No update button appears

**Check the logs:**
```bash
tail -n 50 /tmp/quecmanager/logs/settings/check_package_info.log
```

**Look for:**
```
[ERROR] [check_package_info] No QuecManager package found
[DEBUG] [check_package_info] Stable version: none, Beta version: none
```

**Solution:**
1. Verify package is installed:
   ```bash
   opkg list-installed | grep quecmanager
   ```
2. Check if package names match exactly:
   - `sdxpinn-quecmanager` (stable)
   - `sdxpinn-quecmanager-beta` (beta)
3. If package name is different, update the script variables

### Issue 2: Upgrade Fails with Exit Code

**Symptoms:**
- Upgrade button clicked but fails
- Toast shows "Upgrade Failed" with exit code

**Check the logs:**
```bash
tail -n 50 /tmp/quecmanager/logs/settings/upgrade_package.log
```

**Look for:**
```
[INFO] [upgrade_package] Starting upgrade from 2.3.2 to 2.4.0
[DEBUG] [upgrade_package] Running: opkg upgrade sdxpinn-quecmanager
[DEBUG] [upgrade_package] Upgrade exit code: 1
[ERROR] [upgrade_package] Upgrade failed with exit code 1
[ERROR] [upgrade_package] Error output: <error message>
```

**Common Exit Codes:**
- **Exit Code 0**: Success
- **Exit Code 1**: General error
- **Exit Code 2**: Invalid arguments
- **Exit Code 4**: Insufficient space
- **Exit Code 255**: Network error

**Solutions based on error:**

1. **Insufficient space:**
   ```bash
   df -h
   # Free up space in /tmp or /overlay
   ```

2. **Network error:**
   ```bash
   ping 8.8.8.8
   # Check internet connectivity
   opkg update
   # Manually update package lists
   ```

3. **Package conflicts:**
   ```bash
   opkg upgrade --force-depends sdxpinn-quecmanager
   # Use with caution!
   ```

### Issue 3: Package Already at Latest Version

**Symptoms:**
- Upgrade button shows but clicking does nothing or shows info message

**Check the logs:**
```bash
tail -n 50 /tmp/quecmanager/logs/settings/upgrade_package.log
```

**Look for:**
```
[INFO] [upgrade_package] Current version: 2.4.0
[INFO] [upgrade_package] Available version: 2.4.0
[WARN] [upgrade_package] Package is already at latest version: 2.4.0
```

**Solution:**
This is expected behavior. The script now checks if upgrade is needed before attempting.

### Issue 4: Update List Fails

**Symptoms:**
- "Check for Updates" button fails
- Error: "Failed to update package list"

**Check the logs:**
```bash
tail -n 50 /tmp/quecmanager/logs/settings/update_package_list.log
```

**Look for:**
```
[INFO] [update_package_list] Update package list script started
[DEBUG] [update_package_list] Running: opkg update
[DEBUG] [update_package_list] Update exit code: 1
[ERROR] [update_package_list] Failed to update package list: <error>
```

**Solutions:**
1. Check internet connectivity
2. Verify repository URLs in `/etc/opkg.conf`
3. Check DNS resolution:
   ```bash
   nslookup downloads.openwrt.org
   ```

### Issue 5: Logs Don't Exist

**Symptoms:**
- Log files are missing
- Cannot read logs

**Solution:**
1. Ensure log directories are created:
   ```bash
   mkdir -p /tmp/quecmanager/logs/settings
   chmod 755 /tmp/quecmanager/logs/settings
   ```

2. Check if logging script is sourced correctly:
   ```bash
   ls -la /www/cgi-bin/services/quecmanager_logger.sh
   ```

3. Run a test to verify logging:
   ```bash
   /www/cgi-bin/quecmanager/settings/check_package_info.sh
   cat /tmp/quecmanager/logs/settings/check_package_info.log
   ```

## Manual Testing Commands

### Check Package Installation
```bash
# List installed QuecManager packages
opkg list-installed | grep quecmanager

# Check specific package
opkg list-installed sdxpinn-quecmanager
opkg list-installed sdxpinn-quecmanager-beta
```

### Check Available Versions
```bash
# Update package lists
opkg update

# Check available versions
opkg list | grep quecmanager
```

### Manual Upgrade (with verbose output)
```bash
# Dry run (simulate upgrade)
opkg upgrade --noaction sdxpinn-quecmanager

# Actual upgrade
opkg upgrade sdxpinn-quecmanager

# Force upgrade if needed
opkg upgrade --force-reinstall sdxpinn-quecmanager
```

## Frontend Console Debugging

Open browser Developer Tools (F12) and check the Console tab:

1. **Check for fetch errors:**
   Look for network errors or failed requests

2. **Inspect API responses:**
   All API responses are logged to console:
   ```javascript
   Upgrade response: {status: "error", message: "...", ...}
   ```

3. **View detailed error objects:**
   Failed upgrades log full error details:
   ```javascript
   Upgrade failed: {
     message: "Failed to upgrade QuecManager",
     error: "...",
     exit_code: 1,
     package: "sdxpinn-quecmanager",
     current_version: "2.3.2",
     available_version: "2.4.0"
   }
   ```

## Log Rotation

Logs are automatically rotated when they exceed 500KB:
- Current log: `script_name.log`
- First backup: `script_name.log.1`
- Second backup: `script_name.log.2`

Old backups (`.2` files) are automatically deleted after 1 day.

## Script Permissions

Ensure all scripts are executable:
```bash
chmod +x /www/cgi-bin/quecmanager/settings/check_package_info.sh
chmod +x /www/cgi-bin/quecmanager/settings/update_package_list.sh
chmod +x /www/cgi-bin/quecmanager/settings/upgrade_package.sh
chmod +x /www/cgi-bin/quecmanager/settings/view_logs.sh
```

## Reporting Issues

When reporting upgrade issues, please include:

1. **Log contents:**
   ```bash
   cat /tmp/quecmanager/logs/settings/upgrade_package.log
   ```

2. **Package information:**
   ```bash
   opkg list-installed | grep quecmanager
   opkg list | grep quecmanager
   ```

3. **System information:**
   ```bash
   uname -a
   cat /etc/openwrt_release
   df -h
   free
   ```

4. **Console output:**
   Browser Developer Tools Console tab screenshot or copy

## Additional Debugging

### Enable More Verbose Logging

Edit the scripts to change log level to DEBUG for all operations:
```bash
# Change from:
qm_log_info "settings" "$SCRIPT_NAME" "Message"

# To:
qm_log_debug "settings" "$SCRIPT_NAME" "Message"
```

### Test Scripts Directly via CLI

```bash
# Test check_package_info
/www/cgi-bin/quecmanager/settings/check_package_info.sh

# Test update_package_list
/www/cgi-bin/quecmanager/settings/update_package_list.sh

# Test upgrade_package
/www/cgi-bin/quecmanager/settings/upgrade_package.sh
```

## Best Practices

1. **Always check for updates before upgrade:**
   Click "Check for Updates" first to refresh package lists

2. **Review logs after each operation:**
   Check logs immediately after any failure

3. **Test on non-production device first:**
   Verify upgrade process on test device before production

4. **Keep backups:**
   Backup configuration before upgrading:
   ```bash
   sysupgrade -b /tmp/backup-$(date +%Y%m%d).tar.gz
   ```

5. **Monitor during upgrade:**
   Keep terminal/SSH connection open during upgrade to see any issues immediately
