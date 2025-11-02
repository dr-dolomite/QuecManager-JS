"use client";

import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import { DownloadCloudIcon, RefreshCcwIcon, Loader2 } from "lucide-react";

interface MonitoringMissingComponentProps {
  onRefresh: () => void;
}

const MonitoringMissingComponent = ({ onRefresh }: MonitoringMissingComponentProps) => {
  const { toast } = useToast();
  const [isInstalling, setIsInstalling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);

    try {
      const response = await fetch("/cgi-bin/quecmanager/alerts/install.sh", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Installation Successful",
          description: data.message || "Alert system packages installed successfully",
        });

        // Close dialog and refresh status after a short delay
        setShowDialog(false);
        setTimeout(() => {
          onRefresh();
        }, 1000);
      } else {
        throw new Error(data.message || "Installation failed");
      }
    } catch (err) {
      console.error("Installation error:", err);
      toast({
        variant: "destructive",
        title: "Installation Failed",
        description: err instanceof Error ? err.message : "Unknown error occurred",
      });
    } finally {
      setIsInstalling(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      toast({
        title: "Status Refreshed",
        description: "Alert system status has been updated",
      });
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection Monitoring Alerts Settings</CardTitle>
        <CardDescription>
          Utilize the <span className="font-semibold">Gmail</span> service to manage your Connection Monitoring alert
          settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Empty className="from-muted/50 to-background h-full bg-gradient-to-b from-30%">
          <EmptyHeader>
            <Avatar className="size-16 p-0.5">
              <AvatarImage src="/gmail-logo.png" />
              <AvatarFallback>Mail</AvatarFallback>
            </Avatar>
            <EmptyTitle>Connection Monitoring Alerts</EmptyTitle>
            <EmptyDescription>
              Connection Monitoring is not installed on your device. Please
              install it to receive e-mail alerts about connectivity issues.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="grid md:grid-cols-2 grid-cols-1 gap-2 gap-x-3">
              <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
                <AlertDialogTrigger asChild>
                  <Button disabled={isInstalling}>
                    {isInstalling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <DownloadCloudIcon className="h-4 w-4" />
                    )}
                    {isInstalling ? "Installing..." : "Install"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="md:max-w-md max-w-sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm your action</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to install the alert system packages (ca-certificates and msmtp)? This may take a few minutes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isInstalling}>Cancel</AlertDialogCancel>
                    <Button onClick={handleInstall} disabled={isInstalling}>
                      {isInstalling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <DownloadCloudIcon className="h-4 w-4" />
                      )}
                      {isInstalling ? "Installing..." : "Install"}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button 
                variant="secondary" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcwIcon className="h-4 w-4" />
                )}
                {isRefreshing ? "Refreshing..." : "Refresh Status"}
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
};

export default MonitoringMissingComponent;
