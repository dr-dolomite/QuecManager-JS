"use client";

import { useCallback, useState, useEffect } from "react";

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

import { CheckCircle2, CirclePlay, RefreshCcw } from "lucide-react";

// Hooks
import useHomeData from "@/hooks/home-data";
import useDataConnectionState from "@/hooks/home-connection";
import useTrafficStats from "@/hooks/home-traffic";
import BandTable from "@/components/home/band-table";

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
  const { data: homeData, isLoading, refresh: refreshHomeData } = useHomeData();
  const {
    dataConnectionState,
    isStateLoading,
    refresh: refreshConnectionState,
  } = useDataConnectionState();
  const {
    bytesSent,
    bytesReceived,
    refresh: refreshTrafficStats,
  } = useTrafficStats();

  const refreshData = useCallback(() => {
    refreshHomeData();
    refreshConnectionState();
    refreshTrafficStats();
  }, [refreshHomeData, refreshConnectionState, refreshTrafficStats]);

  const [bands, setBands] = useState<newBands[]>([]);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      // Run diagnostics
    } catch (error) {
      console.error("Error running diagnostics:", error);
    } finally {
      setIsRunningDiagnostics(false);
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
          {dataConnectionState !== "Connected" && (
            <Dialog>
              <DialogTrigger>
                <Button variant="secondary">
                  <CirclePlay className="xl:size-6 size-5" />
                  Run Diagnostics
                </Button>
              </DialogTrigger>
              {!isRunningDiagnostics && (
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Diagnostics Result</DialogTitle>
                  </DialogHeader>
                  <DialogDescription>
                    This is the result of the diagnostic test run on your
                    device.
                  </DialogDescription>
                  <div className="grid gap-4 py-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Network Registration</h3>
                      <CheckCircle2 className="text-green-500" />
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">U-SIM State</h3>
                      <CheckCircle2 className="text-green-500" />
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Manual APN</h3>
                      <CheckCircle2 className="text-green-500" />
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">WAN IP</h3>
                      <CheckCircle2 className="text-green-500" />
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Cellular Signal</h3>
                      <CheckCircle2 className="text-green-500" />
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Modem Temperature</h3>
                      <CheckCircle2 className="text-green-500" />
                    </div>

                    <div className="flex items-center justify-between mt-6">
                      <h3 className="font-semibold">Failure Code</h3>
                      <div className="flex space-x-2 items-center">
                        <CheckCircle2 className="text-green-500" />
                        <span>None</span>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              )}
            </Dialog>
          )}
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
