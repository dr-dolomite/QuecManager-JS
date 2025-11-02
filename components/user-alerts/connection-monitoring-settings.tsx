"use client";

import React, { useState, useEffect, useCallback } from "react";
import MonitoringMissingComponent from "./monitoring-missing";
import MonitoringSetupComponent from "./monitoring-setup";
import MonitoringActiveComponent from "./monitoring-active";
import MonitoringInactiveComponent from "./monitoring-inactive";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface PackageInfo {
  name: string;
  installed: boolean;
  version?: string;
}

interface AlertsStatus {
  status: string;
  all_installed: boolean;
  configured: boolean;
  ready_to_monitor: boolean;
  is_running: boolean;
  threshold: number;
  recipient?: string;
  sender?: string;
  last_notification?: string;
  packages: PackageInfo[];
  missing?: string;
  message: string;
}

const ConnectionMonitoringComponent = () => {
  const [alertsStatus, setAlertsStatus] = useState<AlertsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const fetchAlertsStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Add cache-busting timestamp to prevent browser caching
      const timestamp = new Date().getTime();
      const response = await fetch(
        `/cgi-bin/quecmanager/alerts/status.sh?_=${timestamp}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        setAlertsStatus(data);
      } else {
        throw new Error(data.message || "Failed to fetch alerts status");
      }
    } catch (err) {
      console.error("Error fetching alerts status:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleEditComplete = useCallback(() => {
    setIsEditMode(false);
    fetchAlertsStatus();
  }, [fetchAlertsStatus]);

  useEffect(() => {
    fetchAlertsStatus();
  }, [fetchAlertsStatus]);

  // Render appropriate component based on status
  const renderComponent = () => {
    if (isLoading) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-full" />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Error: {error}</p>
          </CardContent>
        </Card>
      );
    }

    if (!alertsStatus) {
      return null;
    }

    // Show MonitoringMissingComponent if packages are not installed
    if (!alertsStatus.all_installed) {
      return <MonitoringMissingComponent onRefresh={fetchAlertsStatus} />;
    }

    // Show MonitoringSetupComponent if packages are installed but not configured
    if (alertsStatus.all_installed && !alertsStatus.configured) {
      return <MonitoringSetupComponent onRefresh={fetchAlertsStatus} />;
    }

    // Show setup component in edit mode
    if (isEditMode && alertsStatus.configured) {
      return (
        <MonitoringSetupComponent
          onRefresh={handleEditComplete}
          isEditMode={true}
          defaultEmail={alertsStatus.sender || ""}
          defaultRecipient={alertsStatus.recipient || ""}
          defaultThreshold={alertsStatus.threshold.toString()}
        />
      );
    }

    // Show MonitoringActiveComponent if daemon is running
    if (alertsStatus.is_running) {
      return (
        <MonitoringActiveComponent
          onRefresh={fetchAlertsStatus}
          onEdit={() => setIsEditMode(true)}
          sender={alertsStatus.sender || ""}
          recipient={alertsStatus.recipient || ""}
          threshold={alertsStatus.threshold}
          lastNotification={alertsStatus.last_notification || ""}
        />
      );
    }

    // Show MonitoringInactiveComponent if configured but not running
    return (
      <MonitoringInactiveComponent
        onRefresh={fetchAlertsStatus}
        onEdit={() => setIsEditMode(true)}
        recipient={alertsStatus.recipient || ""}
        threshold={alertsStatus.threshold}
      />
    );
  };

  return <div>{renderComponent()}</div>;
};

export default ConnectionMonitoringComponent;
