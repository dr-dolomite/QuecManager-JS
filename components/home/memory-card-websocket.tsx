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
import { Badge } from "@/components/ui/badge";
import { MonitorCheckIcon, MonitorOffIcon, WifiIcon } from "lucide-react";
import { useWebSocketData } from "@/components/hoc/protected-route";

import Link from "next/link";

interface MemoryCardWebSocketProps {
  websocketData?: any;
}

interface MemoryConfig {
  enabled: boolean;
  interval: number;
  running: boolean;
}

interface MemoryChartData {
  time: string;
  total: number;
  used: number;
  available: number;
  index: number;
}

interface WebSocketMemoryData {
  channel: string;
  total: number;
  used: number;
  available: number;
  timestamp: string;
}

const chartConfig = {
  total: {
    label: "Total",
    color: "hsl(var(--chart-1))",
  },
  used: {
    label: "Used",
    color: "hsl(var(--chart-3))",
  },
  available: {
    label: "Available",
    color: "hsl(var(--chart-2))",
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

const formatMemoryMB = (bytes: number): number => {
  return Math.round(bytes / (1024 * 1024));
};

const formatMemoryBadge = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${Math.round(mb)} MB`;
  }
  return `${(mb / 1024).toFixed(1)} GB`;
};

/**
 * Memory Card Component with WebSocket Support and Chart
 *
 * This component uses WebSocket (via websocat) for real-time memory monitoring.
 * Displays memory usage in an area chart similar to ping-card.
 *
 * Features:
 * - Real-time updates via WebSocket context
 * - Area chart showing last 6 data points
 * - Used and Available memory visualization
 * - Current usage percentage badge
 */
const MemoryCardWebSocket = ({ websocketData: propWebsocketData }: MemoryCardWebSocketProps) => {
  const contextWebsocketData = useWebSocketData();
  const websocketData = propWebsocketData || contextWebsocketData;

  const [chartData, setChartData] = useState<MemoryChartData[]>(() => {
    const savedData = localStorage.getItem("memoryChartData");
    return savedData ? JSON.parse(savedData) : [];
  });

  const [config, setConfig] = useState<MemoryConfig>({
    enabled: false,
    interval: 1,
    running: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [historyBuffer, setHistoryBuffer] = useState<WebSocketMemoryData[]>([]);

  // Determine if we have memory data from websocket
  const hasMemoryData = websocketData?.channel === 'memory';
  const isConnected = !!websocketData;

  // Fetch memory configuration to check if enabled
  const fetchMemoryConfig = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/memory/memory_service.sh",
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
      console.error("Failed to fetch memory config:", err);
      return null;
    }
  }, []);

  // Check config on mount
  useEffect(() => {
    const initialize = async () => {
      await fetchMemoryConfig();
      setIsLoading(false);
    };
    initialize();
  }, [fetchMemoryConfig]);

  // Update chart data when new memory data arrives via WebSocket
  useEffect(() => {
    if (!config.enabled) {
      // Clear chart data when disabled
      setChartData([]);
      setHistoryBuffer([]);
      return;
    }

    if (hasMemoryData) {
      const memoryData = websocketData as WebSocketMemoryData;
      // Add to history buffer
      setHistoryBuffer(prev => {
        const updated = [...prev, memoryData];
        // Keep only last 6 data points
        return updated.slice(-6);
      });

      // Update chart data
      setHistoryBuffer(currentHistory => {
        const chartDataPoints = currentHistory.map((point, idx) => ({
          time: new Date(point.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          total: formatMemoryMB(point.total),
          used: formatMemoryMB(point.used),
          available: formatMemoryMB(point.available),
          index: idx + 1,
        }));
        setChartData(chartDataPoints);
        localStorage.setItem("memoryChartData", JSON.stringify(chartDataPoints));

        return currentHistory;
      });
    }
  }, [websocketData, hasMemoryData, config.enabled]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Device Memory Usage</CardTitle>
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
          <div className="h-[200px] flex items-center justify-center">
            <Skeleton className="h-8 w-32" />
          </div>
        ) : !config.enabled ? (
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Memory monitoring is disabled.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <Link href="/dashboard/settings/personalization">
                Enable it in{" "}
                <span className="underline underline-offset-4 text-blue-600">
                  Settings
                </span>
              </Link>
            </p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {isConnected ? "Waiting for data..." : "Connecting..."}
            </p>
          </div>
        ) : (
          <> 
            <ChartContainer config={chartConfig}>
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="index"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <defs>
                  <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-total)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-total)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="fillUsed" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-used)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-used)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient
                    id="fillAvailable"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-available)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-available)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <Area
                  dataKey="available"
                  type="natural"
                  fill="url(#fillAvailable)"
                  fillOpacity={0.4}
                  stroke="var(--color-available)"
                  stackId="a"
                />
                <Area
                  dataKey="used"
                  type="natural"
                  fill="url(#fillUsed)"
                  fillOpacity={0.4}
                  stroke="var(--color-used)"
                  stackId="a"
                />
                <Area
                  dataKey="total"
                  type="natural"
                  fill="url(#fillTotal)"
                  fillOpacity={0.4}
                  stroke="var(--color-total)"
                  stackId="a"
                />
              </AreaChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MemoryCardWebSocket;
