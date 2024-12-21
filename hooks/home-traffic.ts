import { useState, useEffect, useCallback } from 'react';

interface DataUsageEntry {
  datetime: string;
  output: string;
}

const useTrafficStats = () => {
  const [bytesSent, setBytesSent] = useState<string>("0 Bytes");
  const [bytesReceived, setBytesReceived] = useState<string>("0 Bytes");

  const fetchTrafficStats = useCallback(async () => {
    try {
      const response = await fetch("/cgi-bin/home/fetch_data_usage.sh");
      const latestEntry = await response.json() as DataUsageEntry;
      
      if (latestEntry) {
        const output = latestEntry.output;
        // Split the combined output into individual command responses
        const [qgdcnt, qgdnrcnt] = output.split('+QGDNRCNT:').map(part => part.trim());
        
        // Parse LTE data usage (QGDCNT)
        const [LTEreceived, LTEsent] = qgdcnt
          .replace('+QGDCNT:', '')
          .split(',')
          .map(num => parseInt(num.trim()));
        
        // Parse NR data usage (QGDNRCNT)
        const [NRsent, NRreceived] = qgdnrcnt
          .split(',')
          .map(num => parseInt(num.trim()));
        
        // Calculate totals
        const sent = LTEsent + NRsent;
        const received = LTEreceived + NRreceived;
        
        setBytesSent(formatBytes(sent));
        setBytesReceived(formatBytes(received));
      }
    } catch (error) {
      console.error("Error fetching traffic stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchTrafficStats();
    // Set up an interval to fetch data every 12 seconds
    const intervalId = setInterval(fetchTrafficStats, 12000);
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