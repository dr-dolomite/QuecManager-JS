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
  CloudDownloadIcon,
  Loader2Icon,
  RefreshCcwIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import UpdateReleaseNotes from "./update-release-notes";

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

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
}

interface UpdateResponse {
  status: string;
  message: string;
  timestamp: string;
  cached: boolean;
  cache_age_seconds: number;
  exit_code: number;
  output?: string;
}

const QuecManagerUpdate = () => {
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [releases, setReleases] = useState<GitHubRelease[]>(() => {
    // Load cached releases immediately on mount
    try {
      const cached = localStorage.getItem("quecmanager_releases");
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.data || [];
      }
    } catch (err) {
      console.error("Error loading cached releases:", err);
    }
    return [];
  });
  const [isLoadingReleases, setIsLoadingReleases] = useState(releases.length === 0);
  const { toast } = useToast();

  // Fetch GitHub releases with caching
  const fetchReleases = async (isBackground: boolean = false) => {
    try {
      const response = await fetch(
        "https://api.github.com/repos/dr-dolomite/QuecManager-JS/releases",
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch releases");
      }

      const data: GitHubRelease[] = await response.json();
      
      // Save to localStorage
      localStorage.setItem(
        "quecmanager_releases",
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );
      
      setReleases(data);
      
      // Only show error toast if this is not a background fetch and no cached data exists
      if (!isBackground && releases.length === 0) {
        // Success - data loaded
      }
    } catch (err) {
      console.error("Error fetching releases:", err);
      // Only show toast if not background fetch and no cached data
      if (!isBackground && releases.length === 0) {
        toast({
          title: "Release Notes Unavailable",
          description: "Could not fetch release notes from GitHub",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoadingReleases(false);
    }
  };

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

  // Update package list (can use cache or force update)
  const updatePackageList = async (forceUpdate: boolean = false) => {
    try {
      const url = forceUpdate
        ? "/cgi-bin/quecmanager/settings/update_package_list.sh?force=1"
        : "/cgi-bin/quecmanager/settings/update_package_list.sh";

      const updateResponse = await fetch(url);
      const updateData: UpdateResponse = await updateResponse.json();

      return updateData;
    } catch (err) {
      console.error("Error updating package list:", err);
      throw err;
    }
  };

  // Check for updates (user-initiated)
  const checkForUpdates = async () => {
    setIsChecking(true);
    try {
      toast({
        title: "Checking for Updates",
        description: "Fetching the latest package information...",
      });

      // Force update when user explicitly checks
      const updateData = await updatePackageList(true);

      if (updateData.status === "success") {
        // Show appropriate message based on cache status
        const cacheAgeMinutes = Math.floor(updateData.cache_age_seconds / 60);
        const cacheAgeSeconds = updateData.cache_age_seconds % 60;
        const cacheAgeText =
          cacheAgeMinutes > 0
            ? `${cacheAgeMinutes} min ${cacheAgeSeconds}s`
            : `${cacheAgeSeconds}s`;

        const message = updateData.cached
          ? `Using cached data (${cacheAgeText} old)`
          : "Package list has been successfully updated.";

        toast({
          title: "Package List Updated",
          description: message,
        });

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
      toast({
        title: "Upgrading",
        description: "QuecManager is being upgraded. Please wait patiently...",
      });

      const response = await fetch(
        "/cgi-bin/quecmanager/settings/upgrade_package.sh"
      );
      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Upgrade Successful",
          description: `QuecManager has been upgraded to version ${packageInfo.available.version}. The page will now refresh.`,
        });
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      console.error("Error upgrading package:", err);
    } finally {
      setIsUpgrading(false);
    }
  };

  // Initial load - smart package list update
  useEffect(() => {
    // Only show toast if no cached releases (first time load)
    if (releases.length === 0) {
      toast({
        title: "Checking for Updates",
        description:
          "Please wait while we fetch the latest package information...",
        duration: 4000,
      });
    }

    const initializeData = async () => {
      try {
        // Try to update package list (will use cache if recent)
        await updatePackageList(false);
      } catch (err) {
        // Silently fail - we'll try to fetch package info anyway
        console.log("Package list update skipped or failed:", err);
      }

      // Fetch package info regardless of update status
      await fetchPackageInfo();
    };

    initializeData();
    
    // Fetch releases in background (will update if new data available)
    fetchReleases(true);
  }, []);

  // Show error toast when error state changes
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <div className="space-y-4 grid">
        <Card>
          <CardHeader>
            <CardTitle>QuecManager Update (Experimental)</CardTitle>
            <CardDescription>
              Keep your QuecManager up to date with the latest features and
              improvements.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>

        <UpdateReleaseNotes
          releases={[]}
          isLoading={true}
          installedVersion={undefined}
          packageType={undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 grid">
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
            <div className="space-y-4">
              <Empty className="from-muted/50 to-background h-full bg-gradient-to-b from-30%">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CloudDownloadIcon className="text-primary" />
                  </EmptyMedia>
                  <EmptyTitle>New Update Available</EmptyTitle>
                  {packageInfo?.installed.type === "beta" ? (
                    <EmptyDescription>
                      A new version of QuecManager <strong>BETA</strong> is
                      available.
                    </EmptyDescription>
                  ) : (
                    <EmptyDescription>
                      A new version of QuecManager <strong>STABLE</strong> is
                      available.
                    </EmptyDescription>
                  )}
                  <EmptyDescription>
                    Update from{" "}
                    <strong className="text-blue-500">
                      {packageInfo?.installed.version}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-green-500">
                      {packageInfo?.available.version}
                    </strong>
                    .
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="grid grid-flow-row md:grid-cols-2 grid-cols-1 gap-2">
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
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            <Empty className="from-muted/50 to-background h-full bg-gradient-to-b from-30%">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CloudDownloadIcon />
                </EmptyMedia>
                <EmptyTitle>No Updates Available</EmptyTitle>
                <EmptyDescription>
                  You are running the latest version of QuecManager. Your
                  current version is {""}
                  {packageInfo?.installed.version ? (
                    <strong className="text-blue-500">
                      {packageInfo.installed.version}
                      {packageInfo.installed.type === "beta" ? (
                        <span className="ml-1">BETA</span>
                      ) : (
                        <span className="ml-1">STABLE</span>
                      )}
                    </strong>
                  ) : (
                    <Skeleton className="ml-1 h-3 w-12 inline-block" />
                  )}
                  .
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

      <UpdateReleaseNotes
        releases={releases}
        isLoading={isLoadingReleases}
        installedVersion={packageInfo?.installed.version}
        packageType={packageInfo?.installed.type}
      />
    </div>
  );
};

export default QuecManagerUpdate;
