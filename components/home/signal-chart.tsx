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
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { Skeleton } from "../ui/skeleton";

interface SignalMetrics {
  datetime: string;
  output: string;
}

interface ChartDataPoint {
  time: string;
  rsrp: number;
  rsrq: number;
  sinr: number;
}

const chartConfig = {
  signal: {
    label: "LTE Signal Metrics",
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
  // Extract numbers that are part of the signal readings (after +Q... and before LTE/NR5G)
  const matches = output.matchAll(/\+Q(?:RSRP|RSRQ|SINR):\s*([-\d,]+)(?=,(?:LTE|NR5G))/g);
  const allNumbers: number[] = [];

  for (const match of matches) {
    if (match[1]) {
      const numbers = match[1].split(',').map(Number);
      allNumbers.push(...numbers);
    }
  }

  // Filter out invalid values (-140 and -32768)
  const validNumbers = allNumbers.filter(num => num !== -140 && num !== -32768);

  // Return 0 if no valid numbers after filtering
  if (validNumbers.length === 0) return 0;

  // Calculate average of remaining numbers
  const sum = validNumbers.reduce((acc, curr) => acc + curr, 0);

  return Math.round(sum / validNumbers.length);
};

const SignalChart = () => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [activeChart, setActiveChart] =
    useState<keyof typeof chartConfig>("rsrp");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignalMetrics = useCallback(async () => {
    try {
      const response = await fetch("/cgi-bin/home/fetch_signal_metrics.sh");

      if (!response.ok) {
        throw new Error("Failed to fetch signal metrics");
      }

      const data = await response.json();

      const transformedData: ChartDataPoint[] = data.rsrp.map(
        (item: SignalMetrics, index: number) => ({
          time: item.datetime,
          rsrp: parseSignalOutput(item.output),
          rsrq: parseSignalOutput(data.rsrq[index]?.output || ""),
          sinr: parseSignalOutput(data.sinr[index]?.output || ""),
        })
      );

      setChartData(transformedData);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      setChartData([]);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignalMetrics();
    const intervalId = setInterval(fetchSignalMetrics, 15000);
    return () => clearInterval(intervalId);
  }, [fetchSignalMetrics]);

  const currentValues = chartData.length > 0 ? chartData[chartData.length - 1] : {
    rsrp: 0,
    rsrq: 0,
    sinr: 0
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
          <CardTitle>Signal Metrics</CardTitle>
          <CardDescription>Realtime Signal performance</CardDescription>
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
                    {currentValues[key as keyof typeof currentValues].toFixed(0)}
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
            <Line
              dataKey={activeChart}
              type="monotone"
              stroke={`var(--color-${activeChart})`}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 font-medium leading-none">
          The tabs show the average value for each metric.
        </div>
        <div className="leading-none text-muted-foreground italic">
          The higher the value, the better the signal quality.
        </div>
      </CardFooter>
    </Card>
  );
};

export default SignalChart;