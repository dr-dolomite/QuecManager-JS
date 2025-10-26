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

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "../ui/button";
import { RefreshCcwIcon } from "lucide-react";

interface TailscaleErrorProps {
  errorMessage: string | null;
  onRefresh: () => void;
}

const TailscaleError = ({ errorMessage, onRefresh }: TailscaleErrorProps) => {
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
            <EmptyTitle>Tailscale Status Error</EmptyTitle>
            <EmptyDescription>
              {errorMessage || "unknown"}. Please try again.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={onRefresh}>
              <RefreshCcwIcon />
              Refresh Status
            </Button>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
};

export default TailscaleError;
