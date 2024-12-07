"use client";

import { useCallback, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Components
import SimCard from "@/components/home/sim-data";
import Connection from "@/components/home/connection";
import DataTransmission from "@/components/home/data-transmission";
import CellularInformation from "@/components/home/cellular-info";
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
} from "lucide-react";

import PropagateLoader from "react-spinners/PropagateLoader";
import BandTable from "@/components/home/band-table";

// Hooks
import useHomeData from "@/hooks/home-data";
import useDataConnectionState from "@/hooks/home-connection";
import useTrafficStats from "@/hooks/home-traffic";
import useRunDiagnostics from "@/hooks/diagnostics";

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

  const forceRerunScripts = async () => {
    try {
      const response = await fetch("/cgi-bin/settings/force-rerun.sh");
      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Data Refreshed",
          description: "Data and scripts has been refreshed successfully",
        });
      } else if (data.status === "info") {
        toast({
          title: "Data Refreshed",
          description:
            "Data refreshed successfully, but no scripts to restart.",
        });
      } else {
        throw new Error("Failed to restart scripts");
      }
    } catch (error) {
      console.error("Error rerunning scripts:", error);
      toast({
        variant: "destructive",
        title: "Script Restart Failed",
        description: "Failed to restart the required scripts",
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
      await forceRerunScripts();
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Failed to refresh the data",
      });
    }
  }, [refreshHomeData, refreshConnectionState, refreshTrafficStats, toast]);

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

  return (
    <div className="grid xl:gap-y-12 gap-y-8 gap-4">
      <div className="grid xl:gap-6 gap-4">
        <div className="flex flex-row justify-between items-center">
          <div className="flex flex-row gap-2 items-center">
            <h1 className="xl:text-3xl text-lg font-bold">
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
          <Dialog>
            <DialogTrigger>
              <Button variant="secondary" onClick={runDiagnostics}>
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
                  This is the result of the diagnostic test ran on your device.
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

        <div className="grid 2xl:grid-cols-4 lg:grid-cols-2 grid-cols-1 gap-4">
          <SimCard data={homeData} isLoading={isLoading} />
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

      <div className="grid xl:gap-6 gap-4">
        <h1 className="xl:text-3xl text-lg font-bold">Current Active Bands</h1>
        <BandTable bands={bands} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default HomePage;
