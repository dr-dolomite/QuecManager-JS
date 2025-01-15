import { useState, useEffect, useCallback } from "react";

interface DataUsageEntry {
  datetime: string;
  output: string;
}

const useTrafficStats = () => {
  const [bytesSent, setBytesSent] = useState<string>("0 Bytes");
  const [bytesReceived, setBytesReceived] = useState<string>("0 Bytes");
  const [lastUpdateTime, setLastUpdateTime] = useState<string>("");

  const parseTrafficData = (data: DataUsageEntry | DataUsageEntry[]) => {
    // Handle both single entry and array of entries
    const entry = Array.isArray(data) ? data[data.length - 1] : data;
    
    if (!entry) return;

    setLastUpdateTime(entry.datetime);

    // Clean up the output string by removing escape sequences
    const cleanOutput = entry.output.replace(/\r\\n/g, "\n").trim();

    // Split into lines and filter out empty lines
    const lines = cleanOutput.split("\n").filter(line => line.trim());
    
    // Find QGDCNT and QGDNRCNT lines
    const qgdcntLine = lines.find(line => line.includes("+QGDCNT:"))?.trim();
    const qgdnrcntLine = lines.find(line => line.includes("+QGDNRCNT:"))?.trim();

    if (!qgdcntLine || !qgdnrcntLine) {
      console.error("Missing required data in response");
      return;
    }

    // Parse LTE data usage (QGDCNT)
    const [LTEreceived, LTEsent] = qgdcntLine
      .replace("+QGDCNT:", "")
      .split(",")
      .map(num => parseInt(num.trim()));

    // Parse NR data usage (QGDNRCNT)
    const [NRsent, NRreceived] = qgdnrcntLine
      .replace("+QGDNRCNT:", "")
      .split(",")
      .map(num => parseInt(num.trim()));

    // Calculate totals
    const sent = (LTEsent || 0) + (NRsent || 0);
    const received = (LTEreceived || 0) + (NRreceived || 0);

    setBytesSent(formatBytes(sent));
    setBytesReceived(formatBytes(received));
  };

  const fetchTrafficStats = useCallback(async () => {
    try {
      const response = await fetch("/cgi-bin/home/fetch_data_usage.sh");
      const data = await response.json();
      parseTrafficData(data);
    } catch (error) {
      console.error("Error fetching traffic stats:", error);
    }
  }, []);

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