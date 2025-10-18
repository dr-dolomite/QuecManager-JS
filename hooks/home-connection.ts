/**
 * React hook for monitoring data connection state with ping monitoring integration.
 * 
 * This hook fetches the current data connection state from the server and 
 * automatically refreshes the state every 30 seconds. When ping monitoring
 * is active, it displays "Ping Monitoring Active" and stops automatic refreshes
 * to avoid redundant network requests and save cellular data. Manual refresh
 * will restart the monitoring cycle.
 * 
 * @returns An object containing:
 *  - `dataConnectionState` - Current connection state ("Connected", "Disconnected", "Ping Active", or "Unknown")
 *  - `refresh` - Function to manually refresh the connection state and restart monitoring
 *  - `isStateLoading` - Boolean indicating if the connection state is currently being fetched
 *  - `isPingMonitoringActive` - Boolean indicating if ping monitoring is currently enabled
 * 
 * @example
 * ```tsx
 * const { dataConnectionState, refresh, isStateLoading, isPingMonitoringActive } = useDataConnectionState();
 * 
 * if (isStateLoading) {
 *   return <p>Loading connection status...</p>;
 * }
 * 
 * return (
 *   <div>
 *     <p>Connection status: {dataConnectionState}</p>
 *     {isPingMonitoringActive && <p>Automatic refresh paused - using ping monitoring</p>}
 *     <button onClick={refresh}>Refresh</button>
 *   </div>
 * );
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface PingConfig {
  enabled: boolean;
  interval: number;
  host: string;
  running: boolean;
}

const useDataConnectionState = () => {
  const [dataConnectionState, setDataConnectionState] = useState<string>("Unknown");
  const [isStateLoading, setIsStateLoading] = useState(true);
  const [isPingMonitoringActive, setIsPingMonitoringActive] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkPingMonitoring = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/cgi-bin/quecmanager/home/ping/ping_service.sh");
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      if (data.status === "success" && data.data) {
        return data.data.enabled === true;
      }
      
      return false;
    } catch (err) {
      console.error("Error checking ping monitoring state:", err);
      return false;
    }
  }, []);

  const clearCurrentInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchDataConnectionState = useCallback(async () => {
    try {
      setIsStateLoading(true);
      
      // Check if ping monitoring is active first
      const pingActive = await checkPingMonitoring();
      setIsPingMonitoringActive(pingActive);
      
      if (pingActive) {
        // If ping monitoring is active, show monitoring status and stop further automatic refreshes
        setDataConnectionState("Connected");
        setIsStateLoading(false);
        
        // Clear the interval to stop automatic refreshes
        clearCurrentInterval();
        return;
      }
      
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
  }, [checkPingMonitoring, clearCurrentInterval]);

  const startInterval = useCallback(() => {
    // Clear any existing interval
    clearCurrentInterval();
    
    // Set up a new interval
    intervalRef.current = setInterval(fetchDataConnectionState, 30000);
  }, [fetchDataConnectionState, clearCurrentInterval]);

  useEffect(() => {
    fetchDataConnectionState();
    startInterval();

    // Clean up the interval on component unmount
    return () => clearCurrentInterval();
  }, [fetchDataConnectionState, startInterval, clearCurrentInterval]);

  const refresh = useCallback(() => {
    // When manually refreshing, always restart the interval
    fetchDataConnectionState();
    startInterval();
  }, [fetchDataConnectionState, startInterval]);

  return { dataConnectionState, refresh, isStateLoading, isPingMonitoringActive };
};

export default useDataConnectionState;