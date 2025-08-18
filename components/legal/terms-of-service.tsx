import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  const lastUpdated = "August 18, 2025";
  const version = "1.0";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            QuecManager Terms of Service
          </CardTitle>
          <Link href="/login">
            <Button variant="link">
              <ArrowLeft className="size-4" />
              Go Back
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Section 1: Acceptance of Terms */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              1. Acceptance of Terms
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              By accessing, installing, or using QuecManager ("the Software"),
              you acknowledge that you have read, understood, and agree to be
              bound by these Terms of Service ("Terms"). If you do not agree to
              these Terms, you must not use the Software. These Terms constitute
              a legally binding agreement between you ("User" or "you") and the
              QuecManager development team ("we," "us," or "our").
            </p>
          </section>

          <Separator />

          {/* Section 2: Description of Service */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              2. Description of Service
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              QuecManager is a web-based management interface designed for
              Quectel cellular modems and routers. The Software provides:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>
                Real-time monitoring of cellular connectivity and network status
              </li>
              <li>
                Configuration management for network settings and cellular
                parameters
              </li>
              <li>Diagnostic tools for troubleshooting connectivity issues</li>
              <li>Performance metrics and usage analytics</li>
              <li>Remote management capabilities for supported devices</li>
              <li>Firmware update management and device administration</li>
            </ul>
          </section>

          <Separator />

          {/* Section 3: Third-Party Disclaimer */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              3. Third-Party Disclaimer
            </h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong className="text-gray-900 dark:text-gray-100">
                  Important Notice:
                </strong>{" "}
                QuecManager is an independent, third-party software application
                and is{" "}
                <strong>
                  not affiliated with, endorsed by, or sponsored by Quectel
                  Wireless Solutions Co., Ltd.
                </strong>{" "}
                or any of its subsidiaries or affiliates. QuecManager is
                developed and maintained independently by the QuecManager
                development team.
              </p>
            </div>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  3.1 Independent Development:
                </strong>{" "}
                This software has been created independently to provide
                management capabilities for Quectel devices. Any trademarks,
                service marks, or product names mentioned in relation to Quectel
                are the property of Quectel Wireless Solutions Co., Ltd.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  3.2 No Official Support:
                </strong>{" "}
                Quectel does not provide support, warranty, or endorsement for
                QuecManager. All support and inquiries regarding QuecManager
                should be directed to the QuecManager development team through
                official channels.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  3.3 Device Compatibility:
                </strong>{" "}
                While QuecManager is designed to work with Quectel devices, we
                cannot guarantee compatibility with all device models or
                firmware versions. Use of QuecManager with Quectel devices is at
                your own discretion and risk.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 4: License and Usage Rights */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              4. License and Usage Rights
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  4.1 Grant of License:
                </strong>{" "}
                Subject to these Terms, we grant you a limited, non-exclusive,
                non-transferable, revocable license to use QuecManager solely
                for managing your Quectel devices in accordance with these
                Terms.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  4.2 Restrictions:
                </strong>{" "}
                You may not:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-6">
                <li>
                  Modify, reverse engineer, decompile, or disassemble the
                  Software
                </li>
                <li>
                  Distribute, sublicense, or transfer the Software to third
                  parties
                </li>
                <li>
                  Use the Software for any illegal or unauthorized purpose
                </li>
                <li>Remove or alter any proprietary notices or labels</li>
                <li>
                  Use the Software to damage, disable, or impair any networks or
                  systems
                </li>
              </ul>
            </div>
          </section>

          <Separator />

          {/* Section 5: Device Compatibility and Requirements */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              5. Device Compatibility and Requirements
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  5.1 Compatibility:
                </strong>{" "}
                QuecManager is designed for use with Quectel cellular modems and
                routers. Compatibility is not guaranteed for all device models
                or firmware versions.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  5.2 System Requirements:
                </strong>{" "}
                You are responsible for ensuring your system meets the minimum
                requirements for running QuecManager, including compatible web
                browsers, network connectivity, and device firmware.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  5.3 Device Access:
                </strong>{" "}
                You must have legitimate ownership or authorization to manage
                any devices you connect to QuecManager.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 6: User Responsibilities */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              6. User Responsibilities
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>You agree to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  Use QuecManager only for lawful purposes and in compliance
                  with all applicable laws and regulations
                </li>
                <li>
                  Maintain the security and confidentiality of your device
                  access credentials
                </li>
                <li>
                  Regularly backup important device configurations and data
                </li>
                <li>
                  Keep your devices and QuecManager installation updated with
                  the latest security patches
                </li>
                <li>
                  Monitor your device usage to ensure compliance with your
                  carrier's terms of service
                </li>
                <li>
                  Report any security vulnerabilities or bugs to the development
                  team
                </li>
                <li>
                  Not use the Software to interfere with or disrupt networks,
                  servers, or other users
                </li>
              </ul>
            </div>
          </section>

          <Separator />

          {/* Section 7: Privacy and Data Collection */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              7. Privacy and Data Collection
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  7.1 Local Processing:
                </strong>{" "}
                QuecManager operates primarily as a local management interface.
                Device data and configurations are processed locally on your
                device and network.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  7.2 No Remote Data Collection:
                </strong>{" "}
                We do not collect, store, or transmit your device data,
                configurations, or usage information to remote servers unless
                explicitly enabled by you for specific features.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  7.3 Analytics:
                </strong>{" "}
                QuecManager may collect anonymous usage statistics to improve
                the software. This data does not include personal information or
                device-specific details.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  7.4 Third-Party Services:
                </strong>{" "}
                If you choose to integrate with third-party services, those
                services' privacy policies will apply to data shared with them.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 8: Security Considerations */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              8. Security Considerations
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  8.1 Network Security:
                </strong>{" "}
                You are responsible for securing your network and devices when
                using QuecManager. This includes using strong passwords,
                enabling encryption, and implementing appropriate firewall
                rules.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  8.2 Access Control:
                </strong>{" "}
                Limit access to QuecManager to authorized personnel only.
                Implement proper user authentication and access controls.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  8.3 Regular Updates:
                </strong>{" "}
                Keep QuecManager and your device firmware updated to protect
                against security vulnerabilities.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 9: Disclaimers and Limitations */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              9. Disclaimers and Limitations
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  9.1 "AS IS" Basis:
                </strong>{" "}
                QuecManager is provided "as is" without any warranties, express
                or implied, including but not limited to warranties of
                merchantability, fitness for a particular purpose, or
                non-infringement.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  9.2 No Guarantee of Availability:
                </strong>{" "}
                We do not guarantee that QuecManager will be available at all
                times or free from errors, bugs, or interruptions.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  9.3 Device Damage:
                </strong>{" "}
                Use of QuecManager is at your own risk. We are not responsible
                for any damage to your devices, data loss, or network disruption
                resulting from the use of the Software.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  9.4 Carrier Compliance:
                </strong>{" "}
                You are responsible for ensuring your use of QuecManager
                complies with your cellular carrier's terms of service and data
                usage policies.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 10: Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              10. Limitation of Liability
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                To the maximum extent permitted by applicable law, we shall not
                be liable for any indirect, incidental, special, consequential,
                or punitive damages, including but not limited to:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Loss of profits, data, or business opportunities</li>
                <li>Device damage or malfunction</li>
                <li>Network downtime or service interruption</li>
                <li>Security breaches or unauthorized access</li>
                <li>Carrier charges or fees resulting from software use</li>
              </ul>
              <p className="mt-4">
                Our total liability for any claims arising from or related to
                QuecManager shall not exceed the amount you paid for the
                Software, if any.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 11: Updates and Modifications */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              11. Updates and Modifications
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  11.1 Software Updates:
                </strong>{" "}
                We may release updates, patches, or new versions of QuecManager.
                You are encouraged to install updates to maintain security and
                functionality.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  11.2 Terms Updates:
                </strong>{" "}
                We reserve the right to modify these Terms at any time. Updated
                Terms will be effective immediately upon posting. Continued use
                of QuecManager after changes constitutes acceptance of the new
                Terms.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  11.3 Feature Changes:
                </strong>{" "}
                We may add, modify, or remove features from QuecManager without
                prior notice.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 12: Open Source and Third-Party Components */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              12. Open Source and Third-Party Components
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                QuecManager may include open source software components and
                third-party libraries. These components are governed by their
                respective licenses, which are included in the software
                distribution. You agree to comply with all applicable open
                source licenses.
              </p>
              <p>
                A complete list of third-party components and their licenses is
                available in the software documentation and source code
                repository.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 13: Termination */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              13. Termination
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  13.1 Termination by You:
                </strong>{" "}
                You may stop using QuecManager at any time by uninstalling the
                Software from your devices.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  13.2 Termination by Us:
                </strong>{" "}
                We may terminate your right to use QuecManager if you violate
                these Terms or engage in prohibited activities.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  13.3 Effect of Termination:
                </strong>{" "}
                Upon termination, your right to use QuecManager ceases
                immediately. You must uninstall the Software and destroy all
                copies in your possession.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 14: Governing Law and Disputes */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              14. Governing Law and Disputes
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  14.1 Governing Law:
                </strong>{" "}
                These Terms shall be governed by and construed in accordance
                with the laws of your jurisdiction, without regard to conflict
                of law principles.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  14.2 Dispute Resolution:
                </strong>{" "}
                Any disputes arising from these Terms or your use of QuecManager
                should first be addressed through good faith negotiation. If
                resolution cannot be reached, disputes may be subject to binding
                arbitration or court proceedings as determined by applicable
                law.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 15: Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              15. Contact Information
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                If you have questions about these Terms or QuecManager, please
                contact us through:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>GitHub repository issues and discussions</li>
                <li>Official documentation and support channels</li>
                <li>Community forums and support resources</li>
              </ul>
              <p className="mt-4">
                For security-related issues, please follow responsible
                disclosure practices as outlined in our security policy.
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 16: Miscellaneous */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              16. Miscellaneous
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  16.1 Entire Agreement:
                </strong>{" "}
                These Terms constitute the entire agreement between you and us
                regarding QuecManager and supersede all prior agreements.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  16.2 Severability:
                </strong>{" "}
                If any provision of these Terms is found to be unenforceable,
                the remaining provisions shall remain in full force and effect.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  16.3 Waiver:
                </strong>{" "}
                Our failure to enforce any provision of these Terms shall not
                constitute a waiver of that provision.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-gray-100">
                  16.4 Assignment:
                </strong>{" "}
                You may not assign or transfer your rights under these Terms
                without our prior written consent.
              </p>
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
              <p className="text-sm text-gray-600 dark:text-gray-400">
                QuecManager Terms of Service - Version {version}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Last Updated: {lastUpdated}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
                By using QuecManager, you acknowledge that you have read and
                understood these Terms of Service and agree to be bound by them.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TermsOfService;
