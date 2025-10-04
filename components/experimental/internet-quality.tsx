"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

// Types for PingData Array
interface PingData {
  timestamp: string;
  host: string;
  latency: number;
  packet_loss: number;
  ok: boolean;
}

interface HourlyPingData {
  timestamp: string;
  host: string;
  latency: number;
  packet_loss: number;
  sample_count: number;
}

interface DailyPingData {
  timestamp: string;
  host: string;
  latency: number;
  packet_loss: number;
  sample_count: number;
}

type ViewMode = "realtime" | "hourly" | "daily";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const description =
  "Monitor your internet connection quality over time, including latency and packet loss.";

const chartConfig = {
  latency: {
    label: "Latency",
    color: "hsl(var(--chart-2))",
  },
  packet_loss: {
    label: "Packet Loss",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

const InternetQuality = () => {
  // State management
  const [realtimeDataArray, setRealtimeDataArray] = useState<PingData[]>([]);
  const [hourlyDataArray, setHourlyDataArray] = useState<HourlyPingData[]>([]);
  const [dailyDataArray, setDailyDataArray] = useState<DailyPingData[]>([]);
  const [activeChart, setActiveChart] =
    useState<keyof typeof chartConfig>("latency");
  const [viewMode, setViewMode] = useState<ViewMode>("realtime");

  // Fetch real-time data (max 15 entries, rolling window)
  const fetchRealtimeData = async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/ping/fetch_historical.sh"
      );
      const data = await response.json();

      if (data.status === "success" && Array.isArray(data.data)) {
        setRealtimeDataArray(data.data);
      } else {
        console.error("Invalid real-time data format:", data);
      }
    } catch (error) {
      console.error("Error fetching real-time ping data:", error);
    }
  };

  // Fetch hourly aggregated data (up to 24 entries)
  const fetchHourlyData = async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/ping/fetch_hourly.sh"
      );
      const data = await response.json();

      if (data.status === "success" && Array.isArray(data.data)) {
        setHourlyDataArray(data.data);
      } else {
        console.error("Invalid hourly data format:", data);
      }
    } catch (error) {
      console.error("Error fetching hourly ping data:", error);
    }
  };

  // Fetch daily aggregated data
  const fetchDailyData = async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/ping/fetch_daily.sh"
      );
      const data = await response.json();

      if (data.status === "success" && Array.isArray(data.data)) {
        setDailyDataArray(data.data);
      } else {
        console.error("Invalid daily data format:", data);
      }
    } catch (error) {
      console.error("Error fetching daily ping data:", error);
    }
  };

  // Fetch all data types on mount and set up auto-refresh
  useEffect(() => {
    fetchRealtimeData();
    fetchHourlyData();
    fetchDailyData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchRealtimeData();
      fetchHourlyData();
      fetchDailyData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Transform data based on view mode
  const chartData =
    viewMode === "realtime"
      ? realtimeDataArray.map((ping) => ({
          timestamp: ping.timestamp,
          latency: ping.latency || 0,
          packet_loss: ping.packet_loss,
        }))
      : viewMode === "hourly"
      ? hourlyDataArray.map((hourly) => ({
          timestamp: hourly.timestamp,
          latency: hourly.latency || 0,
          packet_loss: hourly.packet_loss,
        }))
      : dailyDataArray.map((daily) => ({
          timestamp: daily.timestamp,
          latency: daily.latency || 0,
          packet_loss: daily.packet_loss,
        }));

  // Calculate totals/averages for the metric cards
  const total = {
    latency:
      chartData.length > 0
        ? Math.round(
            chartData.reduce((acc, curr) => acc + curr.latency, 0) /
              chartData.length
          )
        : 0,
    packet_loss:
      chartData.length > 0
        ? Math.round(
            chartData.reduce((acc, curr) => acc + curr.packet_loss, 0) /
              chartData.length
          )
        : 0,
  };

  // Get description and label for current view mode
  const getViewInfo = () => {
    switch (viewMode) {
      case "realtime":
        return {
          description: "Real-time view",
          footer: `Showing ${chartData.length} data points (rolling window)`,
          dataType: "Real-time data",
        };
      case "hourly":
        return {
          description: "Hourly view",
          footer: `Showing ${chartData.length} hourly averages (up to 24 hours)`,
          dataType: "Hourly aggregates",
        };
      case "daily":
        return {
          description: "Daily view",
          footer: `Showing ${chartData.length} daily averages`,
          dataType: "Daily aggregates",
        };
    }
  };

  const viewInfo = getViewInfo();

  return (
    <div className="flex w-full flex-col gap-6">
      <Tabs
        defaultValue="realtime"
        onValueChange={(value) => setViewMode(value as ViewMode)}
      >
        <TabsList>
          <TabsTrigger value="realtime">Real Time</TabsTrigger>
          <TabsTrigger value="hourly">Hourly</TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
        </TabsList>
        <TabsContent value="realtime">
          <Card className="py-0">
            <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
              <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:py-6">
                <div className="flex items-center justify-between">
                  <CardTitle>Internet Quality Monitor</CardTitle>
                </div>
                <CardDescription>{viewInfo.description}</CardDescription>
              </div>
              <div className="flex">
                {(["latency", "packet_loss"] as const).map((key) => {
                  return (
                    <button
                      key={key}
                      data-active={activeChart === key}
                      className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
                      onClick={() => setActiveChart(key)}
                    >
                      <span className="text-muted-foreground text-xs">
                        {chartConfig[key].label}
                      </span>
                      <span className="text-md leading-none font-bold sm:text-3xl">
                        {total[key].toLocaleString()}
                        {key === "latency" ? "ms" : "%"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:p-6">
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-[250px] w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 12,
                    right: 12,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      if (viewMode === "realtime") {
                        return date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                      } else if (viewMode === "hourly") {
                        return date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                        });
                      } else {
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="w-[180px]"
                        labelFormatter={(value) => {
                          if (viewMode === "daily") {
                            return new Date(value).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            });
                          }
                          return new Date(value).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey={activeChart}
                    fill={`var(--color-${activeChart})`}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Latency</TableHead>
                  <TableHead>Packet Loss</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {realtimeDataArray.length > 0 ? (
                  realtimeDataArray.map((ping, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {ping.ok ? `${ping.latency} ms` : "Timeout"}
                      </TableCell>
                      <TableCell>{ping.packet_loss}%</TableCell>
                      <TableCell>
                        {new Date(ping.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        {new Date(ping.timestamp).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      No real-time data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="hourly">
          <Card className="py-0">
            <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
              <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:py-6">
                <div className="flex items-center justify-between">
                  <CardTitle>Internet Quality Monitor</CardTitle>
                </div>
                <CardDescription>{viewInfo.description}</CardDescription>
              </div>
              <div className="flex">
                {(["latency", "packet_loss"] as const).map((key) => {
                  return (
                    <button
                      key={key}
                      data-active={activeChart === key}
                      className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
                      onClick={() => setActiveChart(key)}
                    >
                      <span className="text-muted-foreground text-xs">
                        {chartConfig[key].label}
                      </span>
                      <span className="text-md leading-none font-bold sm:text-3xl">
                        {total[key].toLocaleString()}
                        {key === "latency" ? "ms" : "%"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:p-6">
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-[250px] w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 12,
                    right: 12,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      if (viewMode === "realtime") {
                        return date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                      } else if (viewMode === "hourly") {
                        return date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                        });
                      } else {
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="w-[180px]"
                        labelFormatter={(value) => {
                          if (viewMode === "daily") {
                            return new Date(value).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            });
                          }
                          return new Date(value).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey={activeChart}
                    fill={`var(--color-${activeChart})`}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Latency</TableHead>
                  <TableHead>Packet Loss</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* If hourlyDataArray is not empty */}
                {hourlyDataArray.length > 0 ? (
                  hourlyDataArray.map((ping, index) => (
                    <TableRow key={index}>
                      <TableCell>{`${ping.latency} ms`}</TableCell>
                      <TableCell>{ping.packet_loss}%</TableCell>
                      <TableCell>
                        {new Date(ping.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        {new Date(ping.timestamp).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      No daily data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="daily">
          <Card className="py-0">
            <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
              <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:py-6">
                <div className="flex items-center justify-between">
                  <CardTitle>Internet Quality Monitor</CardTitle>
                </div>
                <CardDescription>{viewInfo.description}</CardDescription>
              </div>
              <div className="flex">
                {(["latency", "packet_loss"] as const).map((key) => {
                  return (
                    <button
                      key={key}
                      data-active={activeChart === key}
                      className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
                      onClick={() => setActiveChart(key)}
                    >
                      <span className="text-muted-foreground text-xs">
                        {chartConfig[key].label}
                      </span>
                      <span className="text-md leading-none font-bold sm:text-3xl">
                        {total[key].toLocaleString()}
                        {key === "latency" ? "ms" : "%"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:p-6">
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-[250px] w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 12,
                    right: 12,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      if (viewMode === "realtime") {
                        return date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                      } else if (viewMode === "hourly") {
                        return date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                        });
                      } else {
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="w-[180px]"
                        labelFormatter={(value) => {
                          if (viewMode === "daily") {
                            return new Date(value).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            });
                          }
                          return new Date(value).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey={activeChart}
                    fill={`var(--color-${activeChart})`}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Latency</TableHead>
                  <TableHead>Packet Loss</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* If dailyDataArray is not empty */}
                {dailyDataArray.length > 0 ? (
                  dailyDataArray.map((ping, index) => (
                    <TableRow key={index}>
                      <TableCell>{`${ping.latency} ms`}</TableCell>
                      <TableCell>{ping.packet_loss}%</TableCell>
                      <TableCell>
                        {new Date(ping.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        {new Date(ping.timestamp).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      No daily data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InternetQuality;
