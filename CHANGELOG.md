# QuecManager Beta Version 2.2.8 Release Candidate - Hotfix Update

## **Critical Hotfixes & System Improvements**

### **Centralized Logging System - Infrastructure Overhaul**
- **Unified Logging Framework**: Implemented centralized logging system with OpenWrt/BusyBox compatibility for consistent log management across all services
- **Organized Directory Structure**: Created `/tmp/quecmanager/logs/` with categorized subdirectories (daemons/, services/, settings/, system/) for better log organization
- **Automatic Log Rotation**: Built-in rotation at 500KB with 2-backup system to prevent /tmp storage issues on embedded systems
- **Dedicated Logging Service**: New `quecmanager_logging` init.d service (START=48) handles logging initialization and periodic maintenance
- **Web-Accessible Log Viewer**: New `/cgi-bin/quecmanager/experimental/logs/fetch_logs.sh` API provides JSON-formatted log access for experimental page integration
- **Periodic Maintenance**: Automatic log cleanup every 6 hours via procd-managed daemon to prevent disk space issues
- **Migration Completed**: Updated memory_daemon, ping_daemon, quecwatch, quecprofile, and at_queue_manager services to use centralized logging
- **Standardized Format**: Consistent log format `[YYYY-MM-DD HH:MM:S] [LEVEL] [SCRIPT] [PID:xxxx] Message` across all services

### **Memory Monitoring System - Persistence & Reliability Fixes**
- **Fixed Memory Settings Persistence**: Resolved critical issue where memory monitoring settings would not persist across device reboots
- **Conditional Service Startup**: Implemented intelligent daemon startup that only runs when memory monitoring is enabled in configuration
- **Simplified CORS Handling**: Streamlined CORS headers in `fetch_memory.sh`
- **Config-First Architecture**: Memory card component now checks configuration before attempting data fetches, improving loading states and error handling
- **Optimistic Loading**: Memory data displays immediately when configuration is enabled, eliminating unnecessary loading delays

### **Ping Latency System - Complete Rework**
- **Unified Architecture**: Completely reworked ping latency fetching to match the simplified memory system pattern for consistency
- **New Configuration Service**: Created `ping_service.sh` to provide ping settings via clean JSON API, matching memory service pattern
- **Simplified Data Fetching**: Replaced complex `fetch_ping.sh` (67 lines) with streamlined version (39 lines) using direct JSON file reading
- **Fixed Interval Handling**: Resolved critical bug where ping refreshed every 2 seconds despite 5-second configuration - now properly respects config intervals
- **Config-First Component**: Updated `ping-card.tsx` to use same config-first approach as memory card, eliminating complex animation logic
- **Conditional Daemon Management**: Ping daemon now starts conditionally based on `PING_ENABLED` configuration, matching memory daemon behavior

### **Ethernet Hardware Detection - Error Prevention**
- **Pre-Connection Validation**: Enhanced `fetch_hw_details.sh` to check Ethernet interface existence and status before attempting ethtool operations
- **Graceful Disconnection Handling**: Script now returns proper "Not Connected" state instead of throwing errors when Ethernet is unplugged
- **Multi-State Detection**: Distinguishes between interface down, no physical link, and ethtool failures with appropriate responses
- **Enhanced Component Logic**: Updated `ethernet-card.tsx` to properly handle disconnected states with visual indicators and "Not Available" labels
- **Improved Error Recovery**: Component now shows proper connection states instead of error messages when hardware is unavailable

### **UI Component Updates**

- **Fixed Cell Scan Feature Access**: Restored accidentally removed component for Cell Scan Feature

## 🐛 **Critical Bug Fixes**

### **Memory System Reliability**
- **Fixed Reboot Persistence**: Memory monitoring settings now survive device reboots and maintain user preferences
- **Eliminated Random 500 Errors**: Simplified CORS handling prevents intermittent fetch failures
- **Fixed Loading States**: Memory card no longer shows indefinite loading when service is disabled

### **Ping System Accuracy**
- **Fixed Interval Timing**: Ping latency now refreshes at correct intervals
- **Stable Polling**: Eliminated unnecessary useEffect dependencies that caused polling restarts

### **Ethernet Hardware Robustness**
- **Prevented Script Errors**: Ethernet script no longer fails when interface is down or cable is unplugged
- **Improved Error Messages**: Users see "Not Connected" instead of technical error messages
- **Visual State Indicators**: Proper red/green icon states for connected/disconnected Ethernet

## 🔧 **Technical Implementation Details**

### **Script Optimizations**
- **fetch_memory.sh**: Simplified from complex awk parsing to direct JSON file reading with basic validation
- **fetch_ping.sh**: Reduced from 67 to 39 lines with streamlined logic and simplified CORS
- **ping_service.sh**: New configuration service providing ping settings via clean JSON API
- **fetch_hw_details.sh**: Enhanced with pre-validation checks and graceful disconnection handling

### **React Component Improvements**
- **memory-card.tsx**: Config-first architecture with optimistic loading and simplified state management
- **ping-card.tsx**: Eliminated complex animation logic, fixed dependency issues, added proper interval logging
- **ethernet-card.tsx**: Enhanced disconnection handling with improved visual states

## 🔄 **Migration & Deployment Notes**

- **Ethernet Monitoring**: No user action required

## 📋 **Summary of Changes**

This hotfix update focuses on critical reliability improvements and system consistency. 
