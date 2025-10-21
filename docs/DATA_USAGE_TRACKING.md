# Data Usage Tracking Feature

## Overview

The Data Usage Tracking feature provides comprehensive monitoring and management of monthly data consumption for QuecManager users. This experimental feature helps users stay within their data limits by providing real-time usage monitoring, configurable warnings, and automatic backup functionality.

## Features

### Core Functionality
- **Real-time Data Monitoring**: Tracks both 4G and 5G data usage (upload/download)
- **Monthly Limits**: Set custom monthly data limits with percentage-based warnings
- **Usage Warnings**: Configurable threshold warnings with home page notifications
- **Automatic Backups**: Periodic backup of usage data to prevent loss during reboots
- **Usage Reset**: Automatic monthly reset on specified day
- **Continuous Tracking**: Maintains usage counts across modem reboots

### User Interface
- **Dashboard Integration**: Clean, intuitive interface in the Experimental section
- **Progress Visualization**: Visual progress bars and usage statistics
- **Warning Dialogs**: Non-intrusive warning dialogs with actionable information
- **Home Page Banners**: Compact warning banners on the main dashboard
- **Settings Management**: Easy configuration of all tracking parameters

## Architecture

### Backend Components

1. **Configuration Manager** (`config_manager.sh`)
   - Handles all configuration CRUD operations
   - Manages usage calculations and threshold checking
   - Provides REST API for frontend communication

2. **Backup Service** (`backup_service.sh`)
   - Periodic backup of current usage data
   - Cumulative tracking across reboots
   - Configurable backup intervals (3, 6, 12, 24 hours)

3. **Cron Manager** (`cron_manager.sh`)
   - Manages automatic backup scheduling
   - Dynamic cron job management based on configuration
   - Service lifecycle management

4. **Installation Script** (`install.sh`)
   - One-command installation and setup
   - System integration and verification
   - Uninstallation and status checking

### Frontend Components

1. **Data Usage Hook** (`data-usage-tracking.ts`)
   - Centralized state management for usage data
   - Configuration updates and API communication
   - Real-time usage monitoring

2. **Main Component** (`data-usage-tracking.tsx`)
   - Primary interface for data usage management
   - Settings configuration and usage visualization
   - Action buttons for reset and backup operations

3. **Warning Components**
   - `data-usage-warning-dialog.tsx`: Full-featured warning dialogs
   - `data-usage-warning-banner.tsx`: Compact home page warnings
   - `home-data-usage-warning.ts`: Home page integration hook

## Installation

### On OpenWRT Device

1. **Transfer Scripts**: Copy all scripts from `scripts/cgi-bin/quecmanager/experimental/data_usage_tracking/` to your OpenWRT device

2. **Run Installation**:
   ```bash
   # Make installation script executable
   chmod +x /cgi-bin/quecmanager/experimental/data_usage_tracking/install.sh
   
   # Run installation as root
   /cgi-bin/quecmanager/experimental/data_usage_tracking/install.sh install
   ```

3. **Verify Installation**:
   ```bash
   /cgi-bin/quecmanager/experimental/data_usage_tracking/install.sh status
   ```

### Configuration

The feature will be available in the QuecManager web interface under:
**Dashboard → Experimental → Data Usage Tracking**

## Configuration Options

### Basic Settings
- **Enable/Disable Tracking**: Toggle the entire feature on/off
- **Monthly Limit**: Set data limit in GB (1-1000 GB)
- **Warning Threshold**: Percentage at which warnings are triggered (50-100%)
- **Monthly Reset Day**: Day of month when usage resets (1-28)
- **Backup Interval**: How often to backup usage data (3, 6, 12, 24 hours)

### Advanced Settings
- **Manual Reset**: Reset usage counters immediately
- **Force Backup**: Create immediate backup of current usage
- **Warning Dismissal**: Mark warnings as seen for current month

## Data Storage

### Configuration File
Location: `/etc/quecmanager/data_usage`

