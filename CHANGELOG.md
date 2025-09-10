# QuecManager Release Notes

## Version 2.3.2 - Release Candidate
*Release Date: September 7, 2025*

### 🚀 New Features

#### Authentication & Security
- **Enhanced Auth Token System**: Implemented new authentication token system for improved security and session management
  - Secure token-based authentication
  - Improved session handling
  - Enhanced security for API endpoints

### 🔧 Improvements

#### Logging & Monitoring
- **AT Queue Manager Logging Integration**: Added AT queue manager to centralized logging system
  - All AT command queue operations now logged centrally
  - Better visibility into command processing and queue status
  - Improved debugging capabilities for cellular operations

- **Enhanced Logs Page**: Added newest/oldest first dropdown selection for logs page
  - Sort logs by newest first (default) or oldest first
  - Improved log navigation and readability
  - Better user experience for log analysis

#### Mobile & Responsive Design
- **Mobile View Fixes**: Fixed cellular basic settings and cell locking mobile views
  - Improved responsive design for cellular settings pages
  - Better mobile experience for cell locking functionality
  - Enhanced touch-friendly interface on mobile devices

### 🐛 Bug Fixes
- Fixed mobile responsiveness issues in cellular configuration pages
- Resolved layout issues in cell locking interface on smaller screens
- Improved authentication token handling and validation

### 🛠️ Technical Improvements
- Enhanced centralized logging system integration
- Improved AT command queue management and monitoring
- Better error handling in authentication processes
- Optimized mobile responsive layouts

### 📱 User Experience
- More intuitive log viewing with sorting options
- Better mobile interface for cellular management
- Improved visual feedback during authentication
- Enhanced overall responsive design

---

## Previous Releases

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
- None reported in this release candidate

## Support & Documentation
- GitHub Repository: [QuecManager-JS](https://github.com/dr-dolomite/QuecManager-JS)
- Issues: Report bugs via GitHub Issues
- Documentation: Available in `/docs` directory

---

**Note**: This is a Release Candidate version. Please test thoroughly before deploying to production environments.
