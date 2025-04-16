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
import { LTE_RB_BANDWIDTH_MAP } from "@/types/types";
import FrequencyInfoCard from "@/components/pages/frequency-info-card";

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
  bandwidthMHz?: string;
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

interface ScanState {
  status: "idle" | "scanning";
  progress: number;
  message: string;
  startTime?: number;
}

interface QuecwatchStatus {
  status: "active" | "inactive" | "error";
  message?: string;
}

interface NeighborCells {
  status: "success" | "error" | "running" | "idle";
  timestamp: string;
  mode: "LTE" | "NR5G" | "NRLTE" | "UNKNOWN";
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
  const [pollingCount, setPollingCount] = useState(0); // Track number of polls to prevent infinite loops

  // Cooldown check effect
  useEffect(() => {
    if (!lastScanTime) {
      setCooldownRemaining(0);
      return;
    }

    const checkCooldown = () => {
      const lastScan = new Date(lastScanTime).getTime();
      const now = new Date().getTime();
      const cooldownDuration = 60000; // 60 seconds in milliseconds
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
        "/cgi-bin/quecmanager/experimental/cell_scanner/fetch_mccmnc.sh"
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
        "/cgi-bin/quecmanager/experimental/quecwatch/fetch-quecwatch.sh"
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
  // Parse QSCAN output function
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
        };

        if (type === "LTE") {
          const [squal, cellId, tac, bandwidth, band] = rest;
          const bandwidthValue = parseInt(bandwidth);

          // Convert bandwidth resource blocks to MHz using the mapping
          const bandwidthMHz =
            LTE_RB_BANDWIDTH_MAP[bandwidthValue.toString()] ||
            `${bandwidthValue} RB`;

          return {
            ...baseCellInfo,
            type: "LTE" as const,
            squal: squal === "-" ? 0 : parseInt(squal),
            cellId,
            tac,
            bandwidth: bandwidthValue,
            bandwidthMHz: bandwidthMHz,
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
            ssbScs: parseInt(ssbScs),
          } as NR5GCellInfo;
        }

        // If we can't determine the type, return null - this will be filtered out
        return null;
      })
      .filter((cell): cell is CellInfo => cell !== null); // Type guard to filter out null values
  }, []);

  // Initial check for results - single check, no polling
  const checkInitialResults = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/experimental/cell_scanner/check_scan.sh",
        { headers: { "Cache-Control": "no-cache, no-store" } }
      );

      if (!response.ok) {
        return;
      }

      const result: ScanResult = await response.json();

      // If we have successful results, display them
      if (result.status === "success" && result.output) {
        setScanResult(result);
        setLastScanTime(result.timestamp || null);
        // No need to show toast, just display the results
      } else if (result.status === "running") {
        // A scan is already running, initialize the UI to show that
        setScanState({
          status: "scanning",
          progress: 50, // Arbitrary midpoint since we don't know how long it's been running
          message: "Scan in progress...",
          startTime: Date.now() - 60000, // Assume it's been running for a minute
        });
        startProgressAnimation();
        // Start polling since there's an active scan
        setTimeout(checkScanStatus, 2000);
      }
      // Otherwise, just leave the UI in idle state
    } catch (error) {
      console.error("Failed to check initial scan results", error);
      // No toast for initial check failure
    }
  }, []);

  // Check scan status - only used after explicitly starting a scan
  const checkScanStatus = useCallback(async () => {
    // Check if we've been polling too long (2 minutes)
    if (pollingCount > 60) {
      // Don't reset to idle - just stop polling and let the progress bar continue
      console.log(
        "Reached maximum polling attempts, waiting for results to appear"
      );
      return;
    }

    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/experimental/cell_scanner/check_scan.sh",
        { headers: { "Cache-Control": "no-cache, no-store" } }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ScanResult = await response.json();

      // If we have successful results, update immediately
      if (result.status === "success" && result.output) {
        setScanResult(result);
        setLastScanTime(result.timestamp || null);
        setScanState({
          status: "idle",
          progress: 100,
          message: "",
        });
        setPollingCount(0);
        return;
      }

      // If still running, continue polling
      if (result.status === "running") {
        setPollingCount((prev) => prev + 1);
        setTimeout(checkScanStatus, 2000);
        return;
      }

      // Even if the status is "idle", continue polling for a while
      // This helps in case results appear slightly after the scan completes
      if (pollingCount < 30) {
        setPollingCount((prev) => prev + 1);
        setTimeout(checkScanStatus, 2000);
      }
    } catch (error) {
      console.error("Failed to check scan status", error);

      // Continue polling even on error, up to the limit
      if (pollingCount < 60) {
        setPollingCount((prev) => prev + 1);
        setTimeout(checkScanStatus, 3000); // Slightly longer delay on error
      }
    }
  }, [pollingCount]);

  // Progress animation function - independent of actual scan status
  const startProgressAnimation = useCallback(() => {
    // Total expected scan time: approximately 2 minutes
    const totalDuration = 120000; // 2 minutes in milliseconds
    const updateInterval = 1000; // Update every second
    const startProgress = 10; // Start at 10%
    const maxProgress = 98; // Don't reach 100% until actual completion

    let intervalId: NodeJS.Timeout;

    const updateProgress = () => {
      setScanState((prevState) => {
        // If scan is complete or cancelled, stop animation
        if (prevState.status !== "scanning") {
          clearInterval(intervalId);
          return prevState;
        }

        // Calculate how much time has passed since scan started
        const elapsed = Date.now() - (prevState.startTime || Date.now());

        // Calculate progress percentage (10% to 98% over 2 minutes)
        const progressRange = maxProgress - startProgress;
        const progress =
          startProgress + progressRange * Math.min(elapsed / totalDuration, 1);

        // Determine message based on progress
        let message = "Scanning available networks... This may take a minute";
        if (progress > 85) {
          message = "Finalizing scan results...";
        } else if (progress > 50) {
          message = "Collecting operator data...";
        }

        return {
          ...prevState,
          progress: Math.min(progress, maxProgress),
          message,
        };
      });
    };

    // Start interval to update progress
    intervalId = setInterval(updateProgress, updateInterval);

    // Clear interval after total duration + buffer (2.5 minutes)
    setTimeout(() => {
      clearInterval(intervalId);

      // If we're still scanning after the timer completes, hold at 98%
      setScanState((prevState) => {
        if (prevState.status === "scanning") {
          return {
            ...prevState,
            progress: maxProgress,
            message: "Waiting for results...",
          };
        }
        return prevState;
      });
    }, totalDuration + 30000);
  }, []);

  // Start new scan with countdown-based progress bar
  const startNewScan = useCallback(async () => {
    if (scanState.status === "scanning" || isInitiatingScan) return;

    setIsInitiatingScan(true);
    setScanResult(null); // Clear previous results
    setLastScanTime(null);
    setPollingCount(0);

    // Start with 0% progress
    setScanState({
      status: "scanning",
      progress: 0,
      message: "Initiating scan...",
      startTime: Date.now(),
    });

    try {
      // Begin scan
      const response = await fetch(
        "/cgi-bin/quecmanager/experimental/cell_scanner/cell_scan.sh",
        { headers: { "Cache-Control": "no-cache, no-store" } }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Start the progress animation and result polling
      if (result.status === "running" || result.status === "success") {
        // Update to show scan has started (10%)
        setScanState((prevState) => ({
          ...prevState,
          progress: 10,
          message: "Scan in progress...",
        }));

        // Start countdown animation for progress bar
        startProgressAnimation();

        // Start checking for results
        setTimeout(checkScanStatus, 2000);
      } else {
        throw new Error(result.message || "Failed to start scan");
      }
    } catch (error) {
      console.error("Scan error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to start cell scan",
        variant: "destructive",
      });
      setScanState({ status: "idle", progress: 0, message: "" });
    } finally {
      setIsInitiatingScan(false);
    }
  }, [
    scanState.status,
    isInitiatingScan,
    checkScanStatus,
    startProgressAnimation,
  ]);

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
    if (rsrp >= -65) return <BiSignal5 className="text-xl text-green-500" />;
    if (rsrp >= -75) return <BiSignal4 className="text-xl text-green-400" />;
    if (rsrp >= -85) return <BiSignal3 className="text-xl text-yellow-500" />;
    if (rsrp >= -95) return <BiSignal2 className="text-xl text-yellow-600" />;
    return <BiSignal1 className="text-xl text-red-500" />;
  }, []);

  // Initial check on component mount
  useEffect(() => {
    checkInitialResults();
    fetchQuecwatchStatus();
  }, [checkInitialResults, fetchQuecwatchStatus]);

  // Clear results
  const clearResults = useCallback(async () => {
    setScanResult(null);
    setLastScanTime(null);
    setScanState({ status: "idle", progress: 0, message: "" });
    const response = await fetch(
      "/cgi-bin/quecmanager/experimental/cell_scanner/clear_scan.sh",
      { headers: { "Cache-Control": "no-cache, no-store" } }
    );

    if (!response.ok) return;
    const result: ScanResult = await response.json();
    // If we have successful results, display them
    if (result.status !== "success" && result.status !== "idle") {
      // Show Error toast
      toast({
        title: "Error",
        description: "Failed to remove scan results. Please try again.",
        variant: "destructive",
      });

    }
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
  // Neighbor cell functions
  const startNeighborScan = useCallback(async () => {
    if (isInitiatingScan) return;

    setIsInitiatingScan(true);
    setNeighborCells(null);

    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/experimental/cell_scanner/network_info.sh"
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Neighbor cell data:", data);

      // Transform the data to match the expected structure if needed
      if (data.status === "success" && data.mode) {
        // Check if we need to restructure the data
        if (data.data?.neighborCells || data.data?.meas) {
          // Data already has the expected structure
          setNeighborCells(data);
        } else if (data.raw_data) {
          // Data has a different structure - convert it
          setNeighborCells({
            status: data.status,
            timestamp: data.timestamp,
            mode: data.mode,
            data: {
              neighborCells: data.raw_data.neighborCells,
              meas: data.raw_data.meas,
            },
          });
        }
      } else {
        // Just use the data as is
        setNeighborCells(data);
      }
    } catch (error) {
      console.error("Failed to fetch neighbor cells", error);
      toast({
        title: "Error",
        description: "Failed to scan neighbor cells. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsInitiatingScan(false);
    }
  }, [isInitiatingScan]);

  // Clear neighbor cells results
  const clearNeighborCells = useCallback(() => {
    setNeighborCells(null);
  }, []);

  // Main UI component
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Full Network Cell Scan</CardTitle>
          <CardDescription>
            Scan all available network cells, including those from other network
            providers. Current network mode will affect the results and you may
            be disconnected during the scan.
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
                          <TableHead>Bandwidth</TableHead>
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
                            <TableCell>
                              {cell.type === "LTE"
                                ? (cell as LTECellInfo).bandwidthMHz
                                : (cell as NR5GCellInfo).carrierBandwidth + "MHz"}
                            </TableCell>
                            <TableCell>{parseInt(cell.cellId,16) || "-"}</TableCell>
                            <TableCell>{parseInt(cell.tac,16) || "-"}</TableCell>
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
            Scan neighbor cells of the current network provider. This provides
            detailed information about cells in your immediate vicinity that
            your device can connect to.
            {neighborCells?.timestamp && (
              <div className="mt-1 text-sm text-muted-foreground">
                Last scan: {neighborCells.timestamp}
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NeighborCellsDisplay neighborCells={neighborCells} />
        </CardContent>
        <CardFooter className="border-t py-4">
          <div className="flex items-center space-x-4">
            <Button
              onClick={startNeighborScan}
              disabled={
                isInitiatingScan
              }
            >
              {isInitiatingScan ? (
                <div className="flex items-center gap-x-2">
                  <Loader2 className="animate-spin w-4 h-4" />
                  <span>Scanning...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <MagnifyingGlassIcon className="w-4 h-4" />
                  <span>Start Neighbor Scan</span>
                </div>
              )}
            </Button>

            {neighborCells?.status === "success" && (
              <Button
                variant="destructive"
                onClick={clearNeighborCells}
                disabled={isInitiatingScan}
              >
                <Trash2Icon className="w-4 h-4 mr-2" />
                Clear Results
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
      <FrequencyInfoCard
        scanResult={scanResult}
        isLoading={scanState.status === "scanning"}
        mccMncList={mccMncList}
      />
    </div>
  );
};

export default CellScannerPage;
