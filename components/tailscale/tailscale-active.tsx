"use client";
import React, { useState } from "react";
import { useTailscaleDeviceDetails } from "@/hooks/use-tailscale-device-details";
import { TailscaleToggleResponse } from "@/types/types";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  CopyIcon,
  RefreshCcwIcon,
  XCircle,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const TailScaleActive = () => {
  const { deviceDetails, isLoading, error, refetch } =
    useTailscaleDeviceDetails();
  const { toast } = useToast();
  const [isToggling, setIsToggling] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: `${label} copied successfully`,
      duration: 2000,
    });
  };

  const handleToggleTailscale = async (checked: boolean) => {
    setIsToggling(true);

    try {
      const action = checked ? "up" : "down";
      const response = await fetch("/cgi-bin/quecmanager/tailscale/toggle.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: TailscaleToggleResponse = await response.json();

      if (data.status === "error") {
        throw new Error(data.error || `Failed to ${action} Tailscale`);
      }

      const toastTitle = checked ? "Tailscale Started" : "Tailscale Stopped";
      
      toast({
        title: toastTitle,
        description: data.message,
        duration: 3000,
      });

      // Refresh page after 3 seconds
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to toggle Tailscale";
      toast({
        title: "Tailscale Toggle",
        description: errorMessage,
        duration: 3000,
        variant: "destructive",
      });
      console.error("Error toggling Tailscale:", err);
      setIsToggling(false);
    }
  };

  const formatKeyExpiry = (expiry: string) => {
    if (!expiry) return "N/A";
    const expiryDate = new Date(expiry);
    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) return "Expired";
    if (daysUntilExpiry === 0) return "Expires today";
    if (daysUntilExpiry === 1) return "Expires tomorrow";
    return `${daysUntilExpiry} days`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tailscale Settings</CardTitle>
        <CardDescription>
          Manage your Tailscale VPN settings and connected devices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center space-x-2 mb-3">
              <Switch id="toggle-tailscale" />
              <Label htmlFor="toggle-tailscale">Enable Tailscale</Label>
            </div>
            <Separator />
            {[1, 2, 3, 4, 5].map((i) => (
              <React.Fragment key={i}>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <Separator />
              </React.Fragment>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <XCircle className="h-12 w-12 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCcwIcon className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        ) : deviceDetails ? (
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center space-x-2 mb-3">
              <Switch
                id="toggle-tailscale"
                checked={deviceDetails.device.online}
                onCheckedChange={handleToggleTailscale}
                disabled={isToggling}
              />
              <Label htmlFor="toggle-tailscale">
                {isToggling ? "Stopping Tailscale..." : "Enable Tailscale"}
              </Label>
            </div>
            <Separator />

            {/* Status */}
            <div className="flex items-center justify-between">
              <h3 className="text-muted-foreground">Tailscale Status</h3>
              <div className="flex items-center gap-1">
                {deviceDetails.device.online ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <p className="text-green-500 font-semibold">Connected</p>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-gray-400" />
                    <p className="text-gray-500 font-semibold">Disconnected</p>
                  </>
                )}
              </div>
            </div>
            <Separator />

            {/* Hostname */}
            <div className="flex items-center justify-between">
              <h3 className="text-muted-foreground">Device Hostname</h3>
              <p className="font-semibold">{deviceDetails.device.hostname}</p>
            </div>
            <Separator />

            {/* Tailnet */}
            <div className="flex items-center justify-between">
              <h3 className="text-muted-foreground">Tailnet Name</h3>
              <p className="font-semibold">
                {deviceDetails.network.tailnet_name}
              </p>
            </div>
            <Separator />

            {/* Virtual IP */}
            <div className="flex items-center justify-between">
              <h3 className="text-muted-foreground">Virtual IP</h3>
              <div className="flex items-center gap-1.5">
                <CopyIcon
                  className="h-4 w-4 cursor-pointer text-secondary hover:text-secondary/80"
                  onClick={() =>
                    copyToClipboard(
                      deviceDetails.device.tailscale_ip,
                      "Virtual IP"
                    )
                  }
                />
                <p className="font-semibold">
                  {deviceDetails.device.tailscale_ip}
                </p>
              </div>
            </div>
            <Separator />

            {/* Magic DNS */}
            <div className="flex items-center justify-between">
              <h3 className="text-muted-foreground">Magic DNS</h3>
              <div className="flex items-center gap-1.5">
                <CopyIcon
                  className="h-4 w-4 cursor-pointer text-secondary hover:text-secondary/80"
                  onClick={() =>
                    copyToClipboard(deviceDetails.device.dns_name, "Magic DNS")
                  }
                />
                <p className="font-semibold">
                  {deviceDetails.device.dns_name}
                </p>
              </div>
            </div>
            <Separator />

            {/* Relay Server */}
            <div className="flex items-center justify-between">
              <h3 className="text-muted-foreground">Relay Server</h3>
              <Badge className="uppercase">
                {deviceDetails.device.relay || "Direct"}
              </Badge>
            </div>
            <Separator />

            {/* Key Expiry */}
            <div className="flex items-center justify-between">
              <h3 className="text-muted-foreground">Key Expiry</h3>
              <p className="font-semibold">
                {formatKeyExpiry(deviceDetails.device.key_expiry)}
              </p>
            </div>
            <Separator />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default TailScaleActive;
