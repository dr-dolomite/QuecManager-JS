"use client";

import React from "react";
import TailScaleMissing from "./tailscale-missing";
import TailscalePeersComponent from "./tailscale-peers";
import TailScaleActive from "./tailscale-active";
import TailscaleInactive from "./tailscale-inactive";
import TailscaleSettingsLoading from "./tailscale-loading";
import { useTailscaleStatus } from "@/hooks/use-tailscale-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import TailscaleError from "./tailscale-error";
import TailscaleAuth from "./tailscale-auth";

const TailScaleSettingsComponent = () => {
  const { status, isLoading, error, refetch } = useTailscaleStatus();

  // Show loading state
  if (isLoading) {
    return (
      <div className="grid gap-2">
        <TailscaleSettingsLoading />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="grid gap-2">
        <TailscaleError errorMessage={error} onRefresh={refetch} />
      </div>
    );
  }

  // Show appropriate component based on status
  if (!status) {
    return (
      <div className="grid gap-2">
        <TailscaleError errorMessage={error} onRefresh={refetch} />
      </div>
    );
  }

  // State 3: Not installed
  if (!status.installed) {
    return (
      <div className="grid gap-2">
        <TailScaleMissing onRefresh={refetch} />
      </div>
    );
  }

  // State 2: Installed but not running
  if (!status.running) {
    return (
      <div className="grid gap-2">
        <TailscaleInactive onRefresh={refetch} />
      </div>
    );
  }

  // State 4: Installed, running, but not authenticated
  if (!status.authenticated) {
    console.log("Authentication State - loginUrl:", status.login_url);
    return (
      <div className="grid gap-2">
        <TailscaleAuth loginUrl={status.login_url} onRefresh={refetch} />
      </div>
    );
  }

  // State 1: Installed, running, and authenticated
  return (
    <div className="grid gap-2">
      <TailScaleActive />
      <TailscalePeersComponent />
    </div>
  );
};

export default TailScaleSettingsComponent;
