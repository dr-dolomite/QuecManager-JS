import React, { useEffect, useState, useCallback } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { MonitorCheckIcon, MonitorOffIcon, WifiOff } from "lucide-react";
import { BiSolidBarChartSquare, BiSolidChart } from "react-icons/bi";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Import and use the WebSocket data context, setup the type inteface for the prop
import { useWebSocketData } from "@/components/hoc/protected-route";
interface PingCardWebSocketProps {
  websocketData?: any;
}

interface WebSocketPingData {
  type: string;
  host: string;
  latency: number;
  packet_loss: number;
  ok: boolean;
  timestamp: string;
}


interface PingConfig {
  enabled: boolean;
  interval: number;
  host: string;
  running: boolean;
}

interface PingChartData {
  time: string;
  latency: number;
  packetLoss: number;
  index: number;
}

const chartConfig = {
  latency: {
    label: "Latency (ms)",
    color: "hsl(var(--chart-4))",
  },
  packetLoss: {
    label: "Packet Loss (%)",
    color: "hsl(var(--chart-5))",
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

/**
 * Ping Card Component with WebSocket Support
 *
 * This component uses WebSocket (via websocat) for real-time ping monitoring.
 * Displays latency and packet loss metrics with area chart visualization.
 *
 * Features:
 * - Real-time updates via WebSocket
 * - Area chart showing last 6 data points
 * - Current and average latency/packet loss display
 * - Connection status indicator
 * - Manual reconnect option
 */

// Pass the websocketData prop from layout or use context into the component to handle processing and formatting
const PingCardWebSocket = ({ websocketData: propWebsocketData }: PingCardWebSocketProps) => {
  // Use prop if provided, otherwise fall back to context
  const contextWebsocketData = useWebSocketData();
  const websocketData = propWebsocketData || contextWebsocketData;

  const [chartData, setChartData] = useState<PingChartData[]>(() => {
    const savedData = localStorage.getItem("pingChartData");
    return savedData ? JSON.parse(savedData) : [];
  });

  const [config, setConfig] = useState<PingConfig>({
    enabled: false,
    interval: 5,
    host: "8.8.8.8",
    running: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [historyBuffer, setHistoryBuffer] = useState<WebSocketPingData[]>([]);
  const [lastPingData, setLastPingData] = useState<WebSocketPingData | null>(null);

  // Determine if we have ping data from websocket
  const hasPingData = websocketData?.channel === 'ping';
  const isConnected = !!websocketData;

  const hasData = lastPingData !== null || chartData.length > 0;
  // Use lastPingData to persist the current data instead of resetting to null
  const currentData = lastPingData;
  // Calculate averages from history buffer
  const calculateAverages = () => {
    if (historyBuffer.length === 0) return { avgLatency: 0, avgPacketLoss: 0 };

    const totalLatency = historyBuffer.reduce((sum, point) => sum + point.latency, 0);
    const totalPacketLoss = historyBuffer.reduce((sum, point) => sum + point.packet_loss, 0);

    return {
      avgLatency: Math.round(totalLatency / historyBuffer.length),
      avgPacketLoss: Math.round(totalPacketLoss / historyBuffer.length),
    };
  };
  
  const averages = calculateAverages();

  // Fetch ping configuration to check if enabled
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

  // Check config on mount
  useEffect(() => {
    const initialize = async () => {
      await fetchPingConfig();
      setIsLoading(false);
    };
    initialize();
  }, [fetchPingConfig]);

  // Update chart data when new ping data arrives (only if enabled)
  useEffect(() => {
    if (!config.enabled) {
      // Clear chart data when disabled
      setChartData([]);
      setHistoryBuffer([]);
      return;
    }

    if (hasPingData && websocketData) {
      const pingData = websocketData as WebSocketPingData;
      
      // Update last known ping data
      setLastPingData(pingData);

      if (pingData.ok) {
        // Add to history buffer
        setHistoryBuffer((prev) => {
          const updated = [...prev, pingData];
          // Keep only last 30 data points for averages
          return updated.slice(-30);
        });

        const time = formatTime();
        const newDataPoint: PingChartData = {
          time,
          latency: pingData.latency || 0,
          packetLoss: pingData.packet_loss || 0,
          index: 0, // Will be set correctly below
        };

        setChartData((prevData) => {
          let updatedData: PingChartData[];

          if (prevData.length < 6) {
            // Fill up to 6 points
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

          localStorage.setItem("pingChartData", JSON.stringify(updatedData));
          return updatedData;
        });
      }
    }
  }, [websocketData, hasPingData, config.enabled]);

  // Get current values
  const currentLatency = currentData?.latency ?? null;
  const currentPacketLoss = currentData?.packet_loss ?? null;

  // Get average values from calculated averages
  const averageLatency = averages.avgLatency > 0 ? averages.avgLatency : null;
  const averagePacketLoss = averages.avgPacketLoss > 0 ? averages.avgPacketLoss : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Latency Monitoring</CardTitle>
        <div className="flex items-center gap-2">
          {!config.enabled ? (
            <MonitorOffIcon className="h-4 w-4 text-red-500" />
          ) : isConnected ? (
            <MonitorCheckIcon className="h-4 w-4 text-green-500" />
          ) : (
            <MonitorOffIcon className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-36" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
        ) : !config.enabled ? (
          <div className="mt-4 flex flex-col items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Ping monitoring is disabled.
            </p>
            <Link href="/dashboard/settings/personalization">
              <p className="text-xs text-muted-foreground mt-1">
                Enable it in{" "}
                <span className="underline underline-offset-4 text-blue-600">
                  Settings
                </span>
              </p>
            </Link>
          </div>
        ) : !hasData ? (
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-36" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
        ) : (
          <>
            {/* Current and Average Stats */}
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
                    {currentPacketLoss !== null
                      ? `${currentPacketLoss}%`
                      : "N/A"}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {averagePacketLoss !== null ? `${averagePacketLoss}%` : "N/A"}{" "}
                  avg
                </div>
              </div>
            </div>

            {/* Connection Status Footer */}
            {!isConnected && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Disconnected from WebSocket
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PingCardWebSocket;