Contains:
- Feature enable/disable status
- Monthly limit in bytes
- Warning threshold percentage
- Backup interval
- Monthly reset day
- Stored usage from previous sessions
- Warning status flags

### Backup Files
Location: `/tmp/data_usage_backups/`

Contains timestamped JSON files with usage snapshots:
```json
{
  "timestamp": 1694567890,
  "datetime": "2025-09-12 10:30:00",
  "upload": 1073741824,
  "download": 5368709120,
  "total": 6442450944
}
```

### Log Files
- `/tmp/data_usage_config.log`: Configuration changes and operations
- `/tmp/data_usage_backup.log`: Backup service operations
- `/tmp/data_usage_cron.log`: Cron job management

## API Endpoints

### Configuration Management
- `GET /cgi-bin/quecmanager/experimental/data_usage_tracking/config_manager.sh`
  - Returns current configuration and usage data
- `POST /cgi-bin/quecmanager/experimental/data_usage_tracking/config_manager.sh`
  - Updates configuration with JSON payload

### Actions
- `GET /cgi-bin/quecmanager/experimental/data_usage_tracking/config_manager.sh?action=reset`
  - Resets usage counters to zero
- `GET /cgi-bin/quecmanager/experimental/data_usage_tracking/config_manager.sh?action=backup`
  - Creates immediate backup

### Service Management
- `GET /cgi-bin/quecmanager/experimental/data_usage_tracking/cron_manager.sh?action=status`
  - Returns cron job status

## Usage Examples

### Basic Setup
1. Navigate to **Dashboard → Experimental → Data Usage Tracking**
2. Toggle "Enable Tracking" to ON
3. Set your monthly limit (e.g., 50 GB)
4. Set warning threshold (e.g., 90%)
5. Choose backup interval (e.g., 12 hours)
6. Set monthly reset day (e.g., 1st of each month)
7. Click "Save"

### Monitoring Usage
- View real-time usage on the dashboard
- Monitor progress bar showing percentage used
- Check upload/download breakdown
- See remaining data allowance

### Handling Warnings
- Warnings appear automatically when threshold is reached
- Home page shows compact warning banners
- Click "Manage" to adjust settings
- Dismiss warnings to hide until next month

## Troubleshooting

### Common Issues

1. **Scripts Not Executable**
   ```bash
   chmod +x /usr/bin/quecmanager/experimental/data_usage_tracking/*.sh
   ```

2. **Cron Jobs Not Running**
   ```bash
   /usr/bin/data-usage-cron status
   /usr/bin/data-usage-cron update
   ```

3. **Configuration Not Saving**
   - Check directory permissions: `/etc/quecmanager/`
   - Verify web server has write access

4. **Usage Data Not Updating**
   - Ensure signal metrics service is running
   - Check `/www/signal_graphs/data_usage.json` exists and updates

### Diagnostic Commands

```bash
# Check installation status
/cgi-bin/quecmanager/experimental/data_usage_tracking/install.sh status

# Verify configuration
cat /etc/quecmanager/data_usage

# Test backup service
/usr/bin/data-usage-backup status

# Check logs
tail -f /tmp/data_usage_*.log

# Manual backup
/usr/bin/data-usage-backup force
```

## Security Considerations

- All data is stored locally on the device
- No external data transmission
- Configuration files have restricted permissions
- Backup files are temporary and auto-cleaned
- Scripts run with appropriate privilege levels

## Performance Impact

- **Minimal CPU Usage**: Scripts run only when needed
- **Low Memory Footprint**: Small configuration and backup files
- **Network Overhead**: None - all processing is local
- **Storage Usage**: ~1-2MB for configuration and backups

## Future Enhancements

Planned improvements:
- Historical usage graphs
- Usage prediction algorithms
- Multiple limit profiles
- Email/SMS notifications
- Export functionality
- API integration with carrier services

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review log files for error messages
3. Verify installation with diagnostic commands
4. Report issues through QuecManager support channels

## License

This feature is part of QuecManager and follows the same licensing terms.
