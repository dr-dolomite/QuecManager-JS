/**
 * Custom hook that fetches and processes cellular modem data for the home dashboard.
 * This hook handles data fetching, processing, error handling, and automatic refresh at regular intervals.
 *
 * The hook fetches data from the API endpoint `/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=1`
 * and transforms the raw response into a structured {@link HomeData} format with information about:
 * - SIM card details (slot, state, provider, etc.)
 * - Connection information (APN, network type, temperature, etc.)
 * - Data transmission metrics (carrier aggregation, bandwidth, signal strength)
 * - Cellular information (cell ID, tracking area code, signal quality)
 * - Current bands information (band numbers, EARFCN, PCI, signal metrics)
 *
 * @returns An object containing:
 * - `data` - The processed cellular modem information, or null if not yet loaded
 * - `isLoading` - Boolean indicating if data is currently being fetched
 * - `error` - Any error that occurred during data fetching, or null if no error
 * - `refresh` - Function to manually trigger a data refresh
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refresh } = useHomeData();
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * return <HomeDisplay data={data} onRefresh={refresh} />;
 * ```
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/auth";


const heartbeat = () => {
  const [isServerAlive, setIsServerAlive] = useState<boolean>(true);
  const { logout } = useAuth(); // Assuming you have a logout function in your auth hook
  const HEARTBEAT_INTERVAL = 5 * 1000; // Check server every 5 seconds
  
  useEffect(() => {

    // Start heartbeat check
    const heartbeatInterval = setInterval(
      checkServerStatus,
      HEARTBEAT_INTERVAL
    );

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, []);



  // Helper functions for data processing
  // New function to check server status
  async function checkServerStatus() {
    try {
      const response = await fetch("/cgi-bin/quecmanager/heartbeat.sh", {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        handleServerDown();
        return;
      }

      const result = await response.json();
      if (!result.alive) {
        handleServerDown();
      } else {
        setIsServerAlive(true);
      }
    } catch (error) {
      handleServerDown();
    }
  }

  function handleServerDown() {
    setIsServerAlive(false);
    logout();
  }

  return { isServerAlive };
};

export default heartbeat;
