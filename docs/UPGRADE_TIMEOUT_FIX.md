# QuecManager Upgrade Script - Timeout Fix

## Issue

The `opkg upgrade` command was hanging/getting stuck because it was waiting for user confirmation in interactive mode.

## Solution

Changed from `opkg upgrade` to `opkg install --force-reinstall --force-overwrite` with a timeout.

### Changes Made

1. **Replaced `opkg upgrade` with `opkg install`**:
   ```bash
   # OLD (hangs waiting for input):
   opkg upgrade sdxpinn-quecmanager-beta
   
   # NEW (non-interactive):
   opkg install --force-reinstall --force-overwrite sdxpinn-quecmanager-beta
   ```

2. **Added timeout (2 minutes)**:
   - Prevents script from hanging indefinitely
   - Returns proper error if timeout occurs
   - Exit code 124 indicates timeout

3. **Added flags**:
   - `--force-reinstall`: Allows installing same/newer version over existing
   - `--force-overwrite`: Overwrites existing files without prompting
   
4. **Added pre-upgrade validation**:
   - Checks if available version exists in package list
   - Suggests running "Check for Updates" if not found

## Testing

After this change, the upgrade should:

1. ✅ Not hang/freeze
2. ✅ Complete within 2 minutes or timeout with error
3. ✅ Show detailed progress in logs
4. ✅ Return proper error messages

## Monitoring

Watch the logs to see progress:

```bash
tail -f /tmp/quecmanager/logs/settings/upgrade_package.log
```

You should see:
```log
[INFO] Starting upgrade from X.X.X to Y.Y.Y
[DEBUG] Running: opkg install --force-reinstall --force-overwrite sdxpinn-quecmanager-beta
[DEBUG] Upgrade timeout set to 120 seconds
[DEBUG] Upgrade exit code: 0
[INFO] Upgrade successful! New version: Y.Y.Y
```

## Timeout Scenarios

If timeout occurs (120 seconds):
```log
[ERROR] Upgrade timed out after 120 seconds
```

This could indicate:
- Slow internet connection
- Large package download
- Repository unavailable
- System performance issues

## Manual Override

If you need to run manually with different options:

```bash
# Force upgrade with all overrides
opkg install --force-reinstall --force-overwrite --force-depends sdxpinn-quecmanager-beta

# With download retry
opkg install --force-reinstall --force-overwrite sdxpinn-quecmanager-beta || \
  (sleep 5 && opkg install --force-reinstall --force-overwrite sdxpinn-quecmanager-beta)
```

## Rollback

If upgrade causes issues:

```bash
# List available versions
opkg list sdxpinn-quecmanager-beta

# Install specific older version
opkg install sdxpinn-quecmanager-beta=2.3.2-1 --force-downgrade
```

## Related Files

- `scripts/cgi-bin/quecmanager/settings/upgrade_package.sh` - Main upgrade script
- `/tmp/quecmanager/logs/settings/upgrade_package.log` - Upgrade logs

## Exit Codes

- **0**: Success
- **1**: General error
- **4**: Insufficient space
- **124**: Timeout (script-specific)
- **255**: Network error
