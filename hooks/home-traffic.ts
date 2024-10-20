// hooks/useTrafficStats.ts
import { useState, useEffect, useCallback } from 'react';

const useTrafficStats = () => {
  const [bytesSent, setBytesSent] = useState<string>("0 Bytes");
  const [bytesReceived, setBytesReceived] = useState<string>("0 Bytes");

  const fetchTrafficStats = useCallback(async () => {
    const command = "AT+QGDCNT?";
    try {
      const response = await fetch("/api/at-handler", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command }),
        // body: `command=${encodeURIComponent(command)}`,
      });

      const data = await response.json();

      const sent = parseInt(data.output.split("\n")[1].split(":")[1].split(",")[0]);
      const received = parseInt(data.output.split("\n")[1].split(":")[1].split(",")[1]);

      setBytesSent(formatBytes(sent));
      setBytesReceived(formatBytes(received));
    } catch (error) {
      console.error("Error fetching traffic stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchTrafficStats();
    // Set up an interval to fetch data every 5 seconds
    const intervalId = setInterval(fetchTrafficStats, 2000);

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, [fetchTrafficStats]);

  const refresh = useCallback(() => {
    fetchTrafficStats();
  }, [fetchTrafficStats]);

  return { bytesSent, bytesReceived, refresh };
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default useTrafficStats;