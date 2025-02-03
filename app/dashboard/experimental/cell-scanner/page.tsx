"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileUpIcon,
  Loader2,
  RefreshCw,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BiSignal1,
  BiSignal2,
  BiSignal3,
  BiSignal4,
  BiSignal5,
} from "react-icons/bi";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import NeighborCellsDisplay from "@/components/cell-scan/neighborcell-card";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

// Types for Cell Information
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
}

interface LTECellInfo extends BaseCellInfo {
  type: "LTE";
  squal: number;
  bandwidth: number;
  band: number;
}

interface NR5GCellInfo extends BaseCellInfo {
  type: "NR5G";
  scs: number;
  carrierBandwidth: number;
  band: number;
  offsetToPointA: number;
  ssbSubcarrierOffset: number;
  ssbScs: number;
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

type CellInfo = LTECellInfo | NR5GCellInfo;

interface GroupedCells {
  [key: string]: {
    cells: CellInfo[];
    operatorInfo: MccMncInfo | null;
  };
}

interface ScanResult {
  status: "success" | "error" | "running" | "idle";
  output?: string;
  message?: string;
  timestamp?: string;
}

interface ScanState {
  status: "idle" | "scanning";
  progress: number;
  message: string;
}

interface QuecwatchStatus {
  status: "active" | "inactive" | "error";
  message?: string;
}

interface NeighborCells {
  status: "success" | "error" | "running" | "idle";
  timestamp: string;
  mode: "LTE" | "NR5G" | "NRLTE";
  data: {
    neighborCells?: string;
    meas?: string;
  };
}

const CellScannerPage = () => {
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [isInitiatingScan, setIsInitiatingScan] = useState(false);
  const [quecwatchStatus, setQuecwatchStatus] =
    useState<QuecwatchStatus | null>(null);
  const [mccMncList, setMccMncList] = useState<MccMncInfo[]>([]);
  const [neighborCells, setNeighborCells] = useState<NeighborCells | null>(
    null
  );
  const [scanState, setScanState] = useState<ScanState>({
    status: "idle",
    progress: 0,
    message: "",
  });

  // Cooldown check effect
  useEffect(() => {
    if (!lastScanTime) {
      setCooldownRemaining(0);
      return;
    }

    const checkCooldown = () => {
      const lastScan = new Date(lastScanTime).getTime();
      const now = new Date().getTime();
      const cooldownDuration = 60000; // 30 seconds in milliseconds
      const timeElapsed = now - lastScan;
      const remaining = Math.max(0, cooldownDuration - timeElapsed);

      setCooldownRemaining(remaining);

      if (remaining > 0) {
        requestAnimationFrame(checkCooldown);
      }
    };

    checkCooldown();
  }, [lastScanTime]);

  // Fetch MCC-MNC list
  const fetchMccMncList = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/experimental/cell_scanner/fetch_mccmnc.sh"
      );
      const data = await response.json();
      setMccMncList(data);
    } catch (error) {
      console.error("Failed to fetch MCC-MNC list:", error);
      toast({
        title: "Warning",
        description: "Failed to load operator information",
        variant: "destructive",
      });
    }
  }, []);

  useEffect(() => {
    fetchMccMncList();
  }, [fetchMccMncList]);

  // Fetch Quecwatch status
  const fetchQuecwatchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/experimental/quecwatch/quecwatch-fetch.sh"
      );
      const data = await response.json();
      setQuecwatchStatus(data);
    } catch (error) {
      console.error("Failed to fetch Quecwatch status:", error);
      toast({
        title: "Error",
        description: "Failed to check Quecwatch status",
        variant: "destructive",
      });
    }
  }, []);

  // Find operator info
  const findOperatorInfo = useCallback(
    (mcc: string, mnc: string): MccMncInfo | null => {
      return (
        mccMncList.find((info) => info.mcc === mcc && info.mnc === mnc) || null
      );
    },
    [mccMncList]
  );

  // Parse QSCAN output function
  const parseQScanOutput = useCallback((output: string): CellInfo[] => {
    const lines = output
      .split("\n")
      .filter((line) => line.trim().startsWith("+QSCAN:"));

    return lines.map((line) => {
      const parts = line
        .substring(line.indexOf(":") + 1)
        .split(",")
        .map((part) => part.trim().replace(/["\r]/g, ""));

      const [type, mcc, mnc, freq, pci, rsrp, rsrq, srxlev, ...rest] = parts;

      const baseCellInfo = {
        type: type.trim() as "LTE" | "NR5G",
        mcc,
        mnc,
        freq: parseInt(freq),
        pci: parseInt(pci),
        rsrp: parseInt(rsrp),
        rsrq: parseInt(rsrq),
        srxlev: parseInt(srxlev),
      };

      if (type.trim() === "LTE") {
        const [squal, cellId, tac, bandwidth, band] = rest;
        return {
          ...baseCellInfo,
          type: "LTE" as const,
          squal: parseInt(squal),
          cellId,
          tac,
          bandwidth: parseInt(bandwidth),
          band: parseInt(band),
        } as LTECellInfo;
      } else {
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
          scs: parseInt(scs),
          cellId,
          tac,
          carrierBandwidth: parseInt(carrierBandwidth),
          band: parseInt(band),
          offsetToPointA: parseInt(offsetToPointA),
          ssbSubcarrierOffset: parseInt(ssbSubcarrierOffset),
          ssbScs: parseInt(ssbScs),
        } as NR5GCellInfo;
      }
    });
  }, []);

  // Check scan status
  const checkScanStatus = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/experimental/cell_scanner/check_scan.sh"
      );
      const result: ScanResult = await response.json();

      if (result.status === "success" && result.output) {
        setScanResult(result);
        setLastScanTime(result.timestamp || null);
        setScanState({ status: "idle", progress: 100, message: "" });
      } else if (result.status === "running") {
        setScanState({
          status: "scanning",
          progress: 50,
          message: "Scan in progress...",
        });
        setTimeout(checkScanStatus, 2000);
      }
    } catch (error) {
      console.error("Failed to check scan status", error);
      toast({
        title: "Error",
        description: "Failed to check scan status",
        variant: "destructive",
      });
    }
  }, []);

  // Start new scan
  const startNewScan = useCallback(async () => {
    if (scanState.status === "scanning" || isInitiatingScan) return;

    setIsInitiatingScan(true);
    setScanState({
      status: "scanning",
      progress: 0,
      message: "Initiating scan...",
    });
    setScanResult(null); // Clear previous results
    setLastScanTime(null);

    try {
      const response = await fetch(
        "/cgi-bin/experimental/cell_scanner/cell_scan.sh"
      );
      const result = await response.json();

      if (result.status === "running") {
        setScanState({
          status: "scanning",
          progress: 10,
          message: "Scan started...",
        });
        setTimeout(checkScanStatus, 2000);
      } else {
        throw new Error(result.message || "Failed to start scan");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start cell scan",
        variant: "destructive",
      });
      setScanState({ status: "idle", progress: 0, message: "" });
    } finally {
      setIsInitiatingScan(false);
    }
  }, [scanState.status, isInitiatingScan, checkScanStatus]);

  // Group cells by operator
  const groupCellsByOperator = useCallback(
    (cells: CellInfo[]): GroupedCells => {
      return cells.reduce((acc, cell) => {
        const key = `${cell.mcc}${cell.mnc}`;
        if (!acc[key]) {
          const operatorInfo = findOperatorInfo(cell.mcc, cell.mnc);
          acc[key] = {
            cells: [],
            operatorInfo,
          };
        }
        acc[key].cells.push(cell);
        return acc;
      }, {} as GroupedCells);
    },
    [findOperatorInfo]
  );

  // Sort cells
  const sortCells = useCallback((cells: CellInfo[]): CellInfo[] => {
    return [...cells].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "LTE" ? -1 : 1;
      }
      return b.rsrp - a.rsrp;
    });
  }, []);

  // Get signal icon based on RSRP
  const getSignalIcon = useCallback((rsrp: number) => {
    if (rsrp >= -65) return <BiSignal5 className="text-xl" />;
    if (rsrp >= -75) return <BiSignal4 className="text-xl" />;
    if (rsrp >= -85) return <BiSignal3 className="text-xl" />;
    if (rsrp >= -95) return <BiSignal2 className="text-xl" />;
    return <BiSignal1 className="text-xl" />;
  }, []);

  // Initial check for results
  useEffect(() => {
    checkScanStatus();
    fetchQuecwatchStatus();
  }, [checkScanStatus, fetchQuecwatchStatus]);

  // Clear results
  const clearResults = useCallback(() => {
    setScanResult(null);
    setLastScanTime(null);
    setScanState({ status: "idle", progress: 0, message: "" });
  }, []);

  // Export to CSV
  const exportToCsv = useCallback(() => {
    if (!scanResult?.output) return;

    const cells = parseQScanOutput(scanResult.output);
    const csvContent = [
      "Type,MCC,MNC,Frequency,PCI,RSRP,RSRQ,Band,Cell ID,TAC",
      ...cells.map(
        (cell) =>
          `${cell.type},${cell.mcc},${cell.mnc},${cell.freq},${cell.pci},${cell.rsrp},${cell.rsrq},${cell.band},${cell.cellId},${cell.tac}`
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `cell_scan_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [scanResult, parseQScanOutput]);

  // Format operator display
  const formatOperatorDisplay = useCallback(
    (mcc: string, mnc: string, operatorInfo: MccMncInfo | null): string => {
      if (operatorInfo) {
        return `${mcc}${mnc} - ${operatorInfo.brand} by ${operatorInfo.operator}`;
      }
      return `${mcc}${mnc}`;
    },
    []
  );

  // Process and group cells for display
  const groupedCells =
    scanResult?.status === "success" && scanResult.output
      ? groupCellsByOperator(parseQScanOutput(scanResult.output))
      : {};

  // Neighbor cell functions
  const startNeighborScan = useCallback(async () => {
    setIsInitiatingScan(true);
    const response = await fetch(
      "/cgi-bin/experimental/cell_scanner/network_info.sh"
    );
    const data = await response.json();
    setNeighborCells(data);
    setIsInitiatingScan(false);
  }, []);

  // Clear neighbor cells results
  const clearNeighborCells = useCallback(() => {
    setNeighborCells(null);
  }, []);

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Full Network Cell Scan</CardTitle>
          <CardDescription>
            Scan all available network cells, including those from other network
            providers. Current network mode will affect the results.
            {lastScanTime && (
              <div className="mt-1 text-sm text-muted-foreground">
                Last scan: {lastScanTime}
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            {!scanResult && scanState.status === "idle" && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-center">
                  Click the button below to start scanning the network...
                </p>
              </div>
            )}

            {scanState.status === "scanning" && (
              <div className="flex flex-col space-y-2 items-center justify-center h-full w-full">
                <Progress value={scanState.progress} className="w-full" />
                <div className="flex items-center justify-center">
                  <p className="text-sm text-gray-500 text-center">
                    {scanState.message}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {Object.entries(groupedCells).map(
                ([operatorId, { cells, operatorInfo }]) => (
                  <Card key={operatorId} className="p-4 grid gap-2">
                    <div>
                      <Badge>
                        {formatOperatorDisplay(
                          cells[0].mcc,
                          cells[0].mnc,
                          operatorInfo
                        )}
                      </Badge>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>E/ARFCN</TableHead>
                          <TableHead>PCI</TableHead>
                          <TableHead>Band</TableHead>
                          <TableHead>Cell ID</TableHead>
                          <TableHead>TAC</TableHead>
                          <TableHead>Signal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortCells(cells).map((cell, index) => (
                          <TableRow key={`${cell.cellId}-${index}`}>
                            <TableCell>{cell.type}</TableCell>
                            <TableCell>{cell.freq}</TableCell>
                            <TableCell>{cell.pci}</TableCell>
                            <TableCell>{cell.band}</TableCell>
                            <TableCell>{cell.cellId}</TableCell>
                            <TableCell>{cell.tac}</TableCell>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    {getSignalIcon(cell.rsrp)}
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="grid gap-1">
                                      <div className="grid grid-cols-2 gap-1">
                                        RSRP{" "}
                                        <span className="font-medium">
                                          {cell.rsrp} dBm
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-1">
                                        RSRQ{" "}
                                        <span className="font-medium">
                                          {cell.rsrq} dB
                                        </span>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )
              )}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="border-t py-4">
          <div className="flex items-center space-x-4">
            {quecwatchStatus?.status === "active" ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button disabled>
                      {scanState.status === "scanning" ? (
                        <div className="flex items-center gap-x-2">
                          <Loader2 className="animate-spin w-4 h-4" />
                          <span>Scanning Network...</span>
                        </div>
                      ) : !scanResult ? (
                        <div className="flex items-center space-x-2">
                          <SearchIcon className="w-4 h-4" />
                          <span>Start Cell Scan</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="w-4 h-4" />
                          <span>Run Cell Scan Again</span>
                        </div>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Please disable Quecwatch first before proceeding.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      onClick={startNewScan}
                      disabled={
                        scanState.status === "scanning" ||
                        isInitiatingScan ||
                        cooldownRemaining > 0
                      }
                    >
                      {scanState.status === "scanning" ? (
                        <div className="flex items-center gap-x-2">
                          <Loader2 className="animate-spin w-4 h-4" />
                          <span>Scanning Network...</span>
                        </div>
                      ) : !scanResult ? (
                        <div className="flex items-center space-x-2">
                          <SearchIcon className="w-4 h-4" />
                          <span>Start Cell Scan</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="w-4 h-4" />
                          <span>Run Cell Scan Again</span>
                        </div>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {cooldownRemaining > 0 ? (
                      <span>
                        Please wait {Math.ceil(cooldownRemaining / 1000)}{" "}
                        seconds before scanning again
                      </span>
                    ) : (
                      <span>Start a new network scan</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {scanResult?.status === "success" && (
              <>
                <Button
                  variant="secondary"
                  onClick={exportToCsv}
                  disabled={scanState.status === "scanning"}
                >
                  <FileUpIcon className="w-4 h-4 mr-2" />
                  Export to CSV
                </Button>
                <Button
                  variant="destructive"
                  onClick={clearResults}
                  disabled={scanState.status === "scanning"}
                >
                  <Trash2Icon className="w-4 h-4 mr-2" />
                  Clear Results
                </Button>
              </>
            )}
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Neighbor Cell Scan</CardTitle>
          <CardDescription>
            Scan neighbor cells of the current network provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NeighborCellsDisplay neighborCells={neighborCells} />
        </CardContent>
        <CardFooter className="border-t py-4">
          <div className="flex items-center space-x-4">
            <Button onClick={startNeighborScan} disabled={isInitiatingScan}>
              <MagnifyingGlassIcon className="w-4 h-4" />
              Start Neighbor Scan
            </Button>

            {neighborCells?.status === "success" && (
              <Button
                variant="destructive"
                onClick={clearNeighborCells}
                disabled={isInitiatingScan}
              >
                <Trash2Icon className="w-4 h-4" />
                Clear Results
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CellScannerPage;
