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

interface TwelveHourPingData {
  timestamp: string;
  host: string;
  latency: number;
  packet_loss: number;
  sample_count: number;
}

type ViewMode = "realtime" | "hourly" | "twelvehour" | "daily";

import {
  Card,
  CardContent,
  CardDescription,
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { ArrowUpDown, ListFilter, RefreshCw } from "lucide-react";

export const description =
  "Monitor your internet connection quality over time, including latency and packet loss.";

const chartConfig = {
  latency: {
    label: "Latency",
    color: "hsl(var(--chart-3))",
  },
  packet_loss: {
    label: "Packet Loss",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

const InternetQuality = () => {
  // State management
  const [realtimeDataArray, setRealtimeDataArray] = useState<PingData[]>([]);
  const [hourlyDataArray, setHourlyDataArray] = useState<HourlyPingData[]>([]);
  const [twelveHourDataArray, setTwelveHourDataArray] = useState<TwelveHourPingData[]>([]);
  const [dailyDataArray, setDailyDataArray] = useState<DailyPingData[]>([]);
  const [activeChart, setActiveChart] =
    useState<keyof typeof chartConfig>("latency");
  const [viewMode, setViewMode] = useState<ViewMode>("realtime");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

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

  // Fetch 12-hour aggregated data
  const fetchTwelveHourData = async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/ping/fetch_twelvehour.sh"
      );
      const data = await response.json();

      if (data.status === "success" && Array.isArray(data.data)) {
        setTwelveHourDataArray(data.data);
      } else {
        console.error("Invalid 12-hour data format:", data);
      }
    } catch (error) {
      console.error("Error fetching 12-hour ping data:", error);
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
    fetchTwelveHourData();
    fetchDailyData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchRealtimeData();
      fetchHourlyData();
      fetchTwelveHourData();
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
      : viewMode === "twelvehour"
      ? twelveHourDataArray.map((twelvehour) => ({
          timestamp: twelvehour.timestamp,
          latency: twelvehour.latency || 0,
          packet_loss: twelvehour.packet_loss,
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
      case "twelvehour":
        return {
          description: "12-hour view",
          footer: `Showing ${chartData.length} hourly averages (up to 12 hours)`,
          dataType: "12-hour aggregates",
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

  // Sorting function
  const sortData = <T extends { timestamp: string }>(data: T[]): T[] => {
    const sorted = [...data];
    sorted.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
    return sorted;
  };

  // Get sorted data arrays
  const sortedRealtimeData = sortData(realtimeDataArray);
  const sortedHourlyData = sortData(hourlyDataArray);
  const sortedTwelveHourData = sortData(twelveHourDataArray);
  const sortedDailyData = sortData(dailyDataArray);

  return (
    <div className="flex w-full flex-col gap-6">
      <Tabs
        defaultValue="realtime"
        onValueChange={(value) => setViewMode(value as ViewMode)}
      >
        <TabsList>
          <TabsTrigger value="realtime">Real Time</TabsTrigger>
          <TabsTrigger value="hourly">Hourly</TabsTrigger>
          <TabsTrigger value="twelvehour">12 Hours</TabsTrigger>
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
            <div className="justify-end flex mb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Sort
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={sortOrder === "newest"}
                    onCheckedChange={() => setSortOrder("newest")}
                  >
                    Newest first
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortOrder === "oldest"}
                    onCheckedChange={() => setSortOrder("oldest")}
                  >
                    Oldest first
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                {sortedRealtimeData.length > 0 ? (
                  sortedRealtimeData.map((ping, index) => (
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
            <div className="justify-end flex mb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Sort
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={sortOrder === "newest"}
                    onCheckedChange={() => setSortOrder("newest")}
                  >
                    Newest first
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortOrder === "oldest"}
                    onCheckedChange={() => setSortOrder("oldest")}
                  >
                    Oldest first
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                {sortedHourlyData.length > 0 ? (
                  sortedHourlyData.map((ping, index) => (
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
                      No hourly data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="twelvehour">
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
                      } else if (viewMode === "hourly" || viewMode === "twelvehour") {
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
            <div className="justify-end flex mb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Sort
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={sortOrder === "newest"}
                    onCheckedChange={() => setSortOrder("newest")}
                  >
                    Newest first
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortOrder === "oldest"}
                    onCheckedChange={() => setSortOrder("oldest")}
                  >
                    Oldest first
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                {/* If twelveHourDataArray is not empty */}
                {sortedTwelveHourData.length > 0 ? (
                  sortedTwelveHourData.map((ping, index) => (
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
                      No 12-hour data available.
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
            <div className="justify-end flex mb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Sort
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={sortOrder === "newest"}
                    onCheckedChange={() => setSortOrder("newest")}
                  >
                    Newest first
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortOrder === "oldest"}
                    onCheckedChange={() => setSortOrder("oldest")}
                  >
                    Oldest first
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                {sortedDailyData.length > 0 ? (
                  sortedDailyData.map((ping, index) => (
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
