# QuecManager Package Update System

## Overview
This feature allows users to check for and install updates to QuecManager directly from the web interface using OpenWrt's built-in `opkg` package manager.

## Features

### Package Detection
- Automatically detects which QuecManager package is installed:
  - **Stable**: `sdxpinn-quecmanager`
  - **Beta**: `sdxpinn-quecmanager-beta`
- Displays current version and package type (Stable/Beta badge)

### Update Checking
- Fetches latest available version from OpenWrt repositories
- Compares installed version with available version
- Updates package list using `opkg update`

### Package Upgrade
- One-click upgrade to latest version
- Maintains the same package type (stable stays stable, beta stays beta)
- Provides feedback on upgrade success/failure

## Backend Scripts

### 1. check_package_info.sh
**Location**: `scripts/cgi-bin/quecmanager/settings/check_package_info.sh`

**Purpose**: Returns information about the installed QuecManager package

**Response Format**:
```json
{
  "status": "success",
  "installed": {
    "package": "sdxpinn-quecmanager",
    "version": "2.3.2",
    "type": "stable"
  },
  "available": {
    "version": "2.4.0",
    "update_available": true
  }
}
```

**OpenWrt Commands Used**:
- `opkg list-installed` - Lists installed packages
- `opkg list` - Lists available packages

### 2. update_package_list.sh
**Location**: `scripts/cgi-bin/quecmanager/settings/update_package_list.sh`

**Purpose**: Updates the package list from repositories

**Response Format**:
```json
{
  "status": "success",
  "message": "Package list updated successfully",
  "timestamp": "2025-10-04T12:00:00+00:00"
}
```

**OpenWrt Commands Used**:
- `opkg update` - Downloads package lists from repositories

### 3. upgrade_package.sh
**Location**: `scripts/cgi-bin/quecmanager/settings/upgrade_package.sh`

**Purpose**: Upgrades the installed QuecManager package

**Response Format**:
```json
{
  "status": "success",
  "message": "QuecManager upgraded successfully",
  "package": "sdxpinn-quecmanager",
  "new_version": "2.4.0",
  "timestamp": "2025-10-04T12:00:00+00:00"
}
```

**OpenWrt Commands Used**:
- `opkg upgrade <package>` - Upgrades specified package

## Frontend Component

### quemanager-update.tsx
**Location**: `components/settings/quemanager-update.tsx`

**Features**:
- Real-time package information display
- Visual distinction between Stable and Beta versions (badges)
- Loading states for all async operations
- Error handling with user-friendly messages
- Toast notifications for actions
- Empty state when no updates available
- Alert banner when updates are available

**State Management**:
```typescript
interface PackageInfo {
  installed: {
    package: string;
    version: string;
    type: "stable" | "beta";
  };
  available: {
    version: string;
    update_available: boolean;
  };
}
```

**UI States**:
1. **Loading**: Shows spinner while fetching initial data
2. **Error**: Displays error alert if package info cannot be fetched
3. **No Update**: Empty state with current version and "Check for Updates" button
4. **Update Available**: Alert with version comparison and "Install Update" button

## User Flow

### Checking for Updates
1. User clicks "Check for Updates" button
2. Frontend calls `update_package_list.sh` to refresh repository data
3. Frontend calls `check_package_info.sh` to get updated package info
4. UI updates to show if new version is available

### Installing Updates
1. User clicks "Install Update" button (only shown if update available)
2. Frontend calls `upgrade_package.sh`
3. Backend uses `opkg upgrade` to install new version
4. Success toast notification shows new version
5. Package info refreshes automatically

## Error Handling

### Backend Scripts
- Check exit codes from `opkg` commands
- Return structured error responses with messages
- Include stderr output in error responses

### Frontend Component
- Network errors caught and displayed
- Loading states prevent multiple simultaneous operations
- Disabled buttons during async operations
- Toast notifications for all actions

## Security Considerations

### Script Permissions
All CGI scripts should be executable:
```bash
chmod +x scripts/cgi-bin/quecmanager/settings/check_package_info.sh
chmod +x scripts/cgi-bin/quecmanager/settings/update_package_list.sh
chmod +x scripts/cgi-bin/quecmanager/settings/upgrade_package.sh
```

### Authentication
- These scripts should be protected by the existing authentication system
- Only authenticated users should access update functionality

### Package Integrity
- `opkg` verifies package signatures from repositories
- Only upgrades packages that are already installed
- Cannot switch between stable and beta versions automatically

## Testing Recommendations

### Backend Testing
```bash
# Test package info retrieval
curl http://192.168.225.1/cgi-bin/quecmanager/settings/check_package_info.sh

# Test package list update
curl http://192.168.225.1/cgi-bin/quecmanager/settings/update_package_list.sh

# Test package upgrade (use with caution)
curl http://192.168.225.1/cgi-bin/quecmanager/settings/upgrade_package.sh
```

### Frontend Testing
1. **Initial Load**: Verify correct version and type are displayed
2. **No Update Available**: Check empty state displays correctly
3. **Update Available**: Trigger by having older version installed
4. **Check for Updates**: Verify button works and updates package list
5. **Install Update**: Test upgrade process (use test environment)
6. **Error States**: Test with network failures or opkg errors

## Maintenance Notes

### Package Version Format
- OpenWrt packages typically use semantic versioning (e.g., `2.3.2-1`)
- Version comparison is handled by `opkg` internally

### Repository Configuration
- Ensure OpenWrt repositories are properly configured in `/etc/opkg.conf`
- Custom repositories for QuecManager should be added if needed

### Upgrade Limitations
- Upgrades within same package type only (stable → stable, beta → beta)
- To switch between stable and beta, manual intervention required
- May require router reboot after upgrade (handle in separate feature)

## Future Enhancements

1. **Changelog Display**: Show what's new in the update
2. **Auto-Check**: Periodic automatic checking for updates
3. **Update Notifications**: Banner notification when update available
4. **Scheduled Updates**: Allow scheduling updates for specific times
5. **Rollback Feature**: Ability to downgrade to previous version
6. **Package Switching**: UI to switch between stable and beta versions
7. **Update History**: Log of past updates with timestamps

## Dependencies

### Backend
- OpenWrt `opkg` package manager
- Shell utilities: `grep`, `awk`, `date`

### Frontend
- React hooks: `useState`, `useEffect`
- UI components: Card, Button, Badge, Alert, Empty, Toast
- Lucide icons: CloudDownloadIcon, RefreshCcwIcon, BellDotIcon, etc.

## File Structure
```
scripts/cgi-bin/quecmanager/settings/
├── check_package_info.sh      # Get package information
├── update_package_list.sh     # Update package lists
└── upgrade_package.sh         # Perform package upgrade

components/settings/
└── quemanager-update.tsx      # Main update UI component

docs/
└── PACKAGE_UPDATE_SYSTEM.md   # This documentation
```
