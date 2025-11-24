/**
 * A custom React hook that fetches, parses, and monitors network traffic statistics.
 *
 * This hook communicates with an API endpoint to retrieve data usage information,
 * processes traffic data based on the current network mode, and formats byte values
 * into human-readable sizes.
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
 * - SA/NSA: Uses +QGDNRCNT (First value: Download, Second value: Upload)
 * - Otherwise: Uses +QGDCNT (First value: Upload, Second value: Download)
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

    let sent = 0;
    let received = 0;

    // Determine which command to use based on network mode
    const isNR = networkType === "NR5G-NSA" || networkType === "NR5G-SA";

    if (isNR) {
      // SA/NSA mode: Use +QGDNRCNT (First: Download, Second: Upload)
      const qgdnrcntLine = lines.find((line) => line.includes("+QGDNRCNT:"))?.trim();
      
      if (!qgdnrcntLine) {
        console.error("Missing +QGDNRCNT data for SA/NSA mode");
        return;
      }

      const [download, upload] = qgdnrcntLine
        .replace("+QGDNRCNT:", "")
        .split(",")
        .map((num) => parseInt(num.trim()));

      sent = upload || 0;
      received = download || 0;
    } else {
      // Other modes: Use +QGDCNT (First: Upload, Second: Download)
      const qgdcntLine = lines.find((line) => line.includes("+QGDCNT:"))?.trim();
      
      if (!qgdcntLine) {
        console.error("Missing +QGDCNT data");
        return;
      }

      const [upload, download] = qgdcntLine
        .replace("+QGDCNT:", "")
        .split(",")
        .map((num) => parseInt(num.trim()));

      sent = upload || 0;
      received = download || 0;
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
