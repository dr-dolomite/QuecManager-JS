"use client";

import { useEffect, useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { calculateSignalPercentage } from "@/utils/signalMetrics";

import { useAuth } from "@/hooks/auth";
import { AnimatedThemeToggler } from "../ui/animated-theme-toggler";

interface ChartDataItem {
  activity: string;
  value: number;
  label: string;
  fill: string;
}

interface AllSignals {
  input: Array<SignalData>;
}

interface SignalData {
  rsrp: number | null;
  rsrq: number | null;
  sinr: number | null;
  networkType: string;
  bands: string | null;
  networkName: string;
}

interface AntennaSignalData {
  antenna: number;
  rsrp: number | null;
  rsrq: number | null;
  sinr: number | null;
  bandType: string;
}

interface AtCommandResponse {
  command: string;
  response: string;
  status: string;
}

const processSignalValues = (matches: string[] | null): number | null => {
  if (!matches) return null;
  const validValues = matches
    .map(Number)
    .filter((val) => val !== -32768 && val !== -140);
  if (validValues.length === 0) return null;
  const sum = validValues.reduce((acc, curr) => acc + curr, 0);
  return Math.round(sum / validValues.length);
};

const parseAntennaSignalData = (atResponses: AtCommandResponse[]): AntennaSignalData[] => {
  // Filter to only include signal measurement commands
  const signalCommands = atResponses.filter(cmd =>
    ['AT+QRSRP', 'AT+QRSRQ', 'AT+QSINR'].includes(cmd.command)
  );

  // Extract values and band type from each command
  const signalData: { [key: string]: { values: (number | null)[], bandType: string } } = {};

  signalCommands.forEach(cmd => {
    const responseLines = cmd.response.split('\n');
    const dataLine = responseLines.find(line => line.startsWith('+Q'));

    if (dataLine) {
      // Extract the data part after the colon
      const dataPart = dataLine.split(': ')[1];
      if (dataPart) {
        const parts = dataPart.split(',');

        // Extract the 4 antenna values (indices 0-3)
        const antennaValues = parts.slice(0, 4).map(val => {
          const num = parseInt(val.trim());
          return (num === -32768 || num === -140) ? null : num;
        }) as (number | null)[];

        // Extract band type (last part)
        const bandType = parts[parts.length - 1]?.trim() || 'Unknown';

        signalData[cmd.command] = { values: antennaValues, bandType };
      }
    }
  });

  // Create array of antenna objects (always 4 antennas)
  const antennaArray: AntennaSignalData[] = [];

  for (let i = 0; i < 4; i++) {
    antennaArray.push({
      antenna: i,
      rsrp: signalData['AT+QRSRP']?.values[i] ?? null,
      rsrq: signalData['AT+QRSRQ']?.values[i] ?? null,
      sinr: signalData['AT+QSINR']?.values[i] ?? null,
      bandType: signalData['AT+QRSRP']?.bandType ??
                signalData['AT+QRSRQ']?.bandType ??
                signalData['AT+QSINR']?.bandType ?? 'Unknown'
    });
  }

  return antennaArray;
};

// Signal strength bar component
const SignalBar = ({
  label,
  value,
  type,
  unit,
  bandType
}: {
  label: string;
  value: number | null;
  type: 'rsrp' | 'rsrq' | 'sinr';
  unit: string;
  bandType?: string;
}) => {
  if (value === null) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">N/A</span>
        </div>
        <Progress value={0} className="h-2" />
      </div>
    );
  }

  const percentage = calculateSignalPercentage(type, value, bandType);
  const getBarColor = (percentage: number) => {
    if (percentage >= 95) return "bg-blue-600";      // Excellent - Blue
    if (percentage >= 85) return "bg-blue-500";      // Very Good - Light Blue
    if (percentage >= 75) return "bg-green-600";     // Good - Dark Green
    if (percentage >= 65) return "bg-green-500";     // Good - Green
    if (percentage >= 55) return "bg-green-400";     // Fair - Light Green
    if (percentage >= 45) return "bg-yellow-500";    // Fair - Yellow
    if (percentage >= 35) return "bg-orange-500";    // Poor - Orange
    if (percentage >= 25) return "bg-orange-600";    // Poor - Dark Orange
    if (percentage >= 15) return "bg-red-500";       // Bad - Red
    return "bg-red-700";                             // Very Bad - Dark Red
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}{unit}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getBarColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-center text-muted-foreground">{percentage.toFixed(0)}%</div>
    </div>
  );
};

// Create a standardized array of 4 antennas (0-3)
const getStandardizedAntennaArray = (antennaData: AntennaSignalData[]): AntennaSignalData[] => {
  const standardizedArray: AntennaSignalData[] = [];

  for (let i = 0; i < 4; i++) {
    const existingAntenna = antennaData.find(ant => ant.antenna === i);
    standardizedArray.push(existingAntenna || {
      antenna: i,
      rsrp: null,
      rsrq: null,
      sinr: null,
      bandType: antennaData[0]?.bandType || 'Unknown'
    });
  }

  return standardizedArray;
};

