"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

// Components
import SignalChart from "@/components/home/signal-chart";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

import {
  AlertCircle,
  CheckCircle2,
  CirclePlay,
  RefreshCcw,
  Eye,
  EyeOff,
} from "lucide-react";

import PropagateLoader from "react-spinners/PropagateLoader";
// import BandTable from "@/components/home/band-table";

// Hooks
import useHomeData from "@/hooks/home-data";
import useDataConnectionState from "@/hooks/home-connection";
import useTrafficStats from "@/hooks/home-traffic";
import useRunDiagnostics from "@/hooks/diagnostics";
import { useWebSocketData } from "@/components/hoc/protected-route";
import { BsSimSlashFill } from "react-icons/bs";
import SpeedtestStream from "@/components/home/speedtest-card";
import { atCommandSender } from "@/utils/at-command";
import BandwidthMonitorCard from "@/components/home/bandwidth-monitor-card";
import SummaryCardComponent from "@/components/home/summary-card";
import BandsAccordionComponent from "@/components/home/bands-accordion";
import MemoryCardWebSocket from "@/components/home/memory-card-websocket";
import PingCardWebSocket from "@/components/home/ping-card-websocket";

interface newBands {
  id: number;
  bandNumber: string;
  earfcn: string;
  bandwidth: string;
  pci: string;
  rsrp: string;
  rsrq: string;
  sinr: string;
}

