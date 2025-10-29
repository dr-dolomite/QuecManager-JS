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
  packages: PackageInfo[];
  missing?: string;
  message: string;
}

const ConnectionMonitoringComponent = () => {
  const [alertsStatus, setAlertsStatus] = useState<AlertsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlertsStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/cgi-bin/quecmanager/alerts/status.sh", {
        method: "GET",
        cache: "no-store",
      });

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

    // For now, show inactive component when packages are installed
    // This will be updated later with actual monitoring status
    return <MonitoringInactiveComponent />;
  };

  return <div>{renderComponent()}</div>;
};

export default ConnectionMonitoringComponent;
