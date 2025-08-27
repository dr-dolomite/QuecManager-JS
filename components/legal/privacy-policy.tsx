import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Lock,
  Eye,
  Database,
  Globe,
  AlertTriangle,
  ArrowLeftIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";

const PrivacyPolicy: React.FC = () => {
  const lastUpdated = "August 18, 2025";
  const version = "1.0";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            QuecManager Privacy Policy
          </CardTitle>
          <div className="flex justify-center items-center gap-4 mt-4">
            <Link href="/login">
              <Button variant="link">
                <ArrowLeftIcon className="size-4" />
                Go Back
              </Button>
            </Link>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-4 max-w-2xl mx-auto">
            Your privacy is important to us. This Privacy Policy explains how
            QuecManager handles your information when you use our cellular modem
            management software.
          </p>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Section 1: Overview */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Eye className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                1. Privacy Overview
              </h2>
            </div>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p className="leading-relaxed">
                QuecManager is designed with privacy as a core principle. As a
                local network management tool for Quectel cellular modems and
                routers, QuecManager operates primarily on your local network
                and devices, minimizing data collection and external
                communications.
              </p>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                  Key Privacy Principles:
                </h3>
                <ul className="list-disc list-inside space-y-1 text-green-700 dark:text-green-300">
                  <li>
                    Local-first processing - your data stays on your network
                  </li>
                  <li>
                    Minimal data collection - we only collect what's necessary
                  </li>
                  <li>
                    No remote tracking - no analytics sent to external servers
                  </li>
                  <li>User control - you decide what data to share and when</li>
                  <li>
                    Transparency - clear information about any data handling
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 2: Third-Party Disclaimer */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                2. Third-Party Disclaimer
              </h2>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong className="text-gray-900 dark:text-gray-100">
                  Important Notice:
                </strong>{" "}
                QuecManager is an independent, third-party software application
                and is <strong>not affiliated with, endorsed by, or sponsored by Quectel Wireless Solutions Co., Ltd.</strong> or
                any of its subsidiaries or affiliates. This privacy policy
                applies solely to QuecManager and not to Quectel's own services
                or products.
              </p>
            </div>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  2.1 Independent Privacy Practices:
                </strong>{" "}
                This privacy policy governs only how QuecManager handles your
                information. Quectel has its own privacy policies and data
                handling practices that are separate from ours.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  2.2 Device Data Interaction:
                </strong>{" "}
                While QuecManager interacts with Quectel devices to provide
                management functionality, we do not share your data with
                Quectel, and Quectel does not have access to information
                processed by QuecManager unless you separately share it with
                them.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  2.3 Support and Responsibility:
                </strong>{" "}
                Quectel is not responsible for QuecManager's privacy practices
                or data handling. All privacy-related inquiries about
                QuecManager should be directed to the QuecManager development
                team.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 3: Information We Collect */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Database className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                3. Information We Collect
              </h2>
            </div>
            <div className="space-y-6 text-gray-700 dark:text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  3.1 Device Configuration Data (Local Only)
                </h3>
                <p className="mb-3">
                  QuecManager accesses and displays information from your
                  cellular modems and routers to provide management
                  functionality. This includes:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Device model, firmware version, and hardware identifiers
                  </li>
                  <li>
                    Network configuration settings (APN, carrier settings, IP
                    addresses)
                  </li>
                  <li>
                    Signal strength, connection status, and performance metrics
                  </li>
                  <li>Data usage statistics and connection logs</li>
                  <li>Device temperature, memory usage, and system status</li>
                  <li>
                    Custom configuration profiles and user-defined settings
                  </li>
                </ul>
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    <strong>Important:</strong> This data is processed locally
                    on your network and is not transmitted to external servers
                    unless you explicitly enable specific features that require
                    it.
                  </p>
                </div>
              </div>
              {/* 
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  2.2 Application Usage Data (Optional)
                </h3>
                <p className="mb-3">
                  QuecManager may collect limited, anonymous usage statistics to
                  improve the software:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Feature usage frequency (which tools are used most often)
                  </li>
                  <li>
                    Error reports and crash logs (without personal information)
                  </li>
                  <li>Performance metrics (loading times, response rates)</li>
                  <li>
                    General system information (browser type, screen resolution)
                  </li>
                </ul>
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    <strong>Your Choice:</strong> Analytics collection can be
                    disabled in the application settings. Even when enabled, no
                    personally identifiable information or device-specific data
                    is included.
                  </p>
                </div>
              </div> */}

              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  3.2 User-Provided Information
                </h3>
                <p className="mb-3">
                  Information you voluntarily provide when using QuecManager:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Custom device names and labels</li>
                  <li>Network configuration preferences</li>
                  <li>User profiles and access credentials (stored locally)</li>
                  <li>Custom scripts and automation rules</li>
                  <li>Backup and export data</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 4: How We Use Information */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Globe className="h-6 w-6 text-green-600 dark:text-green-400" />
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                4. How We Use Your Information
              </h2>
            </div>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  4.1 Primary Functions
                </h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Device Management:</strong> Display and configure
                    your cellular modem settings
                  </li>
                  <li>
                    <strong>Network Monitoring:</strong> Show real-time
                    connection status and performance data
                  </li>
                  <li>
                    <strong>Troubleshooting:</strong> Provide diagnostic tools
                    and error analysis
                  </li>
                  {/* <li>
                    <strong>Configuration Backup:</strong> Save and restore your
                    device settings
                  </li> */}
                  <li>
                    <strong>Performance Optimization:</strong> Help optimize
                    your network configuration
                  </li>
                </ul>
              </div>
              {/* 
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  3.2 Software Improvement (When Enabled)
                </h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Bug Detection:</strong> Identify and fix software
                    issues
                  </li>
                  <li>
                    <strong>Feature Development:</strong> Understand which
                    features are most valuable
                  </li>
                  <li>
                    <strong>Performance Enhancement:</strong> Optimize
                    application speed and reliability
                  </li>
                  <li>
                    <strong>Compatibility Testing:</strong> Ensure compatibility
                    with different devices and networks
                  </li>
                </ul>
              </div> */}

              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  We Do NOT Use Your Information For:
                </h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                  <li>Advertising or marketing purposes</li>
                  <li>Selling or sharing with third parties</li>
                  <li>Creating user profiles for commercial purposes</li>
                  <li>Tracking your internet usage or browsing habits</li>
                  <li>
                    Monitoring your cellular data consumption for business
                    intelligence
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 5: Data Storage and Security */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Lock className="h-6 w-6 text-red-600 dark:text-red-400" />
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                5. Data Storage and Security
              </h2>
            </div>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  5.1 Local Storage
                </h3>
                <p className="mb-3">
                  The majority of your data is stored locally on your devices
                  and network:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    <strong>Browser Storage:</strong> Application settings and
                    preferences in local browser storage
                  </li>
                  <li>
                    <strong>Device Memory:</strong> Configuration data stored on
                    your cellular modems and routers
                  </li>
                  <li>
                    <strong>Local Database:</strong> Historical data and logs
                    stored on your local network
                  </li>
                  <li>
                    <strong>Configuration Files:</strong> Backup files and
                    profiles stored locally
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  5.2 Security Measures
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Technical Security
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {/* <li>HTTPS encryption for all communications</li> */}
                      <li>Secure authentication protocols</li>
                      <li>Input validation and sanitization</li>
                      <li>Regular security updates</li>
                    </ul>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Access Control
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>User authentication requirements</li>
                      <li>Role-based access permissions</li>
                      <li>Session management and timeouts</li>
                      <li>Device-level security integration</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  5.3 Data Retention
                </h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Local Data:</strong> Retained until you delete it or
                    uninstall QuecManager
                  </li>
                  {/* <li>
                    <strong>Analytics Data:</strong> Anonymous usage data
                    retained for up to 12 months
                  </li> */}
                  <li>
                    <strong>Error Logs:</strong> Crash reports retained for up
                    to 6 months for debugging
                  </li>
                  {/* <li>
                    <strong>Configuration Backups:</strong> Retained according
                    to your backup settings
                  </li> */}
                </ul>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 6: Information Sharing */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                6. Information Sharing and Disclosure
              </h2>
            </div>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                  We Do Not Sell, Rent, or Share Your Personal Information
                </h3>
                <p className="text-red-700 dark:text-red-300">
                  QuecManager does not sell, rent, lease, or otherwise provide
                  your personal information or device data to third parties for
                  commercial purposes.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  6.1 Limited Sharing Scenarios
                </h3>
                <p className="mb-3">
                  We may share information only in these specific circumstances:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>With Your Consent:</strong> When you explicitly
                    authorize sharing with specific services
                  </li>
                  <li>
                    <strong>Service Providers:</strong> Anonymous data with
                    trusted partners who help improve the software
                  </li>
                  <li>
                    <strong>Legal Requirements:</strong> When required by law,
                    regulation, or court order
                  </li>
                  <li>
                    <strong>Security Incidents:</strong> To protect against
                    fraud, abuse, or security threats
                  </li>
                  <li>
                    <strong>Business Transfers:</strong> In the event of a
                    merger, acquisition, or asset sale
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  6.2 Third-Party Integrations
                </h3>
                <p className="mb-3">
                  QuecManager may offer optional integrations with third-party
                  services:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  {/* <li>
                    Cloud backup services (only if you enable and configure
                    them)
                  </li> */}
                  {/* <li>
                    Network monitoring platforms (with explicit user
                    authorization)
                  </li> */}
                  <li>
                    Optional secure VPN services (such as Tailscale) that you
                    explicitly configure and authorize, with all data remaining
                    encrypted and under your control
                  </li>
                  <li>
                    Device manufacturer update services (for firmware updates)
                  </li>
                  {/* <li>
                    Carrier integration services (for network optimization)
                  </li> */}
                </ul>
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    <strong>Your Control:</strong> All third-party integrations
                    are optional and require your explicit consent.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 7: Your Privacy Rights */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              7. Your Privacy Rights and Choices
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  7.1 Access and Control
                </h3>
                <p className="mb-3">You have the right to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Access Your Data:</strong> View all information
                    stored by QuecManager
                  </li>
                  <li>
                    <strong>Modify Settings:</strong> Change configuration and
                    privacy preferences
                  </li>
                  <li>
                    <strong>Export Data:</strong> Download your device
                    configurations and settings
                  </li>
                  <li>
                    <strong>Delete Data:</strong> Remove stored information and
                    user profiles
                  </li>
                  <li>
                    <strong>Disable Analytics:</strong> Turn off usage data
                    collection
                  </li>
                  <li>
                    <strong>Opt-out:</strong> Decline optional data sharing and
                    integrations
                  </li>
                </ul>
              </div>

              {/* <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  6.2 Data Portability
                </h3>
                <p className="mb-3">
                  QuecManager provides tools to export your data in standard
                  formats:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Configuration files in JSON or XML format</li>
                  <li>Historical data and logs in CSV format</li>
                  <li>Device profiles and custom settings</li>
                  <li>Backup archives for migration to other systems</li>
                </ul>
              </div> */}

              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  7.2 Account Deletion
                </h3>
                <p className="mb-3">To completely remove your data:</p>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li>Access your device's administration interface (LuCI)</li>
                  <li>Go to "System" → "Software" in the navigation menu</li>
                  <li>Locate and uninstall the QuecManager package</li>
                  <li>
                    Clear all stored data:
                    <ul className="list-disc list-inside ml-6 mt-1 text-sm">
                      <li>Clear browser cache and local storage</li>
                      <li>Delete any saved configurations</li>
                      <li>Remove custom settings and profiles</li>
                    </ul>
                  </li>
                  <li>
                    Optional: Perform a factory reset on your device for
                    complete data removal
                  </li>
                  <li>
                    Contact support if you need confirmation of data deletion
                  </li>
                </ol>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 8: Children's Privacy */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              8. Children's Privacy
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                QuecManager is designed for professional and technical use in
                managing cellular network equipment. Our service is not intended
                for children under the age of 13, and we do not knowingly
                collect personal information from children under 13.
              </p>
              {/* <p>
                If you are a parent or guardian and believe your child has
                provided us with personal information, please contact us
                immediately. We will take steps to remove such information from
                our systems.
              </p> */}
              <p>
                For users between 13 and 18 years of age, we recommend parental
                guidance when using QuecManager, as it involves managing network
                equipment that may affect internet connectivity and data usage.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 9: International Users */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              9. International Data Transfers
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                QuecManager is designed to operate locally on your network,
                minimizing international data transfers. However, in limited
                circumstances, data may be transferred internationally:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <strong>Software Updates:</strong> Update checks and downloads
                  from our servers
                </li>
                {/* <li>
                  <strong>Error Reporting:</strong> Anonymous crash reports (if
                  enabled) for debugging
                </li>
                <li>
                  <strong>Optional Services:</strong> Third-party integrations
                  you choose to enable
                </li> */}
              </ul>
              <p className="mt-4">
                When international transfers occur, we ensure appropriate
                safeguards are in place to protect your information in
                accordance with applicable data protection laws, including GDPR,
                CCPA, and other regional privacy regulations.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 10: Changes to Privacy Policy */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              10. Changes to This Privacy Policy
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                We may update this Privacy Policy from time to time to reflect
                changes in our practices, technology, or legal requirements.
                When we make changes:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  We will update the "Last Updated" date at the top of this
                  policy
                </li>
                <li>
                  Significant changes will be highlighted in the application
                </li>
                <li>
                  We may provide additional notice through the software
                  interface
                </li>
                <li>
                  Continued use of QuecManager after changes constitutes
                  acceptance
                </li>
              </ul>
              <p className="mt-4">
                We encourage you to review this Privacy Policy periodically to
                stay informed about how we protect your information.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 11: Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              11. Contact Us
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                If you have questions, concerns, or requests regarding this
                Privacy Policy or how we handle your information, please contact
                us through:
              </p>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    General Inquiries
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>GitHub repository issues and discussions</li>
                    <li>Official documentation and FAQ</li>
                    <li>Community forums and support channels</li>
                  </ul>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Privacy-Specific Requests
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {/* <li>Data access and deletion requests</li> */}
                    <li>Privacy concerns and questions</li>
                    <li>GDPR and CCPA related inquiries</li>
                  </ul>
                </div>
              </div>
              {/* <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  <strong>Response Time:</strong> We aim to respond to
                  privacy-related inquiries within 30 days. For urgent security
                  concerns, please use our responsible disclosure process
                  outlined in the security documentation.
                </p>
              </div> */}
            </div>
          </section>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <img
                  src="/login-logo.svg"
                  alt="QuecManager Logo"
                  className="lg:size-16 size-12 object-cover"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  QuecManager Privacy Policy - Version {version}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Last Updated: {lastUpdated}
                </p>
              </div>
              <div className="max-w-2xl mx-auto">
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  This Privacy Policy describes how QuecManager handles your
                  information. By using our software, you acknowledge that you
                  have read and understood this policy. We are committed to
                  protecting your privacy and providing transparent information
                  about our data practices.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrivacyPolicy;
