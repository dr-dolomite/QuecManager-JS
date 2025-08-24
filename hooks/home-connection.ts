/**
 * React hook for monitoring data connection state.
 * 
 * This hook fetches the current data connection state from the server and 
 * automatically refreshes the state every 30 seconds. It also provides
 * functionality to manually refresh the connection state.
 * 
 * @returns An object containing:
 *  - `dataConnectionState` - Current connection state ("Connected", "Disconnected", or "Unknown")
 *  - `refresh` - Function to manually refresh the connection state
 *  - `isStateLoading` - Boolean indicating if the connection state is currently being fetched
 * 
 * @example
 * ```tsx
 * const { dataConnectionState, refresh, isStateLoading } = useDataConnectionState();
 * 
 * if (isStateLoading) {
 *   return <p>Loading connection status...</p>;
 * }
 * 
 * return (
 *   <div>
 *     <p>Connection status: {dataConnectionState}</p>
 *     <button onClick={refresh}>Refresh</button>
 *   </div>
 * );
 * ```
 */

import { useState, useEffect, useCallback } from 'react';

const useDataConnectionState = () => {
  const [dataConnectionState, setDataConnectionState] = useState<string>("Unknown");
  const [isStateLoading, setIsStateLoading] = useState(true);

  const fetchDataConnectionState = useCallback(async () => {
    try {
      setIsStateLoading(true);
      const response = await fetch("/cgi-bin/quecmanager/home/check_net.sh");
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