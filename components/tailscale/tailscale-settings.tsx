import React from "react";
import TailScaleMissing from "./tailscale-missing";
import TailscalePeersComponent from "./tailscale-peers";
import TailScaleActive from "./tailscale-active";
import TailscaleInactive from "./tailscale-inactive";
import TailscaleSettingsLoading from "./tailscale-loading";

const TailScaleSettingsComponent = () => {
  return (
    <div className="grid gap-2">
      <TailscaleSettingsLoading />
      <TailscalePeersComponent />
    </div>
  );
};

export default TailScaleSettingsComponent;
