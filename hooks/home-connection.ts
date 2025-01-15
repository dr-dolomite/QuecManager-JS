import { useState, useEffect, useCallback } from 'react';

const useDataConnectionState = () => {
  const [dataConnectionState, setDataConnectionState] = useState<string>("Unknown");
  const [isStateLoading, setIsStateLoading] = useState(true);

  const fetchDataConnectionState = useCallback(async () => {
    try {
      setIsStateLoading(true);
      const response = await fetch("/cgi-bin/home/check_net.sh");
      // const response = await fetch("/data-connection-state");
      const data = await response.json();
      setDataConnectionState(data.connection === "ACTIVE" ? "Connected" : "Disconnected");
      setIsStateLoading(false);
    } catch (error) {
      console.error("Error fetching data connection state:", error);
      setDataConnectionState("Unknown");
      setIsStateLoading(false);
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

  return { dataConnectionState, refresh, isStateLoading };
};

export default useDataConnectionState;