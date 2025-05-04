"use client";

import { useEffect, useState, useRef } from "react";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChartContainer } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
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

interface SignalData {
  rsrp: number | null;
  rsrq: number | null;
  sinr: number | null;
  networkType: string;
  bands: string | null;
  networkName: string;
}

const processSignalValues = (matches: string[] | null): number | null => {
  if (!matches) return null;
  const validValues = matches.map(Number).filter((val) => val !== -32768 && val !== 5 && val !== -140);
  if (validValues.length === 0) return null;
  const sum = validValues.reduce((acc, curr) => acc + curr, 0);
  return Math.round(sum / validValues.length);
};

export default function ChartPreviewSignal() {
  const [signalData, setSignalData] = useState<SignalData>({
    rsrp: null,
    rsrq: null,
    sinr: null,
    networkType: "",
    bands: null,
    networkName: "",
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const previousData = useRef<SignalData | null>(null);

  useEffect(() => {
    const fetchCapabilities = async () => {
      try {
        const response = await fetch("/cgi-bin/quecmanager/get-capabilities.sh");
        const data: ModemResponse[] = await response.json();
        sessionStorage.setItem("modemCapabilities", JSON.stringify(data));
        return JSON.stringify(data);
      } catch (error) {
        console.error("Error fetching capabilities:", error);
      }
    };
    fetchCapabilities();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=5");
        const data: ModemResponse[] = await response.json();
        console.log(data);

        if (data) {
          const newData: SignalData = {
            rsrp: processSignalValues(data[0].response.match(/-?\d+/g)),
            rsrq: processSignalValues(data[1].response.match(/-?\d+/g)),
            sinr: processSignalValues(data[2].response.match(/-?\d+/g)),
            networkType: "",
            bands: null,
            networkName: "",
          };

          console.log(newData);

          const bands = data[3].response.match(
            /"LTE BAND \d+"|"NR5G BAND \d+"/g
          );

          const hasLTE = bands?.some((band) => band.includes("LTE"));
          const hasNR5G = bands?.some((band) => band.includes("NR5G"));

          newData.networkType =
            hasLTE && hasNR5G
              ? "NR5G-NSA"
              : hasLTE
              ? "LTE"
              : hasNR5G
              ? "NR5G-SA"
              : "No Signal";

          const parsedBands = bands?.map((band) => {
            if (band.includes("LTE")) {
              return `B${band.match(/\d+/)}`;
            } else if (band.includes("NR5G")) {
              return `N${band.split(" ")[2].replace(/"/g, "").trim()}`;
            }
          });

          newData.bands = parsedBands ? parsedBands.join(", ") : "No Signal";
          newData.networkName =
            data[4].response
              .split("\n")[1]
              .split(":")[1]
              .split(",")[1]
              .replace(/"/g, "")
              .trim() || "No Signal";

          setSignalData(newData);
          previousData.current = newData;
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        if (initialLoading) {
          setInitialLoading(false);
        }
      }
    };

    fetchStats();
    const intervalId = setInterval(fetchStats, 2000);
    return () => clearInterval(intervalId);
  }, [initialLoading]);

  const chartData: ChartDataItem[] = [
    {
      activity: "rsrp",
      value:
        signalData.rsrp !== null
          ? calculateSignalPercentage("rsrp", signalData.rsrp)
          : 0,
      label:
        signalData.rsrp !== null
          ? `${signalData.rsrp.toFixed(1)} dBm`
          : "No Signal",
      fill: "hsl(var(--chart-1))",
    },
    {
      activity: "rsrq",
      value:
        signalData.rsrq !== null
          ? calculateSignalPercentage("rsrq", signalData.rsrq)
          : 0,
      label:
        signalData.rsrq !== null
          ? `${signalData.rsrq.toFixed(1)} dB`
          : "No Signal",
      fill: "hsl(var(--chart-2))",
    },
    {
      activity: "sinr",
      value:
        signalData.sinr !== null
          ? calculateSignalPercentage("sinr", signalData.sinr)
          : 0,
      label:
        signalData.sinr !== null
          ? `${signalData.sinr.toFixed(1)} dB`
          : "No Signal",
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
          {initialLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div>{signalData.networkName}</div>
          )}
          <Separator orientation="vertical" className="mx-2 h-10 w-px" />
          {initialLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div>{signalData.networkType}</div>
          )}
          <Separator orientation="vertical" className="mx-2 h-10 w-px" />
          {initialLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div>{signalData.bands}</div>
          )}
        </div>
        <div className="flex gap-4 xl:p-4 p-2 pb-2">
          {initialLoading ? (
            <Skeleton className="h-[140px] w-full" />
          ) : (
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
                  {/* <LabelList
                    position="insideLeft"
                    dataKey="label"
                    fill="white"
                    offset={8}
                    fontSize={12}
                  /> */}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <div className="flex flex-row border-t border-b xl:p-4 p-2 w-full">
          <div className="flex w-full items-center gap-2">
            <div className="grid flex-1 auto-rows-min gap-0.5">
              <div className="text-xs text-muted-foreground">RSRP</div>
              {initialLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="flex items-baseline gap-1 xl:text-2xl text-md font-bold tabular-nums leading-none">
                  {signalData.rsrp?.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground">
                    dBm
                  </span>
                </div>
              )}
            </div>
            <Separator orientation="vertical" className="mx-2 h-10 w-px" />
            <div className="grid flex-1 auto-rows-min gap-0.5">
              <div className="text-xs text-muted-foreground">RSRQ</div>
              {initialLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="flex items-baseline gap-1 xl:text-2xl text-md font-bold tabular-nums leading-none">
                  {signalData.rsrq?.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground">
                    dB
                  </span>
                </div>
              )}
            </div>
            <Separator orientation="vertical" className="mx-2 h-10 w-px" />
            <div className="grid flex-1 auto-rows-min gap-0.5">
              <div className="text-xs text-muted-foreground">SINR</div>
              {initialLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="flex items-baseline gap-1 xl:text-2xl text-md font-bold tabular-nums leading-none">
                  {signalData.sinr?.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground">
                    dB
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Button asChild>
          <Link href="/login">
            Login to QuecManager
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}