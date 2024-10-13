"use client";

import { useCallback } from "react";

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

const HomePage = () => {
  const { data: homeData, isLoading, refresh: refreshHomeData } = useHomeData();
  const { dataConnectionState, refresh: refreshConnectionState } = useDataConnectionState();
  const { bytesSent, bytesReceived, refresh: refreshTrafficStats } = useTrafficStats();

  {/* Add rotation when the icon was clicked */}
  const refreshData = useCallback(() => {
    refreshHomeData();
    refreshConnectionState();
    refreshTrafficStats();
    
  }, [refreshHomeData, refreshConnectionState, refreshTrafficStats]);

  return (
    <div className="grid xl:gap-y-12 gap-y-8 gap-4">
      <div className="grid xl:gap-6 gap-4">
        <div className="flex flex-row gap-2">
          <h1 className="xl:text-3xl text-lg font-bold">Connection Summary</h1>
          <Button variant="ghost" size="icon" className="text-sm" onClick={refreshData}>
            <RefreshCcw className="xl:size-6 size-5 text-blue-500" strokeWidth={3} />
          </Button>
        </div>

        <div className="grid 2xl:grid-cols-4 lg:grid-cols-2 grid-cols-1 gap-4">
          <SimCard data={homeData} isLoading={isLoading} />
          <Connection
            data={homeData}
            isLoading={isLoading}
            dataConnectionState={dataConnectionState}
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
          <h1 className="xl:text-3xl text-lg font-bold">Band Tables</h1>
      </div>
    </div>
  );
};

export default HomePage;