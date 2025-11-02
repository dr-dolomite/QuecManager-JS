"use client";
import React, { useState } from "react";
import { TailscaleToggleResponse, TailscaleUninstallResponse } from "@/types/types";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RefreshCcwIcon, Trash2Icon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TailscaleInactiveProps {
  onRefresh: () => void;
}

const TailscaleInactive = ({ onRefresh }: TailscaleInactiveProps) => {
  const { toast } = useToast();
  const [isToggling, setIsToggling] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);

  const handleToggleTailscale = async (checked: boolean) => {
    if (!checked) return; // Only handle enabling

    setIsToggling(true);

    try {
      const response = await fetch("/cgi-bin/quecmanager/tailscale/toggle.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "up" }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: TailscaleToggleResponse = await response.json();

      if (data.status === "error") {
        throw new Error(data.error || "Failed to enable Tailscale");
      }

      toast({
        title: "Tailscale Started",
        description: data.message,
        duration: 3000,
      });

      // Refresh page after 3 seconds
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to enable Tailscale";
      toast({
        title: "Tailscale Toggle",
        description: errorMessage,
        duration: 3000,
        variant: "destructive",
      });
      console.error("Error enabling Tailscale:", err);
      setIsToggling(false);
    }
  };

  const handleUninstall = async () => {
    setIsUninstalling(true);

    try {
      const response = await fetch("/cgi-bin/quecmanager/tailscale/uninstall.sh", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: TailscaleUninstallResponse = await response.json();

      if (data.status === "error") {
        throw new Error(data.error || "Failed to uninstall Tailscale");
      }

      toast({
        title: "Tailscale Uninstalled",
        description: data.message,
        duration: 5000,
      });

      // Note: Device will reboot, so no need to refresh
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to uninstall Tailscale";
      toast({
        title: "Uninstall Failed",
        description: errorMessage,
        duration: 3000,
        variant: "destructive",
      });
      console.error("Error uninstalling Tailscale:", err);
      setIsUninstalling(false);
    }
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
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="toggle-tailscale"
              checked={false}
              onCheckedChange={handleToggleTailscale}
              disabled={isToggling}
            />
            <Label htmlFor="toggle-tailscale">
              {isToggling ? "Starting Tailscale..." : "Enable Tailscale"}
            </Label>
          </div>
          <Empty>
            <EmptyHeader>
              <Avatar className="size-12">
                <AvatarImage src="/tailscale-logo.png" />
                <AvatarFallback>TS</AvatarFallback>
              </Avatar>
              <EmptyTitle>Tailscale is Inactive</EmptyTitle>
              <EmptyDescription>
                Tailscale VPN is currently inactive. Enable it to connect to
                your secure network and access your devices.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isUninstalling || isToggling}>
                      <Trash2Icon className="h-4 w-4" />
                      {isUninstalling ? "Uninstalling..." : "Uninstall Tailscale"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="md:max-w-md max-w-sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm your action</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to uninstall Tailscale from your
                        system? This will also reboot your device.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isUninstalling}>Cancel</AlertDialogCancel>
                      <Button variant="destructive" onClick={handleUninstall} disabled={isUninstalling}>
                        <Trash2Icon className="h-4 w-4" />
                        {isUninstalling ? "Uninstalling..." : "Uninstall Tailscale"}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button variant="secondary" onClick={onRefresh} disabled={isToggling || isUninstalling}>
                  <RefreshCcwIcon className="h-4 w-4" />
                  Refresh Status
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        </div>
      </CardContent>
    </Card>
  );
};

export default TailscaleInactive;
