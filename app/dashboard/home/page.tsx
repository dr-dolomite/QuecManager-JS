"use client";

import { useCallback, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Components
import SimCard from "@/components/home/sim-data";
import Connection from "@/components/home/connection";
import DataTransmission from "@/components/home/data-transmission";
import CellularInformation from "@/components/home/cellular-info";
import SignalChart from "@/components/home/signal-chart";
import EthernetCard from "@/components/home/ethernet-card";
import MemoryCard from "@/components/home/memory-card";
import PingCard from "@/components/home/ping-card";

import { Button } from "@/components/ui/button";
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
  EyeOff
} from "lucide-react";

import PropagateLoader from "react-spinners/PropagateLoader";
import BandTable from "@/components/home/band-table";

// Hooks
import useHomeData from "@/hooks/home-data";
import useDataConnectionState from "@/hooks/home-connection";
import useTrafficStats from "@/hooks/home-traffic";
import useRunDiagnostics from "@/hooks/diagnostics";
import { BsSimSlashFill } from "react-icons/bs";
import SpeedtestStream from "@/components/home/speedtest-card";
import { atCommandSender } from "@/utils/at-command";
import NetworkInfoCard from "@/components/home/network-info-card";
import ApproxDistanceCard from "@/components/home/approx-distance-card";

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
  const [noSimDialogOpen, setNoSimDialogOpen] = useState(false);
  const [hideSensitiveData, setHideSensitiveData] = useState(false);
  const { data: homeData, isLoading, refresh: refreshHomeData } = useHomeData();
  const {
    dataConnectionState,
    isStateLoading,
    refresh: refreshConnectionState,
  } = useDataConnectionState();

  const { isRunningDiagnostics, runDiagnosticsData, startDiagnostics } =
    useRunDiagnostics();

  const {
    bytesSent,
    bytesReceived,
    refresh: refreshTrafficStats,
  } = useTrafficStats();

  const sendChangeSimSlot = async () => {
    try {
      // Get the current SIM slot through AT+QUIMSLOT? command
      const currentSimSlotResponse = await atCommandSender("AT+QUIMSLOT?");
      // Extract the current SIM slot number from the response raw_output
      const currentSimSlot = currentSimSlotResponse.response?.raw_output
        .split("\n")[1]
        .split(":")[1]
        .trim();
      const command =
        currentSimSlot === "1" ? "AT+QUIMSLOT=2" : "AT+QUIMSLOT=1";

      // Use atCommandSender instead of direct fetch
      const response = await atCommandSender(command);

      if (
        response.status === "error" ||
        response.response?.status === "error"
      ) {
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
      console.error("Error running diagnostics:", error);
    }
  };

  useEffect(() => {
    if (runDiagnosticsData) {
      console.log("Diagnostics data updated:", runDiagnosticsData);
    }
  }, [runDiagnosticsData]);

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
              { hideSensitiveData ? <Eye className="xl:size-6 size-5" /> : <EyeOff className="xl:size-6 size-5" /> }
                <span className="hidden md:block">{hideSensitiveData ? 'Show' : 'Hide' } Sensitive Data</span>
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
              <DialogTrigger>
                <Button onClick={runDiagnostics}>
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
                      <h3 className="font-semibold">Net Reject Cause</h3>
                      {runDiagnosticsData?.netReject === "None" ? (
                        <div className="flex space-x-2 items-center">
                          <CheckCircle2 className="text-green-500" />
                          <span>None</span>
                        </div>
                      ) : (
                        <div className="flex space-x-2 items-center">
                          <AlertCircle className="text-red-500" />
                          <span>{runDiagnosticsData?.netReject}</span>
                        </div>
                      )}
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
          <div className="grid gap-2 lg:grid-cols-2 grid-cols-1 grid-flow-row">
            {/* <EthernetCard /> */}
            <ApproxDistanceCard
              lteTimeAdvance={homeData?.timeAdvance?.lteTimeAdvance}
              nrTimeAdvance={homeData?.timeAdvance?.nrTimeAdvance}
              isLoading={isLoading}
              networkType={homeData?.connection?.networkType}
            />
            <MemoryCard />
            <SpeedtestStream />
            <PingCard />
          </div>
        </div>

        <div className="grid 2xl:grid-cols-4 lg:grid-cols-2 grid-cols-1 gap-4">
          <SimCard data={homeData} isLoading={isLoading} hideSensitiveData={hideSensitiveData} />
          <Connection
            data={homeData}
            isLoading={isLoading}
            dataConnectionState={dataConnectionState}
            connectionStateLoading={isStateLoading}
          />
          <DataTransmission
            data={homeData}
            isLoading={isLoading}
            bytesSent={bytesSent}
            bytesReceived={bytesReceived}
          />
          <CellularInformation data={homeData} isLoading={isLoading} />
        </div>
      </div>

      <div className="grid gap-4 w-full">
        <h1 className="xl:text-3xl text-base font-bold">Active Addresses</h1>
        <div>
          <NetworkInfoCard
            data={homeData}
            isLoading={isLoading}
            hideSensitiveData={hideSensitiveData}
            // onRefresh={refreshData}
          />
        </div>
      </div>

      <div className="grid gap-4 w-full">
        <h1 className="xl:text-3xl text-base font-bold">
          Current Active Bands
        </h1>
        <div>
          <BandTable bands={bands} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
