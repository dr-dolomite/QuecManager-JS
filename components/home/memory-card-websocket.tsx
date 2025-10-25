import React, { useEffect, useState } from "react";
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
import { MonitorCheckIcon, WifiIcon } from "lucide-react";
import { useMemoryMonitor } from "@/hooks/use-memory-monitor";

interface MemoryChartData {
  time: string;
  total: number;
  used: number;
  available: number;
  index: number;
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
 * - Real-time updates via WebSocket
 * - Area chart showing last 10 data points
 * - Used and Available memory visualization
 * - Current usage percentage badge
 */
const MemoryCardWebSocket = () => {
  const { historyData, isConnected, error, reconnect } = useMemoryMonitor();
  
  const [chartData, setChartData] = useState<MemoryChartData[]>(() => {
    const savedData = localStorage.getItem("memoryChartData");
    return savedData ? JSON.parse(savedData) : [];
  });

  const hasData = historyData !== null;

  // Update chart data when new memory data arrives
  useEffect(() => {
    if (historyData && historyData.current) {
      const time = formatTime();
      const newDataPoint: MemoryChartData = {
        time,
        total: formatMemoryMB(historyData.current.total),
        used: formatMemoryMB(historyData.current.used),
        available: formatMemoryMB(historyData.current.available),
        index: 0, // Will be set correctly below
      };

      setChartData((prevData) => {
        let updatedData: MemoryChartData[];

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

        localStorage.setItem("memoryChartData", JSON.stringify(updatedData));
        return updatedData;
      });
    }
  }, [historyData]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>
          Device Memory Usage
        </CardTitle>
        <div className="flex items-center gap-2">
          <MonitorCheckIcon className={`h-4 w-4 ${isConnected ? 'text-green-500' : 'text-gray-400'}`} />
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[200px] flex flex-col items-center justify-center">
            <Skeleton className="h-8 w-32 mb-2" />
            <p className="text-sm text-muted-foreground">
              {isConnected ? "Waiting for data..." : "Connecting..."}
            </p>
            {error && (
              <p className="text-xs text-red-500 mt-1">{error}</p>
            )}
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
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
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
                  <linearGradient id="fillAvailable" x1="0" y1="0" x2="0" y2="1">
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
