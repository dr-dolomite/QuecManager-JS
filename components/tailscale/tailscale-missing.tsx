"use client";

import React, { useState } from "react";

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


import { Button } from "@/components/ui/button";
import { DownloadCloudIcon, RefreshCcwIcon } from "lucide-react";
import { SiTailscale } from "react-icons/si";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { TailscaleInstallResponse } from "@/types/types";

interface TailScaleMissingProps {
  onRefresh: () => void;
}

const TailScaleMissing = ({ onRefresh }: TailScaleMissingProps) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const { toast } = useToast();

  const handleInstall = async () => {
    setIsInstalling(true);

    toast({
      title: "Installing Tailscale",
      description: "Please wait patiently",
      duration: 3000
    })

    try {
      const response = await fetch("/cgi-bin/quecmanager/tailscale/install.sh", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: TailscaleInstallResponse = await response.json();

      if (data.status === "error") {
        throw new Error(data.error || "Failed to install Tailscale");
      }

      if (data.already_installed) {
        toast({
          title: "Already Installed",
          description: data.message,
        });
        onRefresh();
        return;
      }

      if (data.rebooting) {
        toast({
          title: "Installation Successful",
          description: "System is rebooting. Please wait for the device to restart.",
          duration: 10000,
        });

        // Optionally reload the page after some time
        setTimeout(() => {
          window.location.reload();
        }, 90000); // 90 seconds
      } else {
        toast({
          title: "Success",
          description: data.message,
        });
        onRefresh();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to install Tailscale";
      toast({
        variant: "destructive",
        title: "Installation Failed",
        description: errorMessage,
      });
      console.error("Error installing Tailscale:", error);
    } finally {
      setIsInstalling(false);
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
        <Empty className="from-muted/50 to-background h-full bg-gradient-to-b from-30%">
          <EmptyHeader>
            <Avatar className="size-12">
              <AvatarImage src="/tailscale-logo.png" />
              <AvatarFallback>TS</AvatarFallback>
            </Avatar>
            <EmptyTitle>Tailscale Not Installed</EmptyTitle>
            <EmptyDescription>
              Tailscale VPN is not detected on your system. Please install
              Tailscale to enable its features.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="grid md:grid-cols-2 grid-cols-1 gap-2 gap-x-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={isInstalling}>
                      <DownloadCloudIcon className="h-4 w-4" />
                      {isInstalling ? "Installing..." : "Install Tailscale"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="md:max-w-md max-w-sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm your action</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to install Tailscale? This will also reboot your device.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isInstalling}>Cancel</AlertDialogCancel>
                      <Button onClick={handleInstall} disabled={isInstalling}>
                        <DownloadCloudIcon className="h-4 w-4" />
                        {isInstalling ? "Installing..." : "Install Tailscale"}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              <Button variant="secondary" onClick={onRefresh} disabled={isInstalling}>
                <RefreshCcwIcon />
                Refresh Status
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
};

export default TailScaleMissing;
