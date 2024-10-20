// hooks/bandPrioritization.ts
import { useState, useEffect, useCallback } from 'react';

const bandPrioritization = () => {
    const [activePrioritizedBand, setActivePrioritizedBand] = useState<boolean>(false);

  const fetchTrafficStats = useCallback(async () => {
    const command = 'AT+QNWCFG="lte_band_priority"';
    try {
      const response = await fetch("/api/at-handler", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // body: JSON.stringify({ command }),
        body: encodeURIComponent(command),
      });

      const data = await response.json();

      if (data.output.includes("ERROR") || data.output.includes("0")) {
        setActivePrioritizedBand(false);
      } else {
        setActivePrioritizedBand(true);
      }

      console.log(data);
      console.log(activePrioritizedBand);

    } catch (error) {
      console.error("Error fetching traffic stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchTrafficStats();
    // Set up an interval to fetch data every 5 seconds
    const intervalId = setInterval(fetchTrafficStats, 61000);

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, [fetchTrafficStats]);

  const refresh = useCallback(() => {
    fetchTrafficStats();
  }, [fetchTrafficStats]);

  return { activePrioritizedBand, refresh };
};

export default bandPrioritization;