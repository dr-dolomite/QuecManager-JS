"use client";
// Components
import SimCard from '@/components/home/sim-data';
import Connection from '@/components/home/connection';
import DataTransmission from '@/components/home/data-transmission';
import CellularInformation from '@/components/home/cellular-info';

// Hooks
import useHomeData from '@/hooks/home-data';
import useDataConnectionState from '@/hooks/home-connection';
import useTrafficStats from '@/hooks/home-traffic';

const HomePage = () => {
  const { data: homeData, isLoading } = useHomeData();
  const { dataConnectionState } = useDataConnectionState();
  const { bytesSent, bytesReceived } = useTrafficStats();

  return (
    <div>
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
  );
};

export default HomePage;