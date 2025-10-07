# Quick Reference: Debugging Upgrade Issues

## 1. View Logs Immediately After Upgrade Attempt

```bash
# SSH into OpenWrt device, then:
tail -n 100 /tmp/quecmanager/logs/settings/upgrade_package.log
```

## 2. What to Look For in Logs

### Successful Upgrade
```
[INFO] [upgrade_package] Upgrade package script started
[INFO] [upgrade_package] Detected stable package: sdxpinn-quecmanager
[INFO] [upgrade_package] Current version: 2.3.2
[INFO] [upgrade_package] Available version: 2.4.0
[INFO] [upgrade_package] Starting upgrade from 2.3.2 to 2.4.0
[DEBUG] [upgrade_package] Running: opkg upgrade sdxpinn-quecmanager
[DEBUG] [upgrade_package] Upgrade exit code: 0
[INFO] [upgrade_package] Upgrade successful! New version: 2.4.0
```

### Failed Upgrade - Package Not Found
```
[ERROR] [upgrade_package] No QuecManager package found to upgrade
[DEBUG] [upgrade_package] Found packages: none
```
**Fix**: Check if package is actually installed with `opkg list-installed | grep quecmanager`

### Failed Upgrade - Already Updated
```
[WARN] [upgrade_package] Package is already at latest version: 2.4.0
```
**This is OK**: Package is already up to date

### Failed Upgrade - Network Error
```
[ERROR] [upgrade_package] Upgrade failed with exit code 255
[ERROR] [upgrade_package] Error output: wget: download timed out
```
**Fix**: Check internet connection

### Failed Upgrade - Insufficient Space
```
[ERROR] [upgrade_package] Upgrade failed with exit code 4
[ERROR] [upgrade_package] Error output: not enough space
```
**Fix**: Free up space with `rm -rf /tmp/*` and try again

## 3. Browser Console Debugging

1. Open Developer Tools (F12)
2. Go to Console tab
3. Click "Install Update" button
4. Look for:

```javascript
// Successful
Upgrade response: {
  status: "success",
  new_version: "2.4.0",
  ...
}

// Failed
Upgrade response: {
  status: "error",
  exit_code: 1,
  error: "detailed error message",
  ...
}
```

## 4. Manual Testing Commands

```bash
# Check what's installed
opkg list-installed | grep quecmanager

# Check what's available
opkg update
opkg list | grep quecmanager

# Try manual upgrade
opkg upgrade sdxpinn-quecmanager

# If it fails, check:
df -h                          # Disk space
ping 8.8.8.8                  # Internet
cat /etc/opkg.conf            # Repository config
```

## 5. Script Permissions (if logs don't appear)

```bash
chmod +x /www/cgi-bin/quecmanager/settings/upgrade_package.sh
chmod +x /www/cgi-bin/quecmanager/settings/check_package_info.sh
chmod +x /www/cgi-bin/quecmanager/settings/update_package_list.sh
```

## 6. View Logs via API (alternative to SSH)

```bash
curl "http://192.168.225.1/cgi-bin/quecmanager/settings/view_logs.sh?script=upgrade_package&category=settings&lines=100"
```

## 7. Common Exit Codes

- **0**: Success
- **1**: General error (check error message)
- **4**: Insufficient space
- **255**: Network error

## 8. Test Script Directly

```bash
# Run the upgrade script manually to see output
/www/cgi-bin/quecmanager/settings/upgrade_package.sh
```

## Need More Help?

See full debugging guide: `docs/PACKAGE_UPDATE_DEBUGGING.md`
