import React, { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

interface PingData {
  time: string;
  ms: number;
}

const chartConfig = {
  ms: {
    label: "ms",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

const formatTime = () => {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const PingCard = () => {
  // Load initial data from local storage or use an empty array
  const [chartData, setChartData] = useState<PingData[]>(() => {
    const savedData = localStorage.getItem('pingData');
    return savedData ? JSON.parse(savedData) : [];
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const fetchPingLatency = async () => {
      try {
        const response = await fetch('http://192.168.224.1/cgi-bin/home/ping_latency.sh', {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data: { latency: number } = await response.json();
        
        // Create new data point
        const newDataPoint: PingData = {
          time: formatTime(),
          ms: data.latency
        };

        // Update chart data, keeping only last 10 points
        const updatedData = [...chartData, newDataPoint].slice(-5);
        
        // Update state and local storage
        setChartData(updatedData);
        localStorage.setItem('pingData', JSON.stringify(updatedData));

        // Remove initial load state
        if (isInitialLoad) {
          setIsInitialLoad(false);
        }
      } catch (err) {
        console.error('Failed to fetch ping latency', err);
        
        // Ensure initial load state is removed even on error
        if (isInitialLoad) {
          setIsInitialLoad(false);
        }
      }
    };

    // Fetch immediately
    fetchPingLatency();

    // Set up interval to fetch every 5 seconds
    const intervalId = setInterval(fetchPingLatency, 60000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [isInitialLoad, chartData]);

  // Loading skeleton for initial load
  if (isInitialLoad) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ping Latency</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[200px]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ping Latency</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Line
              dataKey="ms"
              type="natural"
              stroke="var(--color-ms)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default PingCard;