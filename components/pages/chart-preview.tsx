"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components//ui/card";

import { Button } from "@/components//ui/button";

import Link from "next/link";

import { ChartContainer } from "@/components//ui/chart";
import { Separator } from "@/components//ui/separator";
import { ModeToggle } from "@/components/dark-mode-toggle";
import { calculateSignalPercentage } from "@/utils/signalMetrics";
import { ArrowRightIcon } from "@radix-ui/react-icons";

interface ModemResponse {
  response: string;
}

interface ChartDataItem {
  activity: string;
  value: number;
  label: string;
  fill: string;
}

const processSignalValues = (matches: string[] | null): number | null => {
  if (!matches) return null;

  const validValues = matches.map(Number).filter((val) => val !== -32768);

  if (validValues.length === 0) return null;

  const sum = validValues.reduce((acc, curr) => acc + curr, 0);
  return sum / validValues.length;
};

export default function ChartPreviewSignal() {
  const [rsrp, setRsrp] = useState<number | null>(null);
  const [rsrq, setRsrq] = useState<number | null>(null);
  const [sinr, setSinr] = useState<number | null>(null);
  const [networkType, setNetworkType] = useState<string>("");
  const [bands, setBands] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string>("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/quick-stats");
        const data: ModemResponse[] = await response.json();

        if (data) {
          setRsrp(processSignalValues(data[0].response.match(/-?\d+/g)));
          setRsrq(processSignalValues(data[1].response.match(/-?\d+/g)));
          setSinr(processSignalValues(data[2].response.match(/-?\d+/g)));

          const bands = data[3].response.match(
            /"LTE BAND \d+"|"NR5G BAND \d+"/g
          );

          // Check bands for LTE and NR5G
          const hasLTE = bands?.some((band) => band.includes("LTE"));
          const hasNR5G = bands?.some((band) => band.includes("NR5G"));

          // Get the network type
          if (hasLTE && hasNR5G) {
            setNetworkType("NR5G-NSA");
          } else if (hasLTE) {
            setNetworkType("LTE");
          } else if (hasNR5G) {
            setNetworkType("NR5G-SA");
          } else {
            setNetworkType("No Signal");
          }

          // Parse the bands to only show B<number> for LTE Bands and N<number> for NR5G Bands and then combine them separated by a comma like B1, N78
          const parsedBands = bands?.map((band) => {
            if (band.includes("LTE")) {
              return `B${band.match(/\d+/)}`;
            } else if (band.includes("NR5G")) {
              // Remove quotes and spaces from the band number
              return `N${band.split(" ")[2].replace(/"/g, "").trim()}`;
            }
          });
          if (parsedBands) {
            setBands(parsedBands.join(", "));
          } else {
            setBands("No Signal");
          }
        }

        //   Network Name
        const networkName = data[4].response
          .split("\n")[1]
          .split(":")[1]
          .split(",")[1]
          .replace(/"/g, "")
          .trim();

        if (networkName) {
          setNetworkName(networkName);
        } else {
          setNetworkName("No Signal");
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
    const intervalId = setInterval(fetchStats, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const chartData: ChartDataItem[] = [
    {
      activity: "rsrp",
      value: rsrp !== null ? calculateSignalPercentage("rsrp", rsrp) : 0,
      label: rsrp !== null ? `${rsrp.toFixed(1)} dBm` : "No Signal",
      fill: "hsl(var(--chart-1))",
    },
    {
      activity: "rsrq",
      value: rsrq !== null ? calculateSignalPercentage("rsrq", rsrq) : 0,
      label: rsrq !== null ? `${rsrq.toFixed(1)} dB` : "No Signal",
      fill: "hsl(var(--chart-2))",
    },
    {
      activity: "sinr",
      value: sinr !== null ? calculateSignalPercentage("sinr", sinr) : 0,
      label: sinr !== null ? `${sinr.toFixed(1)} dB` : "No Signal",
      fill: "hsl(var(--chart-3))",
    },
  ];

  return (
    <Card className="xl:max-w-xl xl:w-[800px] max-w-sm">
      <CardHeader>
        <div className="flex flex-row justify-between items-center">
          <CardTitle>QuecManager Quick Stats</CardTitle>
          <ModeToggle />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-row justify-evenly items-center w-full p-2 border-t border-b">
          <div>{networkName}</div>
          <Separator orientation="vertical" className="mx-2 h-10 w-px" />
          <div>{networkType}</div>
          <Separator orientation="vertical" className="mx-2 h-10 w-px" />
          <div>{bands}</div>
        </div>
        <div className="flex gap-4 xl:p-4 p-2 pb-2">
          <ChartContainer
            config={{
              sinr: {
                label: "sinr",
                color: "hsl(var(--chart-1))",
              },
              rsrp: {
                label: "rsrp",
                color: "hsl(var(--chart-2))",
              },
              rsrq: {
                label: "rsrq",
                color: "hsl(var(--chart-3))",
              },
            }}
            className="h-[140px] w-full"
          >
            <BarChart
              margin={{
                left: 0,
                right: 0,
                top: 0,
                bottom: 10,
              }}
              data={chartData}
              layout="vertical"
              barSize={32}
              barGap={2}
            >
              <XAxis type="number" dataKey="value" hide />
              <YAxis
                dataKey="activity"
                type="category"
                tickLine={false}
                tickMargin={4}
                axisLine={false}
                className="uppercase"
              />
              <Bar dataKey="value" radius={5}>
                <LabelList
                  position="insideLeft"
                  dataKey="label"
                  fill="white"
                  offset={8}
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <div className="flex flex-row border-t border-b xl:p-4 p-2 w-full">
          <div className="flex w-full items-center gap-2">
            <div className="grid flex-1 auto-rows-min gap-0.5">
              <div className="text-xs text-muted-foreground">RSRP</div>
              <div className="flex items-baseline gap-1 xl:text-2xl text-md font-bold tabular-nums leading-none">
                {rsrp?.toFixed(1)}
                <span className="text-sm font-normal text-muted-foreground">
                  dBm
                </span>
              </div>
            </div>
            <Separator orientation="vertical" className="mx-2 h-10 w-px" />
            <div className="grid flex-1 auto-rows-min gap-0.5">
              <div className="text-xs text-muted-foreground">RSRQ</div>
              <div className="flex items-baseline gap-1 xl:text-2xl text-md font-bold tabular-nums leading-none">
                {rsrq?.toFixed(1)}
                <span className="text-sm font-normal text-muted-foreground">
                  dB
                </span>
              </div>
            </div>
            <Separator orientation="vertical" className="mx-2 h-10 w-px" />
            <div className="grid flex-1 auto-rows-min gap-0.5">
              <div className="text-xs text-muted-foreground">SINR</div>
              <div className="flex items-baseline gap-1 xl:text-2xl text-md font-bold tabular-nums leading-none">
                {sinr?.toFixed(1)}
                <span className="text-sm font-normal text-muted-foreground">
                  dB
                </span>
              </div>
            </div>
          </div>
        </div>
        <Button asChild>
          <Link href="/login">
            Login to QuecManager
            <ArrowRightIcon className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
