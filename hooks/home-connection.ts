import { useState, useEffect, useCallback } from 'react';

const useDataConnectionState = () => {
  const [dataConnectionState, setDataConnectionState] = useState<string>("Unknown");

  const fetchDataConnectionState = useCallback(async () => {
    try {
      const response = await fetch("/api/data-connection-state");
      const data = await response.json();
      setDataConnectionState(data === "ACTIVE" ? "Connected" : "Disconnected");
    } catch (error) {
      console.error("Error fetching data connection state:", error);
      setDataConnectionState("Unknown");
    }
  }, []);

  useEffect(() => {
    fetchDataConnectionState();
    // Set up an interval to fetch data every 30 seconds
    const intervalId = setInterval(fetchDataConnectionState, 30000);

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, [fetchDataConnectionState]);

  const refresh = useCallback(() => {
    fetchDataConnectionState();
  }, [fetchDataConnectionState]);

  return { dataConnectionState, refresh };
};

export default useDataConnectionState;