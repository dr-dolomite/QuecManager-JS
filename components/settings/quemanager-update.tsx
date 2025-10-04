"use client";

import React, { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  AlertCircleIcon,
  BellDotIcon,
  CloudDownloadIcon,
  Loader2Icon,
  RefreshCcwIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";

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

const QuecManagerUpdate = () => {
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch package information
  const fetchPackageInfo = async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/check_package_info.sh"
      );
      const data = await response.json();

      if (data.status === "success") {
        setPackageInfo(data);
        setError(null);
      } else {
        setError(data.message || "Failed to fetch package information");
      }
    } catch (err) {
      setError("Network error: Unable to fetch package information");
      console.error("Error fetching package info:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for updates
  const checkForUpdates = async () => {
    setIsChecking(true);
    try {
      // First, update the package list
      toast({
        title: "Checking for Updates",
        description: "Fetching the latest package information...",
      });

      const updateResponse = await fetch(
        "/cgi-bin/quecmanager/settings/update_package_list.sh"
      );
      const updateData = await updateResponse.json();

      if (updateData.status === "success") {
        toast({
          title: "Package List Updated",
          description: "Package list has been successfully updated.",
        });

        // Then fetch updated package info
        await fetchPackageInfo();
      } else {
        toast({
          title: "Update Check Failed",
          description: updateData.message || "Failed to update package list",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to check for updates",
        variant: "destructive",
      });
      console.error("Error checking for updates:", err);
    } finally {
      setIsChecking(false);
    }
  };

  // Perform upgrade
  const performUpgrade = async () => {
    if (!packageInfo?.available.update_available) return;

    setIsUpgrading(true);
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/upgrade_package.sh"
      );
      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Upgrade Successful",
          description: `QuecManager has been upgraded to version ${data.new_version}`,
        });

        // Refresh package info after upgrade
        await fetchPackageInfo();
      } else {
        toast({
          title: "Upgrade Failed",
          description: data.message || "Failed to upgrade package",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to perform upgrade",
        variant: "destructive",
      });
      console.error("Error upgrading package:", err);
    } finally {
      setIsUpgrading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchPackageInfo();

    // If error show a toast notification
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>QuecManager Update</CardTitle>
          <CardDescription>
            Keep your QuecManager up to date with the latest features and
            improvements.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          QuecManager Update
        </CardTitle>
        <CardDescription>
          Keep your QuecManager up to date with the latest features and
          improvements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {packageInfo?.available.update_available ? (
          // Update available
          <div className="space-y-4">
            <Alert>
              <BellDotIcon className="h-4 w-4" />
              <AlertTitle>Update Available</AlertTitle>
              <AlertDescription>
                A new version of QuecManager is available. Current version:{" "}
                <strong>{packageInfo.installed.version}</strong> → New version:{" "}
                <strong>{packageInfo.available.version}</strong>
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={performUpgrade} disabled={isUpgrading}>
                {isUpgrading ? (
                  <>
                    <Loader2Icon className="animate-spin" />
                    Upgrading...
                  </>
                ) : (
                  <>
                    <CloudDownloadIcon />
                    Install Update
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={checkForUpdates}
                disabled={isChecking}
              >
                {isChecking ? (
                  <>
                    <Loader2Icon className="animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCcwIcon />
                    Check Again
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // No update available
          <Empty className="from-muted/50 to-background h-full bg-gradient-to-b from-30%">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CloudDownloadIcon />
              </EmptyMedia>
              <EmptyTitle>No Updates Available</EmptyTitle>
              <EmptyDescription>
                You are running the latest version of QuecManager. Your current
                version is <strong>{packageInfo?.installed.version}</strong>.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={checkForUpdates} disabled={isChecking}>
                {isChecking ? (
                  <>
                    <Loader2Icon className="animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCcwIcon />
                    Check for Updates
                  </>
                )}
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
};

export default QuecManagerUpdate;
