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

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowUpRightIcon, RefreshCcwIcon, Trash2Icon, Loader2, Edit3Icon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MonitoringInactiveComponentProps {
  onRefresh: () => void;
  onEdit: () => void;
  recipient: string;
  threshold: number;
}

const MonitoringInactiveComponent: React.FC<MonitoringInactiveComponentProps> = ({
  onRefresh,
  onEdit,
  recipient,
  threshold,
}) => {
  const { toast } = useToast();
  const [isEnabling, setIsEnabling] = useState(false);

  const handleEnable = async (checked: boolean) => {
    if (!checked) return; // Only handle enable (when switched on)

    setIsEnabling(true);

    try {
      const response = await fetch("/cgi-bin/quecmanager/alerts/enable.sh", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Success",
          description: data.message || "Connection monitoring enabled successfully",
        });
        onRefresh();
      } else if (data.status === "warning") {
        toast({
          title: "Warning",
          description: data.message,
          variant: "default",
        });
        onRefresh();
      } else {
        throw new Error(data.message || "Failed to enable monitoring");
      }
    } catch (error) {
      console.error("Error enabling monitoring:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to enable connection monitoring",
        variant: "destructive",
      });
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection Monitoring Alerts Settings</CardTitle>
        <CardDescription>
          Utilize the <span className="font-semibold">Gmail</span> service to
          manage your Connection Monitoring alert settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="toggle-connection-monitoring"
              checked={false}
              onCheckedChange={handleEnable}
              disabled={isEnabling}
            />
            <Label htmlFor="toggle-connection-monitoring">
              {isEnabling ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enabling...
                </span>
              ) : (
                "Enable Connection Monitoring Alerts"
              )}
            </Label>
          </div>
          <Empty>
            <EmptyHeader>
              <Avatar className="size-12">
                <AvatarImage src="/gmail-logo.png" />
                <AvatarFallback>GM</AvatarFallback>
              </Avatar>
              <EmptyTitle>Connection Monitoring Alerts Inactive</EmptyTitle>
              <EmptyDescription>
                Connection Monitoring Alerts are currently inactive. Monitoring
                threshold is set to {threshold}{" "}
                {threshold === 1 ? "minute" : "minutes"}. Alerts will be sent
                to {recipient}.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <EmptyContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button onClick={onEdit} disabled={isEnabling}>
                    <Edit3Icon className="h-4 w-4" />
                    Edit Configuration
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2Icon className="h-4 w-4" />
                        Remove Alerts Service
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="md:max-w-md max-w-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm your action</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to uninstall the Connection
                          Monitoring Alerts service from your system?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button variant="destructive" disabled>
                          <Trash2Icon className="h-4 w-4" />
                          Remove Alerts Service
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </EmptyContent>
            </EmptyContent>
          </Empty>
        </div>
      </CardContent>
    </Card>
  );
};

export default MonitoringInactiveComponent;
