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
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "../ui/button";
import { ArrowUpRightIcon, RefreshCcwIcon, Trash2Icon } from "lucide-react";

interface TailscaleInactiveProps {
  onRefresh: () => void;
}

const TailscaleInactive = ({ onRefresh }: TailscaleInactiveProps) => {
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
            <Switch id="toggle-tailscale" />
            <Label htmlFor="toggle-tailscale">Enable Tailscale</Label>
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
                  <AlertDialogTrigger>
                    <Button variant="destructive">
                      <Trash2Icon className="h-4 w-4" />
                      Uninstall Tailscale
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
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <Button variant="destructive">
                        <Trash2Icon className="h-4 w-4" />
                        Uninstall Tailscale
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button variant="secondary" onClick={onRefresh}>
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
