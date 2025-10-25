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
import { MonitorCheckIcon, MonitorOffIcon, WifiOff } from "lucide-react";
import { BiSolidBarChartSquare, BiSolidChart } from "react-icons/bi";
import { usePingMonitor } from "@/hooks/use-ping-monitor";
import { Button } from "@/components/ui/button";

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
const PingCardWebSocket = () => {
  const { historyData, isConnected, error, reconnect } = usePingMonitor();

  const [chartData, setChartData] = useState<PingChartData[]>(() => {
    const savedData = localStorage.getItem("pingChartData");
    return savedData ? JSON.parse(savedData) : [];
  });

  const hasData = historyData !== null && historyData.current !== null;
  const currentData = historyData?.current;

  // Update chart data when new ping data arrives
  useEffect(() => {
    if (currentData && currentData.ok) {
      const time = formatTime();
      const newDataPoint: PingChartData = {
        time,
        latency: currentData.latency || 0,
        packetLoss: currentData.packet_loss || 0,
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
  }, [currentData]);

  // Get current values
  const currentLatency = currentData?.latency ?? null;
  const currentPacketLoss = currentData?.packet_loss ?? null;

  // Get average values from hook
  const averageLatency = historyData?.averageLatency ?? null;
  const averagePacketLoss = historyData?.averagePacketLoss ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Latency Monitoring</CardTitle>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <MonitorCheckIcon className="h-4 w-4 text-green-500" />
          ) : (
            <MonitorOffIcon className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reconnect}
                  className="h-6 text-xs"
                >
                  Reconnect
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PingCardWebSocket;
