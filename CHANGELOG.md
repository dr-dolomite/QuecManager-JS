# QuecManager Release Notes

## Version 2.3.3
*Release Date: September 10, 2025*

### 🔧 Improvements

#### Connection Monitoring Optimization
- **Smart Connection Monitoring**: Implemented intelligent connection monitoring with ping integration
  - Automatically detects when ping monitoring is active and stops redundant connection checks
  - Displays "Ping Active" status when ping monitoring handles connectivity
  - Eliminates duplicate network requests, saving cellular data usage
  - Smart refresh cycle management - pauses automatic polling when optimization is active
  - Manual refresh capability to restart monitoring cycle when needed

### 🛠️ Technical Improvements
- **Intelligent Resource Management**: Optimized polling system to reduce unnecessary network requests and improve performance
- **Enhanced Hook Management**: Improved React hook lifecycle with smart interval control

### 📱 User Experience
- **Cleaner Status Display**: Concise "Ping Active" status replaces longer text for better UI
- **Reduced Data Usage**: Automatic optimization when multiple monitoring systems are active
- **Maintained Control**: Manual refresh always available to restart monitoring cycle


---

## Previous Releases

### Version 2.3.2 - Release Candidate
*Release Date: September 7, 2025*

- Enhanced Auth Token System with improved security and session management
- AT Queue Manager Logging Integration for better visibility into command processing
- Enhanced Logs Page with newest/oldest first dropdown selection
- Mobile View Fixes for cellular basic settings and cell locking
- Improved authentication token handling and mobile responsive layouts

### Version 2.3.1
*Previous stable release*

### Version 2.3.0
*Major release with core functionality*

---

## Installation & Upgrade Notes

### For New Installations
1. Deploy the QuecManager package to your OpenWRT device
2. Ensure all dependencies are installed
3. Configure initial authentication settings
4. Access the web interface and complete setup

### For Upgrades from 2.3.2
1. Backup current configuration
2. Deploy new version
3. The smart connection monitoring optimization will be automatically activated
4. Verify that "Ping Active" status displays correctly when ping monitoring is enabled
5. Test the optimized resource management functionality

### For Upgrades from 2.3.1
1. Backup current configuration
2. Deploy new version
3. The new auth token system will be automatically activated
4. Verify logging functionality is working correctly
5. Test mobile interface on cellular settings pages

### System Requirements
- OpenWRT compatible device
- Quectel cellular modem
- Web browser with JavaScript enabled
- Minimum 16MB available storage

---

## Known Issues
- None reported in this release

## Support & Documentation
- GitHub Repository: [QuecManager-JS](https://github.com/dr-dolomite/QuecManager-JS)
- Issues: Report bugs via GitHub Issues
- Documentation: Available in `/docs` directory

---

**Note**: This release includes smart connection monitoring optimization for improved performance and reduced cellular data usage.
