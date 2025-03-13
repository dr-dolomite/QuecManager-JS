import React, { useState, useEffect, useRef } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "../ui/badge";

interface PingData {
  time: string;
  ms: number;
  index: number;
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
  // Load cached data and set initial states based on what's available
  const [chartData, setChartData] = useState<PingData[]>(() => {
    const savedData = localStorage.getItem("pingData");
    const parsedData = savedData ? JSON.parse(savedData) : [];
    return parsedData;
  });

  // Keep a stable reference to chartData for the useEffect
  const chartDataRef = useRef(chartData);
  useEffect(() => {
    chartDataRef.current = chartData;
  }, [chartData]);

  // Initialize currentLatency with the most recent value from localStorage if available
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

  // Set initial loading state based on whether we have cached data
  const [isLoading, setIsLoading] = useState(() => {
    const savedData = localStorage.getItem("pingData");
    return !savedData || JSON.parse(savedData).length === 0;
  });

  const [hasFreshData, setHasFreshData] = useState(false);

  useEffect(() => {
    const fetchPingLatency = async () => {
      try {
        const response = await fetch(
          "/cgi-bin/quecmanager/home/ping_latency.sh",
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data: { latency: number } = await response.json();

        // Update latency value with animation
        setCurrentLatency((prev) => {
          // If this is fresh data and we had a previous value, animate
          if (prev !== null && !hasFreshData) {
            animateNumber(prev, data.latency, (val) => setCurrentLatency(val));
            return prev; // Return previous value initially for smooth animation
          }
          return data.latency;
        });

        // Format time
        const time = formatTime();

        // Get current data for index calculation
        const currentData = chartDataRef.current;

        // Create new data point
        const newDataPoint: PingData = {
          time: time,
          ms: data.latency,
          index: currentData.length > 0 ? 5 : 1, // Always use consistent indices
        };

        setChartData((prevData) => {
          let updatedData: PingData[];

          if (prevData.length === 0) {
            // First data point - create 5 identical points for animation
            updatedData = Array(5)
              .fill(null)
              .map((_, i) => ({
                ...newDataPoint,
                index: i + 1,
                time: i === 4 ? time : formatTime(),
              }));
          } else if (prevData.length < 5) {
            // Fill remaining slots with the new point
            const newPoints = Array(5 - prevData.length)
              .fill(null)
              .map((_, i) => ({
                ...newDataPoint,
                index: prevData.length + i + 1,
              }));
            updatedData = [...prevData, ...newPoints];
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

        setHasFreshData(true);

        if (isLoading) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch ping latency", err);

        if (isLoading && chartData.length > 0) {
          setIsLoading(false);
        }
      }
    };

    // Animate number changes for smooth transitions
    const animateNumber = (
      start: number,
      end: number,
      callback: (val: number) => void
    ) => {
      // Increase duration from 1000ms to 1500ms for smoother animation
      const duration = 1500;
      const startTime = performance.now();
      const difference = end - start;

      const step = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Use a gentler cubic ease-in-out function
        const easeProgress =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const current = Math.round(start + difference * easeProgress);

        callback(current);

        if (progress < 1) {
          requestAnimationFrame(step);
        }
      };

      requestAnimationFrame(step);
    };

    fetchPingLatency();
    const interval = setInterval(fetchPingLatency, 5000);
    return () => clearInterval(interval);
  }, []);

  const getYAxisDomain = (): [number, number] => {
    if (chartData.length === 0) return [0, 100];

    const values = chartData.map((d) => d.ms);
    const min = Math.max(0, Math.min(...values) - 5);
    const max = Math.max(...values) + 5;

    return [min, max];
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Ping Latency</CardTitle>
        {currentLatency !== null && (
          <Badge
            className={`text-normal font-bold transition-opacity duration-200 ${
              !hasFreshData ? "opacity-70" : ""
            }`}
          >
            {currentLatency} ms {!hasFreshData && "(cached)"}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <ChartContainer config={chartConfig}>
            <AreaChart
              accessibilityLayer
              data={chartData}
              margin={{
                top: 5,
                right: 10,
                left: 0,
                bottom: 5,
              }}
            >
              <defs>
                <linearGradient id="fillPing" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-ms)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-ms)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeOpacity={0.2}
              />
              <XAxis
                dataKey="index"
                tickLine={false}
                axisLine={false}
                tickMargin={5}
                tick={{ fontSize: 9 }}
                ticks={[1, 2, 3, 4, 5]}
              />
              <YAxis
                hide={false}
                domain={getYAxisDomain()}
                tickLine={false}
                axisLine={false}
                width={20}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => `${value}`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value, entry) => {
                      const dataPoint = chartData.find(
                        (d) => d.index === value
                      );
                      return dataPoint ? `${dataPoint.time}` : value;
                    }}
                    formatter={(value, name) => [`${value} ms`, `Latency`]}
                  />
                }
              />
              <Area
                dataKey="ms"
                type="monotone"
                stroke="var(--color-ms)"
                strokeWidth={2}
                fill="url(#fillPing)"
                activeDot={{ r: 4, strokeWidth: 0 }}
                // Increase animation duration for smoother transitions
                isAnimationActive={true}
                animationDuration={1200}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default PingCard;
