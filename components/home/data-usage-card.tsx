import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
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
const chartData = [
  { month: "Sunday", download: 210, upload: 140 },
  { month: "Monday", download: 186, upload: 80 },
  { month: "Tuesday", download: 305, upload: 200 },
  { month: "Wednesday", download: 237, upload: 120 },
  { month: "Thursday", download: 73, upload: 190 },
  { month: "Friday", download: 209, upload: 130 },
  { month: "Saturday", download: 214, upload: 140 },
];
const chartConfig = {
  download: {
    label: "Download",
    color: "hsl(var(--chart-1))",
  },
  upload: {
    label: "Upload",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const DataUsageCard = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Data Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <Bar dataKey="download" fill="var(--color-download)" radius={4} />
            <Bar dataKey="upload" fill="var(--color-upload)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default DataUsageCard;