const HomePage = () => {
  const { toast } = useToast();
  const router = useRouter();
  
  // Get WebSocket data from context
  const websocketData = useWebSocketData();
  
  const [noSimDialogOpen, setNoSimDialogOpen] = useState(false);
  const [profileSetupDialogOpen, setProfileSetupDialogOpen] = useState(false);
  const [hideSensitiveData, setHideSensitiveData] = useState(false);
  const {
    data: homeData,
    isLoading,
    refresh: refreshHomeData,
    isPublicIPLoading,
  } = useHomeData();
  const {
    dataConnectionState,
    isStateLoading,
    refresh: refreshConnectionState,
    isPingMonitoringActive,
  } = useDataConnectionState();

  const { isRunningDiagnostics, runDiagnosticsData, startDiagnostics } =
    useRunDiagnostics();

  const {
    bytesSent,
    bytesReceived,
    refresh: refreshTrafficStats,
  } = useTrafficStats();

  // Check if there's a profile for the current SIM
  const checkProfileForCurrentSim = useCallback(async () => {
    if (!homeData?.simCard?.iccid) return;

    try {
      // First check if profile dialog is enabled in settings
      const dialogSettingsResponse = await fetch(
        "/cgi-bin/quecmanager/settings/profile_dialog.sh"
      );
      if (dialogSettingsResponse.ok) {
        const dialogSettings = await dialogSettingsResponse.json();
        if (
          dialogSettings.status === "success" &&
          dialogSettings.data &&
          !dialogSettings.data.enabled
        ) {
          // Dialog is disabled in settings, don't show
          return;
        }
      }

      // Check if user clicked "Maybe Later" and if 6 hours haven't passed yet
      const maybeLaterKey = `profile-maybe-later-${homeData.simCard.iccid}`;
      const maybeLaterTimestamp = localStorage.getItem(maybeLaterKey);
      if (maybeLaterTimestamp) {
        const sixHoursInMs = 6 * 60 * 60 * 1000;
        const timePassed = Date.now() - parseInt(maybeLaterTimestamp);
        if (timePassed < sixHoursInMs) {
          return; // Don't show dialog if less than 6 hours have passed
        }
      }

      // Check if there are profiles for the current SIM
      const response = await fetch(
        "/cgi-bin/quecmanager/profiles/list_profiles.sh"
      );
      if (!response.ok) return;

      const data = await response.json();

      // Handle both array response and object with profiles array
      let profiles = data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        profiles = data.profiles || [];
      }

      // Ensure profiles is an array
      if (!Array.isArray(profiles)) {
        console.warn("Profiles response is not an array:", data);
        return;
      }

      // Check if any profile matches the current SIM's ICCID
      const currentIccid = homeData.simCard.iccid;
      const hasMatchingProfile = profiles.some(
        (profile: any) => profile.iccid === currentIccid
      );

      // Show dialog if no matching profile found and SIM is inserted
      if (!hasMatchingProfile && homeData.simCard.state === "Inserted") {
        setProfileSetupDialogOpen(true);
      }
    } catch (error) {
      console.error("Error checking profiles:", error);
    }
  }, [homeData?.simCard?.iccid, homeData?.simCard?.state]);

  // Effect to check for profile when home data changes
  useEffect(() => {
    if (homeData && !isLoading) {
      checkProfileForCurrentSim();
    }
  }, [homeData, isLoading, checkProfileForCurrentSim]);

  // Handle "Maybe Later" - show again after 6 hours
  const handleMaybeLater = useCallback(() => {
    if (homeData?.simCard?.iccid) {
      const maybeLaterKey = `profile-maybe-later-${homeData.simCard.iccid}`;
      localStorage.setItem(maybeLaterKey, Date.now().toString());
    }
    setProfileSetupDialogOpen(false);
  }, [homeData?.simCard?.iccid]);

  const sendChangeSimSlot = async () => {
    try {
      // Get the current SIM slot through AT+QUIMSLOT? command
      const currentSimSlotResponse = await atCommandSender("AT+QUIMSLOT?");
      // Extract the current SIM slot number from the response
      const currentSimSlot = currentSimSlotResponse.response
        .split("\n")[1]
        .split(":")[1]
        .trim();
      const command =
        currentSimSlot === "1" ? "AT+QUIMSLOT=2" : "AT+QUIMSLOT=1";

      // Use atCommandSender instead of direct fetch
      const response = await atCommandSender(command);

      if (response.status === "error") {
        throw new Error("Failed to change SIM slot");
      }

      toast({
        title: "SIM Slot Changed",
        description: "The SIM slot has been changed successfully",
      });

      // Wait 3 seconds then send COPS command
      setTimeout(async () => {
        const disconnectCopsCommand = "AT+COPS=2";
        const reconnectCopsCommand = "AT+COPS=0";
        // Disconnect from the network
        const disconnectCopsResponse = await atCommandSender(
          disconnectCopsCommand
        );
        // Wait for 2 seconds before sending out the reconnect command
        setTimeout(async () => {
          // Reconnect to the network
          const reconnectCopsResponse = await atCommandSender(
            reconnectCopsCommand
          );
          if (reconnectCopsResponse.status === "error") {
            throw new Error("Failed to reconnect to the network");
          }
          toast({
            title: "Network Reconnected",
            description: "The device has been reconnected to the network",
          });
        }, 2000);
      }, 3000);

      // After 3 seconds, refresh the data
      setTimeout(refreshData, 3000);
    } catch (error) {
      console.error("Error changing SIM slot:", error);
      toast({
        variant: "destructive",
        title: "SIM Slot Change Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to change the SIM slot",
      });
    }
  };

  const refreshData = useCallback(async () => {
    try {
      // Perform all refresh operations
      await Promise.all([
        refreshHomeData(),
        refreshConnectionState(),
        refreshTrafficStats(),
      ]);

      // After successful refresh, run the force-rerun script
      // await forceRerunScripts();
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Failed to refresh the data",
      });
    }
  }, [refreshHomeData, refreshConnectionState, refreshTrafficStats]);

  const [bands, setBands] = useState<newBands[]>([]);

  const runDiagnostics = async () => {
    try {
      await startDiagnostics();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Diagnostics Failed",
        description: "Failed to run diagnostics",
      });
    }
  };

  useEffect(() => {
    if (homeData && homeData.currentBands) {
      const newBands = homeData.currentBands.id?.map((id, index) => ({
        id,
        bandNumber: homeData.currentBands.bandNumber?.[index] || "N/A",
        earfcn: homeData.currentBands.earfcn?.[index] || "N/A",
        bandwidth: homeData.currentBands.bandwidth?.[index] || "N/A",
        pci: homeData.currentBands.pci?.[index] || "N/A",
        rsrp: homeData.currentBands.rsrp?.[index] || "N/A",
        rsrq: homeData.currentBands.rsrq?.[index] || "N/A",
        sinr: homeData.currentBands.sinr?.[index] || "N/A",
      }));
      if (newBands) {
        setBands(newBands);
      }
    }
  }, [homeData]);

  useEffect(() => {
    if (homeData?.simCard?.state?.toLowerCase().includes("failed")) {
      toast({
        title: "SMS_Tool failed to acquire token",
        description:
          "The system will attempt to recover automatically. If this issue persists, please logout and log back in or restart the device.",
        variant: "destructive",
      });
    }
    if (!isLoading && homeData?.simCard.state === "Not Inserted") {
      setNoSimDialogOpen(true);
    }
  }, [homeData, isLoading]);

  return (
    <div className="grid xl:gap-y-10 gap-y-8 gap-4">
      <div className="grid gap-4">
        <div className="flex flex-row justify-between items-center">
          <div className="flex flex-row gap-2 items-center">
            <h1 className="xl:text-3xl text-base font-bold">
              Connection Summary
            </h1>
            <Button
              variant="ghost"
              size="icon"
              className="text-sm"
              onClick={refreshData}
            >
              <RefreshCcw
                className="xl:size-6 size-5 text-blue-500"
                strokeWidth={3}
              />
            </Button>
          </div>
          <div className="flex flex-row items-center gap-x-2">
            <Button onClick={() => setHideSensitiveData((prev) => !prev)}>
              {hideSensitiveData ? (
                <Eye className="xl:size-6 size-5" />
              ) : (
                <EyeOff className="xl:size-6 size-5" />
              )}
              <span className="hidden md:block">
                {hideSensitiveData ? "Show" : "Hide"} Sensitive Data
              </span>
            </Button>
            {homeData?.simCard.state === "Not Inserted" && (
              <Dialog open={noSimDialogOpen} onOpenChange={setNoSimDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <BsSimSlashFill className="xl:size-6 size-5" />
                    <span className="hidden md:block">No SIM</span>
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-xs md:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>No SIM Detected</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="flex items-center justify-center">
                      <BsSimSlashFill className="xl:size-14 md:size-12 size-6 text-red-500" />
                    </div>
                    <p className="text-center">
                      There is no SIM card detected in the device. Please insert
                      a SIM card or change the SIM card slot to use the device.
                    </p>
                  </div>

                  <div className="flex justify-end mt-4">
                    <Button onClick={sendChangeSimSlot} className="mr-2">
                      Change SIM Slot
                    </Button>
                    <DialogClose asChild>
                      <Button
                        variant="secondary"
                        onClick={() => setNoSimDialogOpen(false)}
                      >
                        Close
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            <Dialog>
              <DialogTrigger asChild>
                <Button onClick={runDiagnostics} variant="secondary">
                  <CirclePlay className="xl:size-6 size-5" />
                  <span className="hidden md:block">Run Diagnostics</span>
                </Button>
              </DialogTrigger>

              {!isRunningDiagnostics && (
                <DialogContent className="max-w-xs md:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Diagnostics Result</DialogTitle>
                  </DialogHeader>
                  <DialogDescription>
                    This is the result of the diagnostic test ran on your
                    device.
                  </DialogDescription>
                  <div className="grid gap-4 py-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Network Registration </h3>
                      {runDiagnosticsData?.netRegistration === "Registered" ? (
                        <CheckCircle2 className="text-green-500" />
                      ) : (
                        <AlertCircle className="text-red-500" />
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">U-SIM State</h3>
                      {runDiagnosticsData?.simState === "READY" ? (
                        <CheckCircle2 className="text-green-500" />
                      ) : (
                        <AlertCircle className="text-red-500" />
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Manual APN</h3>
                      {runDiagnosticsData?.manualAPN === "Enabled" ? (
                        <CheckCircle2 className="text-green-500" />
                      ) : (
                        <AlertCircle className="text-red-500" />
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">WAN IP</h3>
                      {runDiagnosticsData?.wanIP === "Connected" ? (
                        <CheckCircle2 className="text-green-500" />
                      ) : (
                        <AlertCircle className="text-red-500" />
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Cellular Signal</h3>
                      {runDiagnosticsData?.cellSignal === "Good" ? (
                        <CheckCircle2 className="text-green-500" />
                      ) : (
                        <AlertCircle className="text-red-500" />
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Modem Temperature</h3>
                      {runDiagnosticsData?.modemTemp === "Normal" ? (
                        <CheckCircle2 className="text-green-500" />
                      ) : (
                        <AlertCircle className="text-red-500" />
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-6">
                      <h3 className="font-semibold">Network Reject Causes</h3>
                      <div className="flex flex-col items-end space-y-1">
                        {runDiagnosticsData?.rejectCauses ? (
                          <>
                            {runDiagnosticsData.rejectCauses.emm && (
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="text-red-500 w-4 h-4" />
                                <span className="text-sm">
                                  EMM (
                                  {runDiagnosticsData.rejectCauses.emm.code}):{" "}
                                  {
                                    runDiagnosticsData.rejectCauses.emm
                                      .description
                                  }
                                </span>
                              </div>
                            )}
                            {runDiagnosticsData.rejectCauses.esm && (
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="text-red-500 w-4 h-4" />
                                <span className="text-sm">
                                  ESM (
                                  {runDiagnosticsData.rejectCauses.esm.code}):{" "}
                                  {
                                    runDiagnosticsData.rejectCauses.esm
                                      .description
                                  }
                                </span>
                              </div>
                            )}
                            {runDiagnosticsData.rejectCauses.nrmm && (
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="text-red-500 w-4 h-4" />
                                <span className="text-sm">
                                  NRMM (
                                  {runDiagnosticsData.rejectCauses.nrmm.code}):{" "}
                                  {
                                    runDiagnosticsData.rejectCauses.nrmm
                                      .description
                                  }
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="text-green-500" />
                            <span>None</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              )}

              {isRunningDiagnostics && (
                <DialogContent className="max-w-xs md:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Running Diagnostics</DialogTitle>
                  </DialogHeader>
                  <div className="flex items-center justify-center my-4">
                    <PropagateLoader color="#6D28D9" />
                  </div>
                  <DialogDescription className="text-center">
                    Please wait while we run diagnostics on your device.
                  </DialogDescription>
                </DialogContent>
              )}
            </Dialog>
          </div>
        </div>
        <div className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
          <div>
            <SignalChart />
          </div>
          {/* <div>
            <BandwidthMonitorCard />
          </div> */}
          {/* <div><WebSocketComponent /></div> */}
          <div className="grid gap-2 lg:grid-cols-2 grid-cols-1 grid-flow-row">
            {/* <EthernetCard /> */}
            {/* <ApproxDistanceCard
              lteTimeAdvance={homeData?.timeAdvance?.lteTimeAdvance}
              nrTimeAdvance={homeData?.timeAdvance?.nrTimeAdvance}
              isLoading={isLoading}
              networkType={homeData?.connection?.networkType}
            /> */}

            {/* <MemoryCard /> */}
            <PingCardWebSocket websocketData={websocketData} />
            <SpeedtestStream />

          </div>
        </div>

        <div className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
          <SummaryCardComponent
            websocketData={websocketData}
            data={homeData}
            isLoading={isLoading}
            dataConnectionState={dataConnectionState}
            connectionStateLoading={isStateLoading}
            bytesSent={bytesSent}
            bytesReceived={bytesReceived}
            hideSensitiveData={hideSensitiveData}
            bands={bands}
            onDataRefresh={refreshData}
          />
          <BandsAccordionComponent bands={bands} isLoading={isLoading} />
        </div>
      </div>

      <Dialog
        open={profileSetupDialogOpen}
        onOpenChange={setProfileSetupDialogOpen}
      >
        <DialogContent className="lg:max-w-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              Set Up Your QuecProfile
            </DialogTitle>
            <DialogDescription>
              We noticed you don&apos;t have a profile configured for your
              current SIM card.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card className="border-primary p-4 space-y-4">
              <h2 className="font-medium text-primary">
                Setting up a profile will save you time by automatically
                applying your preferred network settings, APN configuration, and
                other cellular preferences.
              </h2>
            </Card>

            <div className="flex flex-col gap-2 mt-4">
              <Button
                onClick={() => {
                  setProfileSetupDialogOpen(false);
                  router.push("/dashboard/custom-features/quecprofiles");
                }}
                className="w-full"
              >
                Set Up Profile Now
              </Button>
              <Button
                variant="outline"
                onClick={handleMaybeLater}
                className="w-full"
              >
                Maybe Later
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setProfileSetupDialogOpen(false);
                  router.push("/dashboard/settings/personalization");
                }}
                className="w-full text-muted-foreground"
                size="sm"
              >
                Disable this dialog in Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Profile Setup Dialog */}
      <Dialog
        open={profileSetupDialogOpen}
        onOpenChange={setProfileSetupDialogOpen}
      >
        <DialogContent className="lg:max-w-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              Set Up Your QuecProfile
            </DialogTitle>
            <DialogDescription>
              We noticed you don&apos;t have a profile configured for your
              current SIM card.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card className="border-primary p-4 space-y-4">
              <h2 className="font-medium text-primary">
                Setting up a profile will save you time by automatically
                applying your preferred network settings, APN configuration, and
                other cellular preferences.
              </h2>
              {/* <div className="space-y-2">
                <h4 className="font-medium">
                  Benefits of setting up a profile:
                </h4>
                <ul className="text-sm space-y-1">
                  <li>• Automatic network configuration</li>
                  <li>• Quick switching between SIM cards</li>
                  <li>• Backup and restore your settings</li>
                  <li>• Optimized performance for your carrier</li>
                </ul>
              </div> */}
            </Card>

            <div className="flex flex-col gap-2 mt-4">
              <Button
                onClick={() => {
                  setProfileSetupDialogOpen(false);
                  router.push("/dashboard/custom-features/quecprofiles");
                }}
                className="w-full"
              >
                Set Up Profile Now
              </Button>
              <Button
                variant="outline"
                onClick={handleMaybeLater}
                className="w-full"
              >
                Maybe Later
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setProfileSetupDialogOpen(false);
                  router.push("/dashboard/settings/personalization");
                }}
                className="w-full text-muted-foreground"
                size="sm"
              >
                Disable this dialog in Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomePage;
