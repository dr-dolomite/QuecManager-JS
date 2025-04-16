import React, { useState, useCallback, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import FrequencyDetailCard from "./frequency-card-detail";

// Cell Information types
interface BaseCellInfo {
  type: "LTE" | "NR5G";
  mcc: string;
  mnc: string;
  freq: number;
  pci: number;
  rsrp: number;
  rsrq: number;
  srxlev: number;
  cellId: string;
  tac: string;
  band: number;
}

interface LTECellInfo extends BaseCellInfo {
  type: "LTE";
  squal: number;
  bandwidth: number;
  bandwidthMHz?: string;
}

interface NR5GCellInfo extends BaseCellInfo {
  type: "NR5G";
  scs: number;
  carrierBandwidth: number;
  offsetToPointA: number;
  ssbSubcarrierOffset: number;
  ssbScs: number | "-";
}

type CellInfo = LTECellInfo | NR5GCellInfo;

// Scan result interface
interface ScanResult {
  command?: {
    id: string;
    text: string;
    timestamp: string;
  };
  response?: {
    status: "success" | "error" | "timeout" | "partial" | "preempted";
    raw_output: string;
    completion_time: string;
    duration_ms: number;
  };
  status?: "success" | "error" | "running" | "idle" | "partial";
  message?: string;
  timestamp?: string;
  output?: string;
}

// Frequency info types
interface LTEFrequencyInfo {
  band: number;
  bandName: string;
  earfcn: number;
  dlFrequency: string;
  ulFrequency: string;
  ulEarfcn?: number;
  duplexType: "FDD" | "TDD";
  bandwidth?: string;
  channelNumber?: number;
}

interface NRFrequencyInfo {
  band: number;
  bandName: string;
  nrarfcn: number;
  dlFrequency: string;
  ulFrequency: string;
  duplexType: "FDD" | "TDD";
  scs?: number;
  channelBandwidth?: string;
}

// Band configuration types
interface LTEBand {
  band: number;
  name: string;
  dlLow: number;
  dlHigh: number;
  ulLow: number;
  ulHigh: number;
  earfcnOffset: number;
  earfcnRange: [number, number];
  spacing: number;
  duplexType: "FDD" | "TDD";
}

interface NRBand {
  band: number;
  name: string;
  dlLow: number;
  dlHigh: number;
  ulLow: number;
  ulHigh: number;
  nrarfcnOffset: number;
  nrarfcnRange: [number, number];
  duplexType: "FDD" | "TDD";
}

interface MccMncInfo {
  type: string;
  countryName: string;
  countryCode: string;
  mcc: string;
  mnc: string;
  brand: string;
  operator: string;
  status: string;
  bands: string;
  notes?: string;
}

interface FrequencyInfoCardProps {
  scanResult: ScanResult | null;
  isLoading?: boolean;
  mccMncList?: MccMncInfo[];
}

const FrequencyInfoCard = ({
  scanResult,
  isLoading = false,
  mccMncList = [],
}: FrequencyInfoCardProps) => {
  const [selectedTab, setSelectedTab] = useState<"lte" | "nr5g" | "all">("all");

  // Find operator info by MCC-MNC
  const findOperatorInfo = useCallback(
    (mcc: string, mnc: string): MccMncInfo | null => {
      return (
        mccMncList.find((info) => info.mcc === mcc && info.mnc === mnc) || null
      );
    },
    [mccMncList]
  );

  // LTE Band configurations
  const lteBands: LTEBand[] = [
    // FDD Bands
    {
      band: 1,
      name: "2100",
      dlLow: 2110,
      dlHigh: 2170,
      ulLow: 1920,
      ulHigh: 1980,
      earfcnOffset: 0,
      earfcnRange: [0, 599],
      spacing: 0.1,
      duplexType: "FDD",
    },
    {
      band: 2,
      name: "1900 PCS",
      dlLow: 1930,
      dlHigh: 1990,
      ulLow: 1850,
      ulHigh: 1910,
      earfcnOffset: 600,
      earfcnRange: [600, 1199],
      spacing: 0.1,
      duplexType: "FDD",
    },
    {
      band: 3,
      name: "1800",
      dlLow: 1805,
      dlHigh: 1880,
      ulLow: 1710,
      ulHigh: 1785,
      earfcnOffset: 1200,
      earfcnRange: [1200, 1949],
      spacing: 0.1,
      duplexType: "FDD",
    },
    {
      band: 5,
      name: "850",
      dlLow: 869,
      dlHigh: 894,
      ulLow: 824,
      ulHigh: 849,
      earfcnOffset: 2400,
      earfcnRange: [2400, 2649],
      spacing: 0.1,
      duplexType: "FDD",
    },
    {
      band: 7,
      name: "2600",
      dlLow: 2620,
      dlHigh: 2690,
      ulLow: 2500,
      ulHigh: 2570,
      earfcnOffset: 2750,
      earfcnRange: [2750, 3449],
      spacing: 0.1,
      duplexType: "FDD",
    },
    {
      band: 8,
      name: "900",
      dlLow: 925,
      dlHigh: 960,
      ulLow: 880,
      ulHigh: 915,
      earfcnOffset: 3450,
      earfcnRange: [3450, 3799],
      spacing: 0.1,
      duplexType: "FDD",
    },
    {
      band: 20,
      name: "800 DD",
      dlLow: 791,
      dlHigh: 821,
      ulLow: 832,
      ulHigh: 862,
      earfcnOffset: 6150,
      earfcnRange: [6150, 6449],
      spacing: 0.1,
      duplexType: "FDD",
    },
    {
      band: 28,
      name: "700 APT",
      dlLow: 758,
      dlHigh: 803,
      ulLow: 703,
      ulHigh: 748,
      earfcnOffset: 9210,
      earfcnRange: [9210, 9659],
      spacing: 0.1,
      duplexType: "FDD",
    },
    {
      band: 41,
      name: "TD 2500",
      dlLow: 2496,
      dlHigh: 2690,
      ulLow: 2496,
      ulHigh: 2690,
      earfcnOffset: 39650,
      earfcnRange: [39650, 41589],
      spacing: 0.1,
      duplexType: "TDD",
    },
    // Additional bands would be here
  ];

  // NR Band configurations
  const nrBands: NRBand[] = [
    // FR1 bands (Sub-6 GHz)
    {
      band: 1,
      name: "2100",
      dlLow: 2110,
      dlHigh: 2170,
      ulLow: 1920,
      ulHigh: 1980,
      nrarfcnOffset: 422000,
      nrarfcnRange: [422000, 434000],
      duplexType: "FDD",
    },
    {
      band: 3,
      name: "1800",
      dlLow: 1805,
      dlHigh: 1880,
      ulLow: 1710,
      ulHigh: 1785,
      nrarfcnOffset: 361000,
      nrarfcnRange: [361000, 376000],
      duplexType: "FDD",
    },
    {
      band: 5,
      name: "CLR",
      dlLow: 869,
      dlHigh: 894,
      ulLow: 824,
      ulHigh: 849,
      nrarfcnOffset: 173800,
      nrarfcnRange: [173800, 178800],
      duplexType: "FDD",
    },
    {
      band: 7,
      name: "2600",
      dlLow: 2620,
      dlHigh: 2690,
      ulLow: 2500,
      ulHigh: 2570,
      nrarfcnOffset: 524000,
      nrarfcnRange: [524000, 538000],
      duplexType: "FDD",
    },
    {
      band: 20,
      name: "800 DD",
      dlLow: 791,
      dlHigh: 821,
      ulLow: 832,
      ulHigh: 862,
      nrarfcnOffset: 158200,
      nrarfcnRange: [158200, 164200],
      duplexType: "FDD",
    },
    {
      band: 25,
      name: "Extended PCS",
      dlLow: 1930,
      dlHigh: 1995,
      ulLow: 1850,
      ulHigh: 1915,
      nrarfcnOffset: 386000,
      nrarfcnRange: [386000, 399000],
      duplexType: "FDD",
    },
    {
      band: 28,
      name: "700 APT",
      dlLow: 758,
      dlHigh: 803,
      ulLow: 703,
      ulHigh: 748,
      nrarfcnOffset: 151600,
      nrarfcnRange: [151600, 160600],
      duplexType: "FDD",
    },
    {
      band: 41,
      name: "TD 2500",
      dlLow: 2496,
      dlHigh: 2690,
      ulLow: 2496,
      ulHigh: 2690,
      nrarfcnOffset: 499200,
      nrarfcnRange: [499200, 537999],
      duplexType: "TDD",
    },
    {
      band: 66,
      name: "AWS-3",
      dlLow: 2110,
      dlHigh: 2200,
      ulLow: 1710,
      ulHigh: 1780,
      nrarfcnOffset: 422000,
      nrarfcnRange: [422000, 440000],
      duplexType: "FDD",
    },
    {
      band: 70,
      name: "AWS-4",
      dlLow: 1995,
      dlHigh: 2020,
      ulLow: 1695,
      ulHigh: 1710,
      nrarfcnOffset: 399001,
      nrarfcnRange: [399001, 404000],
      duplexType: "FDD",
    },
    {
      band: 71,
      name: "600MHz",
      dlLow: 617,
      dlHigh: 652,
      ulLow: 663,
      ulHigh: 698,
      nrarfcnOffset: 123400,
      nrarfcnRange: [123400, 130400],
      duplexType: "FDD",
    },
    {
      band: 77,
      name: "C-Band",
      dlLow: 3300,
      dlHigh: 4200,
      ulLow: 3300,
      ulHigh: 4200,
      nrarfcnOffset: 620000,
      nrarfcnRange: [620000, 680000],
      duplexType: "TDD",
    },
    {
      band: 78,
      name: "C-Band (3.5GHz)",
      dlLow: 3300,
      dlHigh: 3800,
      ulLow: 3300,
      ulHigh: 3800,
      nrarfcnOffset: 620000,
      nrarfcnRange: [620000, 653333],
      duplexType: "TDD",
    },
    // Additional bands would be here
  ];

  // Parse QSCAN output
  const parseQScanOutput = useCallback((rawOutput: string): CellInfo[] => {
    if (!rawOutput) return [];

    const lines = rawOutput
      .split("\n")
      .filter((line) => line.trim().startsWith("+QSCAN:"));

    return lines
      .map((line) => {
        // Extract data after +QSCAN:
        const dataContent = line.substring(line.indexOf(":") + 1).trim();

        // Handle the escaped quotes in the JSON format
        const parts = dataContent.split(",").map((part) => {
          // Clean up the part, handling escaped quotes
          return part
            .trim()
            .replace(/\\"/g, "") // Remove escaped quotes
            .replace(/"/g, "") // Remove regular quotes
            .replace(/\r/g, ""); // Remove carriage returns
        });

        // First element is the type, which might have quotes
        let [type, mcc, mnc, freq, pci, rsrp, rsrq, srxlev, ...rest] = parts;

        // Clean up the type string
        type = type
          .replace(/\\\\/g, "")
          .replace(/\\/g, "")
          .replace(/"/g, "")
          .trim();

        const baseCellInfo = {
          type: type as "LTE" | "NR5G",
          mcc,
          mnc,
          freq: parseInt(freq),
          pci: parseInt(pci),
          rsrp: parseInt(rsrp),
          rsrq: parseInt(rsrq),
          srxlev: srxlev === "-" ? 0 : parseInt(srxlev), // Handle dash character
          cellId: "", // Default value will be overridden
          tac: "", // Default value will be overridden
          band: 0, // Default value will be overridden
        };

        if (type === "LTE") {
          const [squal, cellId, tac, bandwidth, band] = rest;
          return {
            ...baseCellInfo,
            type: "LTE" as const,
            squal: squal === "-" ? 0 : parseInt(squal),
            cellId,
            tac,
            bandwidth: parseInt(bandwidth),
            band: parseInt(band),
          } as LTECellInfo;
        } else if (type === "NR5G") {
          const [
            scs,
            cellId,
            tac,
            carrierBandwidth,
            band,
            offsetToPointA,
            ssbSubcarrierOffset,
            ssbScs,
          ] = rest;

          return {
            ...baseCellInfo,
            type: "NR5G" as const,
            cellId,
            tac,
            scs: parseInt(scs),
            carrierBandwidth: parseInt(carrierBandwidth),
            band: parseInt(band),
            offsetToPointA: parseInt(offsetToPointA),
            ssbSubcarrierOffset: parseInt(ssbSubcarrierOffset),
            ssbScs: ssbScs,
          } as NR5GCellInfo;
        }

        // If we can't determine the type, return null - this will be filtered out
        return null;
      })
      .filter((cell): cell is CellInfo => cell !== null); // Type guard to filter out null values
  }, []);

  // Calculate LTE frequency details
  const calculateLTEFrequency = useCallback(
    (cell: LTECellInfo): LTEFrequencyInfo | null => {
      const earfcn = cell.freq;

      // Find matching bands
      const matchingBand = lteBands.find(
        (band) =>
          earfcn >= band.earfcnRange[0] &&
          earfcn <= band.earfcnRange[1] &&
          band.band === cell.band
      );

      if (!matchingBand) {
        // If no exact match, try to find by band number only
        const bandByNumber = lteBands.find((band) => band.band === cell.band);
        if (!bandByNumber) return null;

        // Use the band, but note that EARFCN is out of typical range
        const dlFreq =
          bandByNumber.dlLow +
          ((earfcn - bandByNumber.earfcnOffset) % 1000) * bandByNumber.spacing;

        let ulEarfcn: number | undefined;
        let ulFreq: string;

        if (bandByNumber.duplexType === "FDD") {
          ulEarfcn = earfcn + 18000;
          const upOffset = bandByNumber.ulHigh - bandByNumber.ulLow;
          ulFreq = (bandByNumber.ulLow + upOffset / 2).toFixed(2);
        } else {
          ulFreq = dlFreq.toFixed(2);
        }

        return {
          band: bandByNumber.band,
          bandName: bandByNumber.name,
          earfcn,
          dlFrequency: dlFreq.toFixed(2),
          ulFrequency: ulFreq,
          ulEarfcn,
          duplexType: bandByNumber.duplexType,
          bandwidth: cell.bandwidthMHz,
        };
      }

      // Calculate downlink frequency
      const dlFreq =
        matchingBand.dlLow +
        (earfcn - matchingBand.earfcnOffset) * matchingBand.spacing;

      // Calculate corresponding uplink EARFCN and frequency
      let ulEarfcn: number | undefined;
      let ulFreq: number;

      if (matchingBand.duplexType === "FDD") {
        const dlOffset = earfcn - matchingBand.earfcnOffset;
        ulEarfcn = earfcn + 18000;
        ulFreq = matchingBand.ulLow + dlOffset * matchingBand.spacing;
      } else {
        ulFreq = dlFreq;
      }

      return {
        band: matchingBand.band,
        bandName: matchingBand.name,
        earfcn,
        dlFrequency: dlFreq.toFixed(2),
        ulFrequency: ulFreq.toFixed(2),
        ulEarfcn,
        duplexType: matchingBand.duplexType,
        bandwidth: cell.bandwidthMHz,
      };
    },
    [lteBands]
  );

  // Calculate NR frequency details
  const calculateNRFrequency = useCallback(
    (cell: NR5GCellInfo): NRFrequencyInfo | null => {
      const nrarfcn = cell.freq;

      // Calculate frequency using global frequency raster
      let frequency: number;

      // Global frequency raster formula from 3GPP TS 38.104 Section 5.4.2.1
      if (nrarfcn >= 0 && nrarfcn <= 599999) {
        // Range 0-3000 MHz: 5 kHz spacing
        frequency = 0 + (nrarfcn - 0) * 0.005; // ΔF_Global = 5 kHz
      } else if (nrarfcn >= 600000 && nrarfcn <= 2016666) {
        // Range 3000-24250 MHz: 15 kHz spacing
        frequency = 3000 + (nrarfcn - 600000) * 0.015; // ΔF_Global = 15 kHz
      } else if (nrarfcn >= 2016667 && nrarfcn <= 3279165) {
        // Range 24250-100000 MHz: 60 kHz spacing
        frequency = 24250.08 + (nrarfcn - 2016667) * 0.06; // ΔF_Global = 60 kHz
      } else {
        return null; // Out of defined ranges
      }

      // Find matching band by ARFCN range and band number
      const matchingBand = nrBands.find(
        (band) =>
          nrarfcn >= band.nrarfcnRange[0] &&
          nrarfcn <= band.nrarfcnRange[1] &&
          band.band === cell.band
      );

      if (!matchingBand) {
        // Try to find by band number only if no exact match
        const bandByNumber = nrBands.find((band) => band.band === cell.band);
        if (!bandByNumber) return null;

        return {
          band: bandByNumber.band,
          bandName: bandByNumber.name,
          nrarfcn,
          dlFrequency: frequency.toFixed(2),
          ulFrequency:
            bandByNumber.duplexType === "FDD"
              ? ((bandByNumber.ulLow + bandByNumber.ulHigh) / 2).toFixed(2)
              : frequency.toFixed(2),
          duplexType: bandByNumber.duplexType,
          scs: cell.scs,
          channelBandwidth: `${cell.carrierBandwidth} RB`,
        };
      }

      const upFrequency =
        matchingBand.duplexType === "FDD"
          ? matchingBand.ulLow + (frequency - matchingBand.dlLow)
          : frequency;

      return {
        band: matchingBand.band,
        bandName: matchingBand.name,
        nrarfcn,
        dlFrequency: frequency.toFixed(2),
        ulFrequency: upFrequency.toFixed(2),
        duplexType: matchingBand.duplexType,
        scs: cell.scs,
        channelBandwidth: `${cell.carrierBandwidth} RB`,
      };
    },
    [nrBands]
  );

  // Process all cells from scan result
  const processedCells = useMemo(() => {
    if (!scanResult?.output) return { lte: [], nr5g: [] };

    const cells = parseQScanOutput(scanResult.output);

    // Group cells by type and add frequency calculations
    const lteCells: (LTECellInfo & {
      frequencyInfo?: LTEFrequencyInfo;
      operatorInfo?: MccMncInfo | null;
    })[] = [];

    const nr5gCells: (NR5GCellInfo & {
      frequencyInfo?: NRFrequencyInfo;
      operatorInfo?: MccMncInfo | null;
    })[] = [];

    cells.forEach((cell) => {
      const operatorInfo = findOperatorInfo(cell.mcc, cell.mnc);

      if (cell.type === "LTE") {
        const frequencyInfo = calculateLTEFrequency(cell) ?? undefined;
        lteCells.push({ ...cell, frequencyInfo, operatorInfo });
      } else if (cell.type === "NR5G") {
        const frequencyInfo = calculateNRFrequency(cell) ?? undefined;
        nr5gCells.push({ ...cell, frequencyInfo, operatorInfo });
      }
    });

    // Sort cells by provider name (operator)
    const sortByOperator = (
      a: { operatorInfo?: MccMncInfo | null },
      b: { operatorInfo?: MccMncInfo | null }
    ) => {
      const operatorA = a.operatorInfo?.operator || "";
      const operatorB = b.operatorInfo?.operator || "";
      return operatorA.localeCompare(operatorB);
    };

    return {
      lte: lteCells.sort(sortByOperator),
      nr5g: nr5gCells.sort(sortByOperator),
    };
  }, [
    scanResult,
    parseQScanOutput,
    calculateLTEFrequency,
    calculateNRFrequency,
    findOperatorInfo,
  ]);

  // Return loading UI if loading
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cell Frequency Analysis</CardTitle>
          <CardDescription>
            Analyzing frequency details for detected cells...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Processing frequency information...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Return empty UI if no scan results
  if (!scanResult || !scanResult.output) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cell Frequency Analysis</CardTitle>
          <CardDescription>
            Detailed frequency information for detected cells
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center min-h-[300px]">
          <p className="text-muted-foreground">
            Run a cell scan to view detailed frequency information
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalCells = processedCells.lte.length + processedCells.nr5g.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cell Frequency Analysis</CardTitle>
        <CardDescription>
          {scanResult.timestamp && (
            <div className="mt-1 text-sm text-muted-foreground">
              Analysis based on full cell scan from: {scanResult.timestamp}
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          defaultValue="all"
          value={selectedTab}
          onValueChange={(value) =>
            setSelectedTab(value as "lte" | "nr5g" | "all")
          }
          className="mb-6"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All Cells ({totalCells})</TabsTrigger>
            <TabsTrigger value="lte">
              LTE ({processedCells.lte.length})
            </TabsTrigger>
            <TabsTrigger value="nr5g">
              5G NR ({processedCells.nr5g.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {totalCells === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No cells detected in the scan
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {processedCells.lte.map((cell, index) => (
                    <FrequencyDetailCard
                      key={`lte-${cell.cellId}-${index}`}
                      cell={cell}
                      operatorInfo={cell.operatorInfo}
                    />
                  ))}

                  {processedCells.nr5g.map((cell, index) => (
                    <FrequencyDetailCard
                      key={`nr5g-${cell.cellId}-${index}`}
                      cell={cell}
                      operatorInfo={cell.operatorInfo}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="lte" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {processedCells.lte.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No LTE cells detected in the scan
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {processedCells.lte.map((cell, index) => (
                    <FrequencyDetailCard
                      key={`lte-${cell.cellId}-${index}`}
                      cell={cell}
                      operatorInfo={cell.operatorInfo}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="nr5g" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {processedCells.nr5g.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No 5G NR cells detected in the scan
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {processedCells.nr5g.map((cell, index) => (
                    <FrequencyDetailCard
                      key={`nr5g-${cell.cellId}-${index}`}
                      cell={cell}
                      operatorInfo={cell.operatorInfo}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="border-t p-4 flex justify-between">
        <div className="text-xs text-muted-foreground">
          Frequency calculation based on 3GPP TS 38.104 and TS 36.101
          specifications
        </div>
      </CardFooter>
    </Card>
  );
};

export default FrequencyInfoCard;
