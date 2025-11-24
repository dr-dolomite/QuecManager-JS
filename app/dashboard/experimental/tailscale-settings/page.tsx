import TailScaleSettingsComponent from "@/components/tailscale/tailscale-settings";
import React from "react";

const TailScaleSettingsPage = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          Tailscale Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your Tailscale VPN settings and view connection status.
        </p>
      </div>
      <TailScaleSettingsComponent />
    </div>
  );
};

export default TailScaleSettingsPage;
