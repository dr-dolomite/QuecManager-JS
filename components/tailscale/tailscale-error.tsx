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
  // Determine if this is a no internet error
  const isNoInternetError = errorMessage?.toLowerCase().includes("no internet") || 
                           errorMessage?.toLowerCase().includes("internet connection");
  
  const displayTitle = isNoInternetError ? "No Internet Connection" : "Tailscale Status Error";
  const displayMessage = isNoInternetError 
    ? "Your device has no internet connection. Tailscale requires internet access to authenticate and establish VPN connections."
    : errorMessage || "An unknown error occurred";
  
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
            <EmptyTitle>{displayTitle}</EmptyTitle>
            <EmptyDescription>
              {displayMessage}
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
