"use client";

import { useCallback, useState, useEffect } from "react";

// Components
import SimCard from "@/components/home/sim-data";
import Connection from "@/components/home/connection";
import DataTransmission from "@/components/home/data-transmission";
import CellularInformation from "@/components/home/cellular-info";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";

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
  const { dataConnectionState, isStateLoading, refresh: refreshConnectionState } =
    useDataConnectionState();
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

  useEffect(() => {
    if (homeData && homeData.currentBands) {
      const newBands = homeData.currentBands.id?.map((id, index) => ({
        id,
        bandNumber: homeData.currentBands.bandNumber?.[index] || "",
        earfcn: homeData.currentBands.earfcn?.[index] || "",
        bandwidth: homeData.currentBands.bandwidth?.[index] || "",
        pci: homeData.currentBands.pci?.[index] || "",
        rsrp: homeData.currentBands.rsrp?.[index] || "",
        rsrq: homeData.currentBands.rsrq?.[index] || "",
        sinr: homeData.currentBands.sinr?.[index] || "",
      }));
      if (newBands) {
        setBands(newBands);
      }
    }
  }, [homeData]);

  return (
    <div className="grid xl:gap-y-12 gap-y-8 gap-4">
      <div className="grid xl:gap-6 gap-4">
        <div className="flex flex-row gap-2 items-center">
          <h1 className="xl:text-3xl text-lg font-bold">Connection Summary</h1>
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
