import React, { useState, useEffect, useCallback } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MonitorCheckIcon, MonitorOffIcon } from "lucide-react";
import { BiSolidBarChartSquare, BiSolidChart } from "react-icons/bi";

interface PingData {
  time: string;
  ms: number;
  packetLoss: number;
  index: number;
}

interface PingConfig {
  enabled: boolean;
  interval: number;
  host: string;
  running: boolean;
}

const chartConfig = {
  ms: {
    label: "ms",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

const formatTime = () => {
  const now = new Date();
  return now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const PingCard = () => {
  // Load cached data and set initial states - now storing up to 30 data points
  const [chartData, setChartData] = useState<PingData[]>(() => {
    const savedData = localStorage.getItem("pingData");
    return savedData ? JSON.parse(savedData) : [];
  });

  // Load full history for average calculations (up to 30 points)
  const [pingHistory, setPingHistory] = useState<PingData[]>(() => {
    const savedHistory = localStorage.getItem("pingHistory");
    return savedHistory ? JSON.parse(savedHistory) : [];
  });

  const [currentLatency, setCurrentLatency] = useState<number | null>(() => {
    const savedData = localStorage.getItem("pingData");
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      return parsedData.length > 0
        ? parsedData[parsedData.length - 1].ms
        : null;
    }
    return null;
  });

  const [currentPacketLoss, setCurrentPacketLoss] = useState<number | null>(() => {
    const savedData = localStorage.getItem("pingData");
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      return parsedData.length > 0
        ? parsedData[parsedData.length - 1].packetLoss
        : null;
    }
    return null;
  });

  const [config, setConfig] = useState<PingConfig>({
    enabled: true,
    interval: 5,
    host: "8.8.8.8",
    running: false,
  });

  const [isLoading, setIsLoading] = useState(() => {
    const savedData = localStorage.getItem("pingData");
    if (!savedData) return true;

    try {
      const parsedData = JSON.parse(savedData);
      // Only show loading if we have no valid cached data
      return !parsedData || parsedData.length === 0;
    } catch {
      return true;
    }
  });

  const [hasData, setHasData] = useState(() => {
    const savedData = localStorage.getItem("pingData");
    if (!savedData) return false;

    try {
      const parsedData = JSON.parse(savedData);
      return parsedData && parsedData.length > 0;
    } catch {
      return false;
    }
  });

  // Fetch ping data
  const fetchPingData = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/ping/fetch_ping.sh",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) return false;

      const result = await response.json();
      if (result.status === "success" && result.data) {
        const pingResult = result.data;

        // Update current latency
        if (typeof pingResult.latency === "number") {
          setCurrentLatency(pingResult.latency);

          const packetLoss = typeof pingResult.packet_loss === "number" 
            ? pingResult.packet_loss 
            : 0;
          setCurrentPacketLoss(packetLoss);

          // Add to chart data (display - max 5 points)
          const time = formatTime();
          const newDataPoint: PingData = {
            time: time,
            ms: pingResult.latency,
            packetLoss: packetLoss,
            index: 0, // Will be set correctly in the setState function
          };

          // Update chart data (max 5 points for display)
          setChartData((prevData) => {
            let updatedData: PingData[];

            if (prevData.length < 5) {
              // Fill up to 5 points
              updatedData = [...prevData, newDataPoint].map((point, idx) => ({
                ...point,
                index: idx + 1,
              }));
            } else {
              // Shift data points left and add new one
              updatedData = [...prevData.slice(1), newDataPoint].map(
                (point, idx) => ({
                  ...point,
                  index: idx + 1,
                })
              );
            }

            localStorage.setItem("pingData", JSON.stringify(updatedData));
            return updatedData;
          });

          // Update ping history (max 30 points for average calculation)
          setPingHistory((prevHistory) => {
            let updatedHistory: PingData[];

            if (prevHistory.length < 30) {
              // Fill up to 30 points
              updatedHistory = [...prevHistory, newDataPoint];
            } else {
              // Keep last 29 and add new one
              updatedHistory = [...prevHistory.slice(1), newDataPoint];
            }

            localStorage.setItem("pingHistory", JSON.stringify(updatedHistory));
            return updatedHistory;
          });

          setHasData(true);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to fetch ping data:", err);
      return false;
    }
  }, []); // Remove chartData.length dependency

  // Fetch ping configuration
  const fetchPingConfig = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/ping/ping_service.sh",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) return null;

      const result = await response.json();
      if (result.status === "success" && result.data) {
        setConfig(result.data);
        return result.data;
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch ping config:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const initialize = async () => {
      // 1. First fetch config to see if ping monitoring is enabled
      const configResult = await fetchPingConfig();

      // 2. If we don't have cached data, show loading during initial fetch
      const savedData = localStorage.getItem("pingData");
      const hasCachedData = savedData && JSON.parse(savedData).length > 0;

      if (!hasCachedData) {
        setIsLoading(true);
      }

      // 3. Only try to fetch ping data if it's enabled
      if (configResult?.enabled) {
        // Try to fetch existing data
        await fetchPingData();

        // Start polling based on interval from config (convert to milliseconds)
        const pollInterval = Math.max(
          (configResult.interval || 5) * 1000,
          1000
        );
        console.log(
          `Starting ping polling with ${pollInterval}ms interval (${configResult.interval}s from config)`
        );
        intervalId = setInterval(fetchPingData, pollInterval);
      }

      // Always set loading to false after config check and initial fetch
      setIsLoading(false);
    };

    initialize();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchPingConfig, fetchPingData]); // Only depend on the callback functions

  const getYAxisDomain = (): [number, number] => {
    if (chartData.length === 0) return [0, 100];

    const values = chartData.map((d) => d.ms);
    const min = Math.max(0, Math.min(...values) - 5);
    const max = Math.max(...values) + 5;

    return [min, max];
  };

  // Calculate average latency from history (up to 30 points)
  const averageLatency = pingHistory.length > 0
    ? Math.round(pingHistory.reduce((sum, point) => sum + point.ms, 0) / pingHistory.length)
    : currentLatency || 0;

  // Calculate average packet loss from history (up to 30 points)
  const averagePacketLoss = pingHistory.length > 0
    ? Math.round(pingHistory.reduce((sum, point) => sum + point.packetLoss, 0) / pingHistory.length)
    : currentPacketLoss || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Latency Monitoring</CardTitle>
        {!config.enabled ? (
          <MonitorOffIcon className="h-4 w-4 text-red-500" />
        ) : (
          <MonitorCheckIcon className="h-4 w-4 text-green-500" />
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="w-full" />
        ) : !config.enabled ? (
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Ping monitoring is disabled.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Enable it in Settings → Personalization
            </p>
          </div>
        ) : !hasData ? (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Starting ping monitoring...
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <BiSolidBarChartSquare className="h-4 w-4 text-green-600" />
                <p className="text-md font-bold">
               {currentLatency !== null ? `${currentLatency} ms` : "N/A"}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                {averageLatency !== null ? `${averageLatency} ms` : "N/A"} avg
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <BiSolidChart className="h-4 w-4 rotate-180 text-purple-600" />
                <p className="text-md font-bold">
                  {currentPacketLoss !== null ? `${currentPacketLoss}%` : "N/A"}
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                {averagePacketLoss !== null ? `${averagePacketLoss}%` : "N/A"} avg
              </div>
            </div>
          </div>
        )}

        {/* {config.enabled && (
          <div className="mt-2 text-xs text-muted-foreground text-center">
            💡 Connection monitoring optimized via ping service
          </div>
        )} */}
      </CardContent>
    </Card>
  );
};

export default PingCard;
