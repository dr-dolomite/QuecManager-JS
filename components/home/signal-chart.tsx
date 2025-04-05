import { useCallback, useState, useEffect } from "react";
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
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  AreaChart,
  Area,
  YAxis,
} from "recharts";
import { Skeleton } from "../ui/skeleton";

interface SignalMetrics {
  datetime: string;
  output: string;
}

interface SignalResponse {
  rsrp: SignalMetrics[];
  rsrq: SignalMetrics[];
  sinr: SignalMetrics[];
}

interface ChartDataPoint {
  time: string;
  rsrp: number;
  rsrq: number;
  sinr: number;
}

const chartConfig = {
  signal: {
    label: "LTE/5G Signal Metrics",
  },
  rsrp: {
    label: "RSRP",
    color: "hsl(var(--chart-1))",
  },
  rsrq: {
    label: "RSRQ",
    color: "hsl(var(--chart-2))",
  },
  sinr: {
    label: "SINR",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

const parseSignalOutput = (output: string): number => {
  // Split the output into LTE and NR5G parts if they exist
  const parts = output.split("\n").filter((part) => part.trim());

  // Extract all numbers from both LTE and NR5G readings
  const allNumbers: number[] = [];

  parts.forEach((part) => {
    const numbers = part.match(/-?\d+/g);
    if (numbers) {
      allNumbers.push(...numbers.map(Number));
    }
  });

  // Filter out invalid values (-140 and -32768)
  const validNumbers = allNumbers.filter(
    (num) => num !== -140 && num !== -32768
  );

  // Return 0 if no valid numbers after filtering
  if (validNumbers.length === 0) return 0;

  // Calculate average of remaining numbers
  const sum = validNumbers.reduce((acc, curr) => acc + curr, 0);
  return Math.round(sum / validNumbers.length);
};

const SignalChart = () => {
  // Initialize with 5 data points to show a graph right away
  const [chartData, setChartData] = useState<ChartDataPoint[]>(() => {
    const now = new Date();
    return Array.from({ length: 5 }, (_, i) => ({
      time: new Date(now.getTime() - (4 - i) * 3000).toISOString(),
      rsrp: 0,
      rsrq: 0,
      sinr: 0,
    }));
  });
  const [activeChart, setActiveChart] =
    useState<keyof typeof chartConfig>("rsrp");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignalMetrics = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/fetch_signal_metrics.sh"
      );

      if (!response.ok) {
        throw new Error("Failed to fetch signal metrics");
      }

      let data: SignalResponse;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Error parsing JSON:", jsonError);
        throw new Error("Failed to parse signal metrics data");
      }

      // Ensure all arrays have the same length
      const length = Math.min(
        data.rsrp.length,
        data.rsrq.length,
        data.sinr.length
      );

      if (length === 0) {
        throw new Error("No signal metrics data available");
      }

      const transformedData: ChartDataPoint[] = Array.from(
        { length },
        (_, i) => ({
          time: data.rsrp[i].datetime,
          rsrp: parseSignalOutput(data.rsrp[i].output),
          rsrq: parseSignalOutput(data.rsrq[i].output),
          sinr: parseSignalOutput(data.sinr[i].output),
        })
      );

      setChartData(transformedData);
      setError(null);
    } catch (err) {
      console.error("Error fetching metrics:", err);
      // Set error but don't clear chart data, so the graph remains visible
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      
      // Add a new data point with zeros rather than clearing the chart
      const now = new Date().toISOString();
      setChartData(prevData => {
        // Keep last 20 points to prevent excessive memory usage
        const newData = [...prevData];
        if (newData.length >= 20) {
          newData.shift();
        }
        newData.push({
          time: now,
          rsrp: 0,
          rsrq: 0,
          sinr: 0
        });
        return newData;
      });
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // Helper function to determine the correct baseValue for each metric
  const getBaseValue = (metric: keyof typeof chartConfig): number => {
    switch (metric) {
      case "rsrp":
        return -140; // RSRP typically ranges from -70 to -140 dBm
      case "rsrq":
        return -20; // RSRQ typically ranges from -5 to -20 dB
      case "sinr":
        return -10; // SINR can go negative, so start below the lowest expected value
      default:
        return 0;
    }
  };

  // Helper function to determine the appropriate Y axis domain for each metric
  // Modify the return type to support 'auto' as a valid value
  const getYAxisDomain = (
    metric: keyof typeof chartConfig
  ): [number, number | "auto"] => {
    switch (metric) {
      case "rsrp":
        return [-140, -60]; // RSRP range
      case "rsrq":
        return [-20, 0]; // RSRQ range
      case "sinr":
        return [-10, 30]; // SINR range
      default:
        return [0, "auto"];
    }
  };

  useEffect(() => {
    fetchSignalMetrics();
    const intervalId = setInterval(fetchSignalMetrics, 15000);
    return () => clearInterval(intervalId);
  }, [fetchSignalMetrics]);

  const currentValues =
    chartData.length > 0
      ? chartData[chartData.length - 1]
      : {
          rsrp: 0,
          rsrq: 0,
          sinr: 0,
        };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Signal Metrics</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>Antenna Port Signal Metrics</CardTitle>
          <CardDescription>
            Per-port signal values averaged across all active ports
          </CardDescription>
        </div>
        <div className="flex">
          {["rsrp", "rsrq", "sinr"].map((key) => {
            const chart = key as keyof typeof chartConfig;
            return (
              <button
                key={chart}
                data-active={activeChart === chart}
                className="flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6"
                onClick={() => setActiveChart(chart)}
              >
                <span className="text-xs text-muted-foreground">
                  {chartConfig[chart].label}
                </span>
                {isInitialLoading ? (
                  <Skeleton className="lg:h-10 h-6 w-full" />
                ) : (
                  <span className="text-base font-bold leading-none sm:text-3xl">
                    {currentValues[key as keyof typeof currentValues].toFixed(
                      0
                    )}
                  </span>
                )}
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
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <defs>
              {/* Define gradients for each metric */}
              <linearGradient id="fillRsrp" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-rsrp)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-rsrp)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillRsrq" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-rsrq)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-rsrq)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillSinr" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-sinr)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-sinr)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                });
              }}
            />
            {/* Add YAxis with domain to control the visible range */}
            <YAxis hide={true} domain={getYAxisDomain(activeChart)} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[200px]"
                  nameKey="metric"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    });
                  }}
                />
              }
            />
            <Area
              dataKey={activeChart}
              type="monotone"
              stroke={`var(--color-${activeChart})`}
              fill={`url(#fill${
                activeChart.charAt(0).toUpperCase() + activeChart.slice(1)
              })`}
              strokeWidth={2}
              activeDot={{ r: 4 }}
              baseValue={getBaseValue(activeChart)}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 font-medium leading-none">
          These metrics show the aggregate antenna port measurements, not the
          per-band values.
        </div>
        <div className="leading-none text-muted-foreground italic">
          Higher values indicate better signal quality.
        </div>
      </CardFooter>
    </Card>
  );
};

export default SignalChart;
