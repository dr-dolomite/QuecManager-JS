import React from "react";

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
import { ArrowUpRightIcon, RefreshCcwIcon, Trash2Icon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MonitoringInactiveComponent = () => {
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
            <Switch id="toggle-connection-monitoring" />
            <Label htmlFor="toggle-connection-monitoring">
              Enable Connection Monitoring Alerts
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
                Connection Monitoring Alerts are currently inactive. Please
                enable the alerts to start receiving notifications about your
                network status.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <EmptyContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

                  <Button variant="secondary">
                    <RefreshCcwIcon className="h-4 w-4" />
                    Refresh Status
                  </Button>
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
