# URGENT FIX: Upgrade Script Hanging Issue

## Problem
The upgrade script was getting stuck at:
```
[2025-10-04 17:01:06] [DEBUG] [upgrade_package] [PID:23384] Running: opkg upgrade sdxpinn-quecmanager-beta
```

**Root Cause**: `opkg upgrade` was waiting for interactive user confirmation (y/n prompt).

## Solution Applied ✅

### Changed the upgrade command:

**BEFORE (hanging):**
```bash
opkg upgrade sdxpinn-quecmanager-beta
```

**AFTER (non-interactive):**
```bash
timeout 120 opkg install --force-reinstall --force-overwrite sdxpinn-quecmanager-beta
```

### What Changed:

1. ✅ **Replaced `opkg upgrade` with `opkg install`**
   - `--force-reinstall`: Installs without asking
   - `--force-overwrite`: Overwrites files without prompting

2. ✅ **Added 120-second timeout**
   - Prevents infinite hanging
   - Returns proper error if it takes too long

3. ✅ **Added timeout detection**
   - Exit code 124 = timeout
   - Logs clear error message

4. ✅ **Added pre-validation**
   - Checks if package version is available
   - Better error messages

## What You Should See Now

### In Logs:
```log
[INFO] Starting upgrade from 2.3.2 to 2.4.0
[DEBUG] Running: opkg install --force-reinstall --force-overwrite sdxpinn-quecmanager-beta
[DEBUG] Upgrade timeout set to 120 seconds
[DEBUG] Upgrade exit code: 0
[DEBUG] Upgrade output: <opkg output>
[INFO] Upgrade successful! New version: 2.4.0
```

### If It Times Out:
```log
[ERROR] Upgrade timed out after 120 seconds
```

## Test It Now

1. **Try the upgrade again** in the UI

2. **Monitor the logs**:
   ```bash
   tail -f /tmp/quecmanager/logs/settings/upgrade_package.log
   ```

3. **Expected behavior**:
   - Should complete within 1-2 minutes
   - No hanging
   - Clear success or error message

## If It Still Fails

### Check These:

1. **Internet connectivity**:
   ```bash
   ping 8.8.8.8
   ```

2. **Repository access**:
   ```bash
   opkg update
   opkg list | grep quecmanager
   ```

3. **Disk space**:
   ```bash
   df -h
   ```

4. **Manual test**:
   ```bash
   timeout 120 opkg install --force-reinstall --force-overwrite sdxpinn-quecmanager-beta
   ```

## Why This Works

- `opkg upgrade` asks "Do you want to continue? [Y/n]"
- CGI scripts can't respond to interactive prompts
- `opkg install --force-reinstall` doesn't ask, just does it
- Timeout ensures it won't hang forever

## Files Modified

- ✅ `scripts/cgi-bin/quecmanager/settings/upgrade_package.sh`

## Documentation

- See `docs/UPGRADE_TIMEOUT_FIX.md` for detailed explanation
- See `docs/PACKAGE_UPDATE_DEBUGGING.md` for troubleshooting

---

**Try it now and it should work!** 🎉
