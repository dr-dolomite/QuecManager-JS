"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { AlertCircleIcon } from "lucide-react";
import { FaGithub } from "react-icons/fa";

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
}

interface UpdateReleaseNotesProps {
  releases: GitHubRelease[];
  isLoading: boolean;
  installedVersion: string | undefined;
  packageType: "stable" | "beta" | undefined;
}

const UpdateReleaseNotes: React.FC<UpdateReleaseNotesProps> = ({
  releases,
  isLoading,
  installedVersion,
  packageType,
}) => {
  // Format markdown-style text to HTML
  const formatReleaseNotes = (markdown: string) => {
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

    // Handle bold and italic
    formatted = formatted
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

    // Handle inline code
    formatted = formatted.replace(
      /`(.+?)`/g,
      '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>'
    );

    // Handle list items
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

  // Normalize version for comparison
  const normalizeVersion = (version: string) => {
    let normalized = version
      .replace(/^v/, "") // Remove v prefix
      .trim()
      .toLowerCase();

    // For BETA packages: convert "2.3.3" to "2.3-beta.3" if "-beta" isn't already present
    // For STABLE packages: keep as "2.3.3" (no -beta conversion)
    if (packageType === "beta" && !normalized.includes("-beta")) {
      normalized = normalized.replace(/\.(\d+)$/, "-beta.$1");
    }

    return normalized;
  };

  const normalizedInstalled = normalizeVersion(installedVersion || "");

  // Debug logging
  //   console.log("[UpdateReleaseNotes] Package type:", packageType);
  //   console.log("[UpdateReleaseNotes] Raw installed version:", installedVersion);
  //   console.log("[UpdateReleaseNotes] Normalized installed:", normalizedInstalled);
  //   console.log("[UpdateReleaseNotes] Available releases:", releases.map(r => ({
  //     tag: r.tag_name,
  //     normalized: normalizeVersion(r.tag_name)
  //   })));

  // Filter releases to show
  const getReleasesToShow = () => {
    if (releases.length === 0) return [];

    const latestRelease = releases[0];
    const currentRelease = releases.find((r) => {
      const normalizedRelease = normalizeVersion(r.tag_name);
      const isMatch = normalizedRelease === normalizedInstalled;

      //   if (isMatch) {
      //     console.log("[UpdateReleaseNotes] ✅ Match found:", {
      //       release: r.tag_name,
      //       normalizedRelease,
      //       installedVersion,
      //       normalizedInstalled
      //     });
      //   }

      return isMatch;
    });

    const releasesToShow: GitHubRelease[] = [];

    if (latestRelease) {
      releasesToShow.push(latestRelease);
    }

    if (currentRelease && currentRelease.id !== latestRelease?.id) {
      releasesToShow.push(currentRelease);
    }

    return releasesToShow;
  };

  const releasesToShow = getReleasesToShow();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Release Notes</CardTitle>
        <CardDescription>
          Stay informed about the latest changes and improvements in each
          release.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : releasesToShow.length > 0 ? (
          <div className="space-y-6">
            {releasesToShow.map((release) => {
              const isCurrentVersion =
                normalizeVersion(release.tag_name) === normalizedInstalled;
              const isLatestVersion = release.id === releases[0]?.id;

              return (
                <div key={release.id} className="border-b pb-4 last:border-b-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold ">
                          {release.name || release.tag_name}
                        </h3>
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
                      </div>
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
                      className="hidden lg:block"
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
            })}
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
  );
};

export default UpdateReleaseNotes;
