// hooks/useTrafficStats.ts
import { useState, useEffect, useCallback } from 'react';

const useTrafficStats = () => {
  const [bytesSent, setBytesSent] = useState<string>("0 Bytes");
  const [bytesReceived, setBytesReceived] = useState<string>("0 Bytes");

  const fetchTrafficStats = useCallback(async () => {
    const command = "AT+QGDCNT?;+QGDNRCNT?";
    try {
      // const response = await fetch("/api/at-handler", {
      const response = await fetch("/cgi-bin/atinout_handler.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // body: JSON.stringify({ command }),
        body: `command=${encodeURIComponent(command)}`,
      });

      const data = await response.json();
      // console.log("Traffic stats data:", data);

      const LTEreceived = parseInt(data.output.split("\n")[1].split(":")[1].split(",")[0]);
      const LTEsent = parseInt(data.output.split("\n")[1].split(":")[1].split(",")[1]);
      const NRsent = parseInt(data.output.split("\n")[3].split(":")[1].split(",")[0]);
      const NRreceived = parseInt(data.output.split("\n")[3].split(":")[1].split(",")[1]);
      const sent = LTEsent + NRsent;
      const received = LTEreceived + NRreceived;

      setBytesSent(formatBytes(sent));
      setBytesReceived(formatBytes(received));
    } catch (error) {
      console.error("Error fetching traffic stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchTrafficStats();
    // Set up an interval to fetch data every 2 seconds
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