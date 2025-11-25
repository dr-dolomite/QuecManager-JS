"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Info, RefreshCcwIcon, RotateCwIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface HttpsRedirectResponse {
  status: string;
  message?: string;
  data?: {
    enabled: boolean;
  };
}

const HttpsRedirectPage = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [redirectEnabled, setRedirectEnabled] = useState(false);

  // Fetch current HTTPS redirect setting
  const fetchRedirectSetting = async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/https_redirect.sh",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: HttpsRedirectResponse = await response.json();

      if (result.status === "success" && result.data) {
        setRedirectEnabled(result.data.enabled);
      }
    } catch (error) {
      console.error("Error fetching HTTPS redirect setting:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch HTTPS redirect settings.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update HTTPS redirect setting
  const updateRedirectSetting = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/https_redirect.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enabled }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: HttpsRedirectResponse = await response.json();

      if (result.status === "success") {
        setRedirectEnabled(enabled);
        toast({
          title: "Success",
          description:
            result.message || "HTTPS redirect setting updated successfully.",
        });
      } else {
        throw new Error(result.message || "Failed to update setting");
      }
    } catch (error) {
      console.error("Error updating HTTPS redirect:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update HTTPS redirect setting.",
      });
      // Revert the switch state on error
      await fetchRedirectSetting();
    } finally {
      setIsSaving(false);
    }
  };

  // Handle switch toggle
  const handleToggle = (checked: boolean) => {
    updateRedirectSetting(checked);
  };

  useEffect(() => {
    fetchRedirectSetting();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">HTTPS Redirect</h1>
        <p className="text-muted-foreground">
          Configure automatic HTTP to HTTPS redirection for enhanced security
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>HTTP to HTTPS Redirect</CardTitle>
          <CardDescription>
            When enabled, all HTTP requests will automatically redirect to
            HTTPS. This ensures all connections to your device are encrypted.
            Make sure your SSL certificates are properly configured before
            enabling this feature.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <ShieldCheck className="h-5 w-5" />
                  <Label htmlFor="https-redirect" className="text-base">
                    Enable HTTPS Redirect
                  </Label>
                </div>

                <p className="text-sm text-muted-foreground">
                  Redirect all HTTP requests to HTTPS automatically
                </p>
              </div>
              <Switch
                id="https-redirect"
                checked={redirectEnabled}
                onCheckedChange={handleToggle}
                disabled={isSaving}
              />
            </div>
          )}

          <div className="space-y-3 pt-4 border-t">
            <h3 className="font-semibold text-sm">How it works:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span>•</span>
                <span>
                  When a user accesses{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    http://device-ip
                  </code>
                  , they are automatically redirected to{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    https://device-ip
                  </code>
                </span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Uses HTTP 301 (Permanent Redirect) status code</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>
                  Requires properly configured SSL certificates (already set up
                  with your WebSocket certificates)
                </span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>
                  Changes take effect immediately after uhttpd service restart
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={fetchRedirectSetting}
              disabled={isLoading || isSaving}
              className="w-full sm:w-auto"
            >
              <RotateCwIcon className="w-4 h-4" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HttpsRedirectPage;
