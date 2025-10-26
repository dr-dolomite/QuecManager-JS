import React from "react";

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
import { CheckCircle2, CopyIcon } from "lucide-react";

const TailScaleActive = () => {
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
          <div className="flex items-center space-x-2 mb-3">
            <Switch id="toggle-tailscale" checked />
            <Label htmlFor="toggle-tailscale">Enable Tailscale</Label>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground">Tailscale Status</h3>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <p className="text-green-500 font-semibold">Connected</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground">Device Hostname</h3>
            <p className="font-semibold">my-device-name</p>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground">Account</h3>
            <p className="font-semibold">rus@gmail.com</p>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground">Device Virtual Address</h3>
            <div className="flex items-center gap-1.5">
              <CopyIcon className="h-4 w-4 cursor-pointer  text-secondary hover:text-secondary/80" />
              <p className="font-semibold">100.64.0.1</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground">Device Magic DNS</h3>
            <div className="flex items-center gap-1.5">
              <CopyIcon className="h-4 w-4 cursor-pointer  text-secondary hover:text-secondary/80" />
              <p className="font-semibold">
                my-device-name.ts.net
              </p>
            </div>
          </div>
          <Separator />
        </div>
      </CardContent>
    </Card>
  );
};

export default TailScaleActive;
