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

import { Button } from "@/components/ui/button";
import { DownloadCloudIcon, RefreshCcwIcon } from "lucide-react";
import { SiTailscale } from "react-icons/si";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";

const TailScaleMissing = () => {
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
              <Button>
                <DownloadCloudIcon className="h-4 w-4" />
                Install Tailscale
              </Button>
              <Button variant="secondary">
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