// Get antenna display name
const getAntennaName = (antennaNumber: number): string => {
  switch (antennaNumber) {
    case 0: return "Main Antenna";
    case 1: return "Diverse Antenna";
    case 2: return "MIMO 1";
    case 3: return "MIMO 2";
    default: return `Antenna ${antennaNumber}`;
  }
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
  const [antennaData, setAntennaData] = useState<AntennaSignalData[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const previousData = useRef<SignalData | null>(null);
  const { logout } = useAuth();
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(
          "/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=5"
        );
        const data: AtCommandResponse[] = await response.json();
        console.log(data);

        // Parse antenna-specific signal data
        const parsedAntennaData = parseAntennaSignalData(data);
        setAntennaData(parsedAntennaData);
        console.log("Parsed antenna data:", parsedAntennaData);

        const allSignals: AllSignals = { input: [] };
        if (data) {
          // Keep existing averaging logic for backward compatibility
          const rsrpResponse = data.find(cmd => cmd.command === 'AT+QRSRP');
          const rsrqResponse = data.find(cmd => cmd.command === 'AT+QRSRQ');
          const sinrResponse = data.find(cmd => cmd.command === 'AT+QSINR');
          const caResponse = data.find(cmd => cmd.command === 'AT+QCAINFO');
          const spnResponse = data.find(cmd => cmd.command === 'AT+QSPN');

          const newData: SignalData = {
            rsrp: rsrpResponse ? processSignalValues(rsrpResponse.response.match(/-?\d+/g)) : null,
            rsrq: rsrqResponse ? processSignalValues(rsrqResponse.response.match(/-?\d+/g)) : null,
            sinr: sinrResponse ? processSignalValues(sinrResponse.response.match(/-?\d+/g)) : null,
            networkType: "",
            bands: null,
            networkName: "",
          };

          console.log(newData);

          const bands = caResponse ? caResponse.response.match(
            /"LTE BAND \d+"|"NR5G BAND \d+"/g
          ) : null;

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
          newData.networkName = spnResponse ? 
            spnResponse.response
              .split("\n")[1]
              ?.split(":")[1]
              ?.split(",")[1]
              ?.replace(/"/g, "")
              ?.trim() || "No Signal" : "No Signal";

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

    const intervalId = setInterval(fetchStats, 2000);
    return () => clearInterval(intervalId);
  }, [initialLoading, logout]);

  const chartData: ChartDataItem[] = [
    {
      activity: "rsrp",
      value:
        signalData.rsrp !== null
          ? calculateSignalPercentage("rsrp", signalData.rsrp, antennaData[0]?.bandType)
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
          ? calculateSignalPercentage("rsrq", signalData.rsrq, antennaData[0]?.bandType)
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
          ? calculateSignalPercentage("sinr", signalData.sinr, antennaData[0]?.bandType)
          : 0,
      label:
        signalData.sinr !== null
          ? `${signalData.sinr.toFixed(1)} dB`
          : "No Signal",
      fill: "hsl(var(--chart-3))",
    },
  ];

  return (
    <div className="xl:max-w-2xl xl:w-[1200px] max-w-sm w-full">
          <Card >
      <CardHeader>
        <div className="flex flex-row justify-between items-center">
          <CardTitle>QuecManager Signal Quality Stats</CardTitle>
          <AnimatedThemeToggler />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Individual Antenna Data Display */}
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h3 className="text-sm font-medium mb-4">
            Individual Antenna Signals ({antennaData[0]?.bandType || 'Not Available'})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {getStandardizedAntennaArray(antennaData).map((antenna) => (
              <div key={antenna.antenna} className="border rounded-lg p-4 bg-white dark:bg-gray-800">
                <div className="text-center text-sm font-medium mb-4 text-blue-600 dark:text-blue-400">
                  {getAntennaName(antenna.antenna)}
                </div>
                <div className="space-y-4">
                  <SignalBar
                    label="RSRP"
                    value={antenna.rsrp}
                    type="rsrp"
                    unit=" dBm"
                    bandType={antenna.bandType}
                  />
                  <SignalBar
                    label="RSRQ"
                    value={antenna.rsrq}
                    type="rsrq"
                    unit=" dB"
                    bandType={antenna.bandType}
                  />
                  <SignalBar
                    label="SINR"
                    value={antenna.sinr}
                    type="sinr"
                    unit=" dB"
                    bandType={antenna.bandType}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <div className="flex flex-row border-t border-b xl:p-4 p-2 w-full">
          <div className="flex flex-col w-full gap-4">
            <span className="text-sm font-medium">Antenna Alignment Strategy</span>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">1</div>
                <div className="flex-1">
                  <span className="font-medium text-sm">Start with RSRP</span>
                  <p className="text-xs text-muted-foreground mt-1">Rotate antenna to maximize this value first (target: -70 to -80 dBm)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">2</div>
                <div className="flex-1">
                  <span className="font-medium text-sm">Verify RSRQ</span>
                  <p className="text-xs text-muted-foreground mt-1">Ensure it stays above -15 dB (indicates low interference)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-yellow-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">3</div>
                <div className="flex-1">
                  <span className="font-medium text-sm">Check SINR</span>
                  <p className="text-xs text-muted-foreground mt-1">Should improve as RSRP increases and interference decreases (target: ≥13 dB)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">4</div>
                <div className="flex-1">
                  <span className="font-medium text-sm">Fine-tune</span>
                  <p className="text-xs text-muted-foreground mt-1">Small adjustments focusing on the best balance of all three parameters</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
    </div>

  );
}
