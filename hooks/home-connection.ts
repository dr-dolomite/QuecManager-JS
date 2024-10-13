// hooks/useDataConnectionState.ts
import { useState, useEffect } from 'react';

const useDataConnectionState = () => {
  const [dataConnectionState, setDataConnectionState] = useState<string>("Unknown");

  useEffect(() => {
    const fetchDataConnectionState = async () => {
      try {
        const response = await fetch("/api/data-connection-state");
        const data = await response.json();
        setDataConnectionState(data === "ACTIVE" ? "Connected" : "Disconnected");
      } catch (error) {
        console.error("Error fetching data connection state:", error);
        setDataConnectionState("Unknown");
      }
    };

    fetchDataConnectionState();
    // Set up an interval to fetch data every 5 seconds
    const intervalId = setInterval(fetchDataConnectionState, 30000);

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return { dataConnectionState };
};

export default useDataConnectionState;