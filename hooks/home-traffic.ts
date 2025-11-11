/**
 * A custom React hook that fetches, parses, and monitors network traffic statistics.
 *
 * This hook communicates with an API endpoint to retrieve data usage information,
 * processes both LTE and NR (5G) traffic data based on the current network mode,
 * and formats byte values into human-readable sizes.
 *
 * @returns An object containing the following properties:
 * - `bytesSent` - A string representing the total bytes sent, formatted with appropriate units (e.g., "10.5 MB")
 * - `bytesReceived` - A string representing the total bytes received, formatted with appropriate units
 * - `lastUpdateTime` - A string representing the timestamp of the last data update
 * - `refresh` - A function that manually triggers a refresh of the traffic statistics
 *
 * @remarks
 * The hook automatically fetches data on mount and sets up a polling interval of 12 seconds
 * to keep the statistics updated. The interval is cleaned up when the component unmounts.
 * Traffic data source depends on network mode:
 * - LTE: Uses only QGDCNT (LTE data)
 * - NR5G-NSA/NR5G-SA: Uses only QGDNRCNT (5G data)
 */
import { useState, useEffect, useCallback } from "react";
import useHomeData from "./home-data";

interface DataUsageEntry {
  datetime: string;
  output: string;
}

const useTrafficStats = () => {
  const [bytesSent, setBytesSent] = useState<string>("0 Bytes");
  const [bytesReceived, setBytesReceived] = useState<string>("0 Bytes");
  const [lastUpdateTime, setLastUpdateTime] = useState<string>("");

  // Get network type from home-data hook
  const { data: homeData } = useHomeData();
  const networkType = homeData?.connection.networkType || "LTE";

  const parseTrafficData = (data: DataUsageEntry | DataUsageEntry[]) => {
    // Handle both single entry and array of entries
    const entry = Array.isArray(data) ? data[data.length - 1] : data;

    if (!entry) return;

    setLastUpdateTime(entry.datetime);

    // Clean up the output string by removing escape sequences
    const cleanOutput = entry.output.replace(/\r\\n/g, "\n").trim();

    // Split into lines and filter out empty lines
    const lines = cleanOutput.split("\n").filter((line) => line.trim());

    // Find QGDCNT and QGDNRCNT lines
    const qgdcntLine = lines.find((line) => line.includes("+QGDCNT:"))?.trim();
    const qgdnrcntLine = lines
      .find((line) => line.includes("+QGDNRCNT:"))
      ?.trim();

    let sent = 0;
    let received = 0;

    // Determine which data to use based on network mode
    if (networkType === "LTE") {
      // LTE mode: Use only QGDCNT
      if (!qgdcntLine) {
        console.error("Missing QGDCNT data for LTE mode");
        return;
      }

      // Parse LTE data usage (QGDCNT)
      // Position 1 is UPLOAD (sent), Position 2 is DOWNLOAD (received)
      const [LTEsent, LTEreceived] = qgdcntLine
        .replace("+QGDCNT:", "")
        .split(",")
        .map((num) => parseInt(num.trim()));

      sent = LTEsent || 0;
      received = LTEreceived || 0;
    } else if (networkType === "NR5G-NSA" || networkType === "NR5G-SA") {
      // 5G mode (NSA or SA): Use only QGDNRCNT
      if (!qgdnrcntLine) {
        console.error("Missing QGDNRCNT data for 5G mode");
        return;
      }

      // Parse NR data usage (QGDNRCNT)
      // Position 1 is UPLOAD (sent), Position 2 is DOWNLOAD (received) for NSA
      if (networkType === "NR5G-NSA") {
        const [NRsent, NRreceived] = qgdnrcntLine
          .replace("+QGDNRCNT:", "")
          .split(",")
          .map((num) => parseInt(num.trim()));
        sent = NRsent || 0;
        received = NRreceived || 0;
      } else if (networkType === "NR5G-SA") {
        // Position 2 is UPLOAD (sent), Position 1 is DOWNLOAD (received) for SA
        const [NRreceived, NRsent] = qgdnrcntLine
          .replace("+QGDNRCNT:", "")
          .split(",")
          .map((num) => parseInt(num.trim()));
        sent = NRsent || 0;
        received = NRreceived || 0;
      }
    } else {
      // Fallback for unknown network types
      console.warn(
        `Unknown network type: ${networkType}, defaulting to LTE data`
      );
      if (qgdcntLine) {
        const [LTEsent, LTEreceived] = qgdcntLine
          .replace("+QGDCNT:", "")
          .split(",")
          .map((num) => parseInt(num.trim()));
        sent = LTEsent || 0;
        received = LTEreceived || 0;
      }
    }

    setBytesSent(formatBytes(sent));
    setBytesReceived(formatBytes(received));
  };

  const fetchTrafficStats = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/fetch_data_usage.sh"
      );
      const data = await response.json();
      parseTrafficData(data);
    } catch (error) {
      console.error("Error fetching traffic stats:", error);
    }
  }, [networkType]);

  useEffect(() => {
    fetchTrafficStats();
    const intervalId = setInterval(fetchTrafficStats, 12000);
    return () => clearInterval(intervalId);
  }, [fetchTrafficStats]);

  const refresh = useCallback(() => {
    fetchTrafficStats();
  }, [fetchTrafficStats]);

  return { bytesSent, bytesReceived, lastUpdateTime, refresh };
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default useTrafficStats;
