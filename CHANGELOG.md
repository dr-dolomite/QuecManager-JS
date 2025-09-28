# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Data Usage Tracking**: New experimental feature to monitor and track cellular data consumption with real-time statistics and usage history
- **Network Latency Monitoring**: Enhanced QuecWatch with high latency monitoring capabilities, allowing automatic recovery actions when ping latency exceeds configurable thresholds
- **PCI Change Monitoring**: Improved monitoring for SA (Standalone) network mode with better detection of Physical Cell Identifier changes

### Improved

- QuecWatch service now supports dual monitoring modes (standard connectivity and latency-aware monitoring)
- Enhanced configuration system for latency failure thresholds and ceiling settings
- Better error handling and status reporting in QuecWatch service
- Unified failure counting logic when latency monitoring is enabled
- Automatic retry counter reset before system reboot to prevent reboot loops

### Fixed

- Resolved conflicting retry count logic between latency and connectivity monitoring
- Fixed boolean configuration parsing issues in QuecWatch service
- Corrected hardcoded latency failure thresholds that were ignoring user configuration
- Improved connection refresh logic to execute only on first retry when enabled