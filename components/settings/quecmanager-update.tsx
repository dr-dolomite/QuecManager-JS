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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "../ui/skeleton";
import { FaGithub } from "react-icons/fa";

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
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(true);
  const { toast } = useToast();

  // Fetch GitHub releases
  const fetchReleases = async () => {
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
      setReleases(data);
    } catch (err) {
      console.error("Error fetching releases:", err);
      toast({
        title: "Release Notes Unavailable",
        description: "Could not fetch release notes from GitHub",
        variant: "destructive",
      });
    } finally {
      setIsLoadingReleases(false);
    }
  };

  // Fetch package information
  const fetchPackageInfo = async () => {
    toast({
      title: "Checking for Updates",
      description: "Please wait...",
    });

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

  // Format markdown-style text to HTML
  const formatReleaseNotes = (markdown: string) => {
    // First, normalize line endings
    let formatted = markdown.trim();

    // Handle headings (## and ###)
    formatted = formatted
      .replace(
        /^### (.*?)$/gm,
        '<h3 class="text-base font-semibold mt-4 mb-2 text-foreground">$1</h3>'
      )
      .replace(
        /^## (.*?)$/gm,
        '<h2 class="text-lg font-bold mt-6 mb-3 text-foreground">$1</h2>'
      )
      .replace(
        /^# (.*?)$/gm,
        '<h1 class="text-xl font-bold mt-8 mb-4 text-foreground">$1</h1>'
      );

    // Handle bold and italic (but not in list markers)
    formatted = formatted
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

    // Handle inline code
    formatted = formatted.replace(
      /`(.+?)`/g,
      '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>'
    );

    // Handle list items (both - and * for bullets)
    formatted = formatted.replace(
      /^[\*\-]\s+(.+)$/gm,
      '<li class="ml-6 mb-2 leading-relaxed">$1</li>'
    );

    // Wrap consecutive list items in ul tags
    formatted = formatted.replace(/(<li.*?<\/li>\s*)+/g, (match) => {
      return `<ul class="list-disc space-y-2 my-3 ml-2">${match}</ul>`;
    });

    // Handle line breaks between sections
    formatted = formatted.replace(/\n\n+/g, '<div class="mb-4"></div>');

    return formatted;
  };

  // Initial load - smart package list update
  useEffect(() => {
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
    fetchReleases();
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
            <CardTitle>QuecManager Update</CardTitle>
            <CardDescription>
              Keep your QuecManager up to date with the latest features and
              improvements.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Release Notes
            </CardTitle>
            <CardDescription>
              Stay informed about the latest changes and improvements in each
              release.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Release Notes
          </CardTitle>
          <CardDescription>
            Stay informed about the latest changes and improvements in each
            release.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingReleases ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : releases.length > 0 ? (
            <div className="space-y-6">
              {(() => {
                // Get installed version (remove 'v' prefix if present for comparison)
                const installedVersion = packageInfo?.installed.version?.replace(/^v/, '');
                
                // Find the latest release
                const latestRelease = releases[0];
                
                // Find the release matching the current installed version
                const currentRelease = releases.find(
                  (r) => r.tag_name.replace(/^v/, '') === installedVersion
                );
                
                // Determine which releases to show
                const releasesToShow: GitHubRelease[] = [];
                
                if (latestRelease) {
                  releasesToShow.push(latestRelease);
                }
                
                // If current version is different from latest, show it too
                if (
                  currentRelease &&
                  currentRelease.id !== latestRelease?.id
                ) {
                  releasesToShow.push(currentRelease);
                }
                
                return releasesToShow.map((release) => {
                  const isCurrentVersion = release.tag_name.replace(/^v/, '') === installedVersion;
                  const isLatestVersion = release.id === latestRelease?.id;
                  
                  return (
                    <div key={release.id} className="border-b pb-4 last:border-b-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            {release.name || release.tag_name}
                            {release.prerelease && (
                              <span className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                                Beta
                              </span>
                            )}
                            {isLatestVersion && (
                              <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                Latest
                              </span>
                            )}
                            {isCurrentVersion && (
                              <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                                Installed
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(release.published_at).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              }
                            )}
                          </p>
                        </div>

                        <a
                          href={release.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="secondary" size="sm">
                            <FaGithub className="size-4" />
                            View on GitHub
                          </Button>
                        </a>
                      </div>
                      <div
                        className="text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: formatReleaseNotes(
                            release.body || "No release notes available."
                          ),
                        }}
                      />
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <Empty className="from-muted/50 to-background h-full bg-gradient-to-b from-30%">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertCircleIcon />
                </EmptyMedia>
                <EmptyTitle>No Release Notes Available</EmptyTitle>
                <EmptyDescription>
                  Unable to fetch release notes from GitHub.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuecManagerUpdate;
