"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import {
  Gauge,
  Clock,
  Zap,
  Network,
  Link,
  Play,
  CirclePlay,
  ArrowDownCircle,
  ArrowUpCircle,
  CircleArrowDown,
  CircleArrowUp,
  TrendingUp,
  TrendingDown,
  TriangleAlert,
  RefreshCw,
  CalendarClock,
} from "lucide-react";

import { PuffLoader } from "react-spinners";

// Comprehensive type definitions
interface SpeedtestLatency {
  iqm?: number;
}

interface SpeedtestTransfer {
  bandwidth: number;
  bytes: number;
  elapsed: number;
  latency?: SpeedtestLatency;
}

interface SpeedtestServer {
  name: string;
  location: string;
  country: string;
  host: string;
}

interface SpeedtestInterface {
  internalIp: string;
  externalIp: string;
}

interface SpeedtestResult {
  url?: string;
}

interface SpeedtestData {
  type: "download" | "upload" | "result" | "ping";
  timestamp: number;
  isp: string;
  interface: SpeedtestInterface;
  server: SpeedtestServer;
  download: SpeedtestTransfer;
  upload: SpeedtestTransfer;
  ping: {
    latency: number;
    jitter: number;
    progress: number;
  };
  result: SpeedtestResult;
  status?: string;
}

const formatBytes = (bytes?: number): string => {
  if (bytes == null) return "N/A";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
};

const formatSpeed = (bandwidth?: number): string => {
  if (bandwidth == null) return "N/A";
  const bitsPerSecond = bandwidth * 8;
  const units = ["bps", "Kbps", "Mbps", "Gbps"];
  let value = bitsPerSecond;
  let unitIndex = 0;

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }

  return units[unitIndex] === "Gbps"
    ? `${value.toFixed(2)} ${units[unitIndex]}`
    : `${Math.round(value)} ${units[unitIndex]}`;
};

const SpeedtestStream = () => {
  const { toast } = useToast();

  // State management
  const [speedtestData, setSpeedtestData] = useState<SpeedtestData | null>(
    null
  );
  const [currentType, setCurrentType] = useState<
    "download" | "upload" | "ping" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [isTestRunning, setIsTestRunning] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [pingProgress, setPingProgress] = useState<number>(0);
  const [isCooldown, setIsCooldown] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const speedtestDataRef = useRef<SpeedtestData | null>(null);
  const showResultsRef = useRef<boolean>(false);

  const resetState = useCallback(() => {
    setSpeedtestData(null);
    setCurrentType(null);
    setError(null);
    setShowResults(false);
    setIsTestRunning(false);
    setIsStarting(false);
    setPingProgress(0);
    speedtestDataRef.current = null;
    showResultsRef.current = false;

    // Clear any existing poll interval
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  }, []);

  useEffect(() => {
    const storedData = sessionStorage.getItem("speedtestData");
    if (storedData) setSpeedtestData(JSON.parse(storedData));
    if (showResults && !isTestRunning) {
      setIsCooldown(true);
      const timer = setTimeout(() => {
        setIsCooldown(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showResults, isTestRunning]);

  useEffect(() => {
    // Cleanup function
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/speedtest/speedtest_status.sh"
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status}`);
      }

      const data = await response.json();

      // Check if test is not running
      if (data.status === "not_running") {
        if (isTestRunning) {
          setError("Test ended unexpectedly");
          setIsTestRunning(false);
        }

        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
        return;
      }

      // Update state based on the data type
      if (data.type) {
        try {
          switch (data.type) {
            case "ping":
              setCurrentType("ping");
              if (data.ping && typeof data.ping.progress === "number") {
                setPingProgress(data.ping.progress);
              }
              break;
            case "download":
            case "upload":
              // Only update type if we're not in ping phase
              if (currentType !== "ping") {
                setCurrentType(data.type);
              }
              break;
            case "result":
              // We received the final result - make sure it has the required data
              if (data.download && data.upload && data.ping) {
                // We have complete data - show results
                speedtestDataRef.current = data;
                setSpeedtestData(data);
                showResultsRef.current = true;
                setShowResults(true);
                setIsTestRunning(false);

                sessionStorage.setItem("speedtestData", JSON.stringify(data));
                if (pollInterval.current) {
                  clearInterval(pollInterval.current);
                  pollInterval.current = null;
                }
                return; // Exit early as we have complete results
              } else {
                console.warn("Incomplete result data received:", data);
              }
              break;
          }
        } catch (error) {
          console.error("Error processing speedtest data:", error);
        }
      }

      // Check if we should stop polling (using ref to avoid stale closure)
      if (showResultsRef.current) {
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
        return;
      }

      // Update the speedtest data - only if we have meaningful data
      if (
        (data.type && (data.download || data.upload || data.ping)) ||
        data.isp
      ) {
        speedtestDataRef.current = data;
        setSpeedtestData(data);
      }
    } catch (error) {
      console.error("Error polling speedtest status:", error);
      if (isTestRunning) {
        setError("Failed to get speedtest status");
        setIsTestRunning(false);
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
      }
    }
  }, [currentType, isTestRunning]);

  const startSpeedtest = useCallback(async () => {
    if (isCooldown) return;

    try {
      // Reset all state before starting new test
      resetState();
      setIsStarting(true);
      setIsTestRunning(true);
      setIsDialogOpen(true);

      // Start the speedtest
      const startResponse = await fetch(
        "/cgi-bin/quecmanager/home/speedtest/start_speedtest.sh",
        { method: "GET" }
      );

      if (!startResponse.ok) {
        throw new Error("Failed to start speedtest");
      }

      // Begin polling for status updates - 300ms for smoother UI updates
      pollInterval.current = setInterval(pollStatus, 300);
      setIsStarting(false);
    } catch (startError) {
      console.error("Speedtest start error:", startError);
      setError(
        startError instanceof Error
          ? `Failed to start speedtest: ${startError.message}`
          : "Failed to start speedtest"
      );
      setIsStarting(false);
      setIsTestRunning(false);
    }
  }, [isCooldown, resetState, pollStatus]);

  const renderSpeedtestContent = () => {
    
    // Check if we have complete results (same logic as "Run Again" button)
    const hasCompleteResults = showResults || (
      speedtestData && 
      speedtestData.download && 
      speedtestData.upload && 
      speedtestData.ping && 
      !isTestRunning
    );
    
    // Result view (original design) - CHECK THIS FIRST!
    if (hasCompleteResults) {
      // Ensure speedtestData and all required nested properties exist
      if (
        !speedtestData ||
        !speedtestData.download ||
        !speedtestData.upload ||
        !speedtestData.ping
      ) {
        return (
          <div className="flex flex-col items-center justify-center space-y-4">
            <TriangleAlert className="text-amber-500 lg:size-16 size-8" />
            <h3 className="text-xl font-semibold">Incomplete Test Results</h3>
            <p className="text-sm text-gray-500 text-center">
              The test didn't complete properly. Some data may be missing.
              <span
                className="underline cursor-pointer ml-2 block"
                onClick={() => {
                  resetState();
                  startSpeedtest();
                }}
              >
                Run the test again
              </span>
            </p>
          </div>
        );
      }

      return (
        <div className="grid gap-4 w-full min-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Gauge className="mr-4 text-violet-600" /> Speedtest Result
              </CardTitle>
            </CardHeader>
            <CardContent className="lg:py-12 py-6 min-w-sm w-full">
              <div className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-4 lg:gap-y-0 gap-y-8 gap-x-8">
                <div className="grid gap-1 place-items-center">
                  <div className="flex items-center space-x-2">
                    <CircleArrowDown className="text-green-600 lg:size-6 size-4" />
                    <p className="font-semibold">Download</p>
                  </div>
                  <h1 className="text-[3rem] font-semibold text-center antialiased leading-tight">
                    {formatSpeed(speedtestData.download?.bandwidth)}
                  </h1>
                  <div className="grid gap-0.5 lg:flex lg:items-center lg:space-x-1">
                    <div className="flex items-center justify-center gap-x-2">
                      <TrendingDown className="text-gray-600 lg:size-6 size-4" />
                      <p className="text-foreground-muted text-sm text-center">
                        Latency
                      </p>
                    </div>
                    <p className="text-foreground-muted text-sm text-center">
                      {speedtestData.download?.latency?.iqm?.toFixed(2) ??
                        "N/A"}{" "}
                      ms
                    </p>
                  </div>
                </div>

                <div className="grid gap-1.5 place-items-center">
                  <div className="flex items-center space-x-2">
                    <CircleArrowUp className="text-violet-600 lg:size-6 size-4" />
                    <p className="font-semibold">Upload</p>
                  </div>
                  <h1 className="text-[3rem] font-semibold text-center antialiased leading-tight">
                    {formatSpeed(speedtestData.upload?.bandwidth)}
                  </h1>
                  <div className="grid gap-0.5 lg:flex lg:items-center lg:space-x-1">
                    <div className="flex items-center justify-center gap-x-2">
                      <TrendingDown className="text-gray-600 lg:size-6 size-4" />
                      <p className="text-foreground-muted text-sm text-center">
                        Latency
                      </p>
                    </div>
                    <p className="text-foreground-muted text-sm text-center">
                      {speedtestData.upload?.latency?.iqm?.toFixed(2) ?? "N/A"}{" "}
                      ms
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between mx-auto">
              <div className="grid gap-0.5 lg:flex lg:items-center lg:space-x-1">
                <div className="flex items-center justify-center gap-x-2">
                  <Clock className="text-gray-600 lg:size-6 size-4" />
                  <p className="text-foreground-muted text-sm text-center">
                    Ping
                  </p>
                </div>
                <p className="text-foreground-muted text-sm text-center">
                  {speedtestData.ping?.latency?.toFixed(2) ?? "N/A"} ms
                </p>
              </div>

              <div className="grid gap-0.5 lg:flex lg:items-center lg:space-x-1">
                <div className="flex items-center justify-center gap-x-2">
                  <TrendingUp className="text-gray-600 lg:size-6 size-4" />
                  <p className="text-foreground-muted text-sm text-center">
                    Jitter
                  </p>
                </div>
                <p className="text-foreground-muted text-sm text-center">
                  {speedtestData.ping?.jitter?.toFixed(2) ?? "N/A"} ms
                </p>
              </div>
            </CardFooter>
          </Card>

          {/* Mobile: Show only "View Full Result Online" link */}
          {speedtestData.result?.url && (
            <div className="flex items-center justify-center gap-x-2 mt-4 md:hidden">
              <Link className="text-blue-600 size-4" />
              <a
                href={speedtestData.result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:underline"
              >
                View Full Result Online
              </a>
            </div>
          )}

          {/* Desktop: Show full Connection & Server Details */}
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Network className="mr-4 text-blue-600" /> Connection & Server
                Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">ISP:</p>
                  <p>{speedtestData.isp || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Internal IP:</p>
                  <p>{speedtestData.interface?.internalIp || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">External IP:</p>
                  <p>{speedtestData.interface?.externalIp || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Server Name:</p>
                  <p>{speedtestData.server?.name || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Location:</p>
                  <p>{speedtestData.server?.location || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Country:</p>
                  <p>{speedtestData.server?.country || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Server IP:</p>
                  <p>{speedtestData.server?.host || "N/A"}</p>
                </div>

                {speedtestData.result?.url && (
                  <div className="flex items-center gap-x-2 mt-4">
                    <Link className="text-blue-600 size-4" />
                    <a
                      href={speedtestData.result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline"
                    >
                      View Full Result Online
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4">
          <TriangleAlert className="text-rose-600 lg:size-48 size-16 animate-pulse" />
          <h3 className="text-xl font-semibold">Network Speedtest Failed</h3>
          <p className="text-sm text-gray-500">
            Something went wrong while running the speedtest.
            <span
              className="underline cursor-pointer ml-2"
              onClick={() => {
                resetState();
                startSpeedtest();
              }}
            >
              Please try again.
            </span>
          </p>
        </div>
      );
    }

    // Waiting for speedtest to start - show this when we're in the starting state
    // or when we're running the test but don't have data yet
    if (isStarting || (isTestRunning && !speedtestData)) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Play className="text-primary lg:size-48 size-16 animate-pulse" />
          <h3 className="md:text-xl text-lg font-semibold">
            Initiating Network Speedtest
          </h3>
          <p className="text-sm text-gray-500 text-center">
            Locating and establishing a connection to a server. Please wait...
          </p>
        </div>
      );
    }

    // Ping latency calculation state (using new design)
    if (currentType === "ping") {
      return (
        <div className="flex flex-col items-center justify-center space-y-6 transition-all duration-500 ease-in-out">
          <div className="relative">
            <Clock className="text-blue-500 size-16 animate-pulse drop-shadow-sm" />
            <div className="absolute -inset-2 bg-blue-500/10 rounded-full animate-ping"></div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-blue-600 transition-colors duration-300">
              Testing Ping Latency
            </h3>
            <p className="text-sm text-gray-500">
              Measuring network responsiveness...
            </p>
          </div>

          {/* Progress bar with smooth animation */}
          <div className="w-full max-w-md space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(pingProgress || 0) * 100}%` }}
              ></div>
            </div>
            <div className="text-center">
              <span className="text-sm text-gray-600">
                {Math.round((pingProgress || 0) * 100)}% complete
              </span>
            </div>
          </div>

          {/* Live ping results with number animation */}
          {speedtestData?.ping && (
            <div className="text-center space-y-2 animate-in fade-in duration-500">
              <div className="text-3xl font-bold text-blue-600 tabular-nums transition-all duration-200">
                {speedtestData.ping.latency.toFixed(1)} ms
              </div>
              {speedtestData.ping.jitter && (
                <div className="text-sm text-gray-500">
                  Jitter: {speedtestData.ping.jitter.toFixed(1)} ms
                </div>
              )}
            </div>
          )}

          {/* Next phase preview */}
          <div className="text-center opacity-60 transition-opacity duration-500">
            <div className="flex items-center justify-center space-x-2 text-gray-400">
              <ArrowDownCircle className="size-4" />
              <span className="text-xs">Download test coming next...</span>
            </div>
          </div>
        </div>
      );
    }

    // Download test state (using new design)
    if (currentType === "download") {
      return (
        <div className="space-y-6 transition-all duration-500 ease-in-out">
          {/* Completed ping results - compact view */}
          {speedtestData?.ping && (
            <div className="bg-blue-50 rounded-lg p-3 transition-all duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="text-blue-500 size-4" />
                  <span className="text-sm font-medium text-blue-700">
                    Ping Complete
                  </span>
                </div>
                <div className="text-sm font-bold text-blue-600 tabular-nums">
                  {speedtestData.ping.latency.toFixed(1)} ms
                </div>
              </div>
            </div>
          )}

          {/* Active download test */}
          <div className="text-center space-y-4">
            <div className="relative flex items-center justify-center">
              <ArrowDownCircle className="text-green-500 size-16 animate-pulse drop-shadow-sm" />
              <div className="absolute size-24 bg-green-500/10 rounded-full animate-ping -top-4 "></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-green-600 transition-colors duration-300">
                Testing Download Speed
              </h3>
            </div>

            {/* Live download speed with smooth number transitions */}
            <div className="space-y-2">
              <div className="text-4xl lg:text-5xl font-bold text-green-600 tabular-nums transition-all duration-200 tracking-tight">
                {speedtestData?.download?.bandwidth
                  ? formatSpeed(speedtestData.download.bandwidth)
                  : "0 Mbps"}
              </div>
              {speedtestData?.download && (
                <div className="space-y-1 text-sm text-gray-500">
                  <div className="tabular-nums">
                    {formatBytes(speedtestData.download.bytes)} transferred
                  </div>
                  {speedtestData.download.elapsed && (
                    <div className="tabular-nums">
                      {(speedtestData.download.elapsed / 1000).toFixed(1)}s
                      elapsed
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Next phase preview */}
            <div className="text-center opacity-60 transition-opacity duration-500">
              <div className="flex items-center justify-center space-x-2 text-gray-400">
                <ArrowUpCircle className="size-4" />
                <span className="text-xs">Upload test coming next...</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Upload test state (using new design)
    if (currentType === "upload") {
      return (
        <div className="space-y-6 transition-all duration-500 ease-in-out">
          {/* Active upload test */}
          <div className="text-center space-y-4">
            <div className="relative flex items-center justify-center">
              <ArrowUpCircle className="text-violet-500 size-16 animate-pulse drop-shadow-sm" />
              <div className="absolute size-24 bg-violet-500/10 rounded-full animate-ping -top-4 "></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-violet-600 transition-colors duration-300">
                Testing Upload Speed
              </h3>
              <p className="text-sm text-gray-500">Uploading test data...</p>
            </div>

            {/* Live upload speed with smooth number transitions */}
            <div className="space-y-2">
              <div className="text-4xl lg:text-5xl font-bold text-violet-600 tabular-nums transition-all duration-200 tracking-tight">
                {speedtestData?.upload?.bandwidth 
                  ? formatSpeed(speedtestData.upload.bandwidth)
                  : "0 Mbps"
                }
              </div>
              {speedtestData?.upload && (
                <div className="space-y-1 text-sm text-gray-500">
                  <div className="tabular-nums">
                    {formatBytes(speedtestData.upload.bytes)} transferred
                  </div>
                  {speedtestData.upload.elapsed && (
                    <div className="tabular-nums">
                      {(speedtestData.upload.elapsed / 1000).toFixed(1)}s elapsed
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Result view (original design)
    if (hasCompleteResults) {
      // Ensure speedtestData and all required nested properties exist
      if (
        !speedtestData ||
        !speedtestData.download ||
        !speedtestData.upload ||
        !speedtestData.ping
      ) {
        return (
          <div className="flex flex-col items-center justify-center space-y-4">
            <TriangleAlert className="text-amber-500 lg:size-16 size-8" />
            <h3 className="text-xl font-semibold">Incomplete Test Results</h3>
            <p className="text-sm text-gray-500 text-center">
              The test didn't complete properly. Some data may be missing.
              <span
                className="underline cursor-pointer ml-2 block"
                onClick={() => {
                  resetState();
                  startSpeedtest();
                }}
              >
                Run the test again
              </span>
            </p>
          </div>
        );
      }

      return (
        <div className="grid gap-4 w-full min-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Gauge className="mr-4 text-violet-600" /> Speedtest Result
              </CardTitle>
            </CardHeader>
            <CardContent className="lg:py-12 py-6 min-w-sm w-full">
              <div className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-4 lg:gap-y-0 gap-y-8 gap-x-8">
                <div className="grid gap-1 place-items-center">
                  <div className="flex items-center space-x-2">
                    <CircleArrowDown className="text-green-600 lg:size-6 size-4" />
                    <p className="font-semibold">Download</p>
                  </div>
                  <h1 className="text-[3rem] font-semibold text-center antialiased leading-tight">
                    {formatSpeed(speedtestData.download?.bandwidth)}
                  </h1>
                  <div className="grid gap-0.5 lg:flex lg:items-center lg:space-x-1">
                    <div className="flex items-center justify-center gap-x-2">
                      <TrendingDown className="text-gray-600 lg:size-6 size-4" />
                      <p className="text-foreground-muted text-sm text-center">
                        Latency
                      </p>
                    </div>
                    <p className="text-foreground-muted text-sm text-center">
                      {speedtestData.download?.latency?.iqm?.toFixed(2) ??
                        "N/A"}{" "}
                      ms
                    </p>
                  </div>
                </div>

                <div className="grid gap-1.5 place-items-center">
                  <div className="flex items-center space-x-2">
                    <CircleArrowUp className="text-violet-600 lg:size-6 size-4" />
                    <p className="font-semibold">Upload</p>
                  </div>
                  <h1 className="text-[3rem] font-semibold text-center antialiased leading-tight">
                    {formatSpeed(speedtestData.upload?.bandwidth)}
                  </h1>
                  <div className="grid gap-0.5 lg:flex lg:items-center lg:space-x-1">
                    <div className="flex items-center justify-center gap-x-2">
                      <TrendingDown className="text-gray-600 lg:size-6 size-4" />
                      <p className="text-foreground-muted text-sm text-center">
                        Latency
                      </p>
                    </div>
                    <p className="text-foreground-muted text-sm text-center">
                      {speedtestData.upload?.latency?.iqm?.toFixed(2) ?? "N/A"}{" "}
                      ms
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between mx-auto">
              <div className="grid gap-0.5 lg:flex lg:items-center lg:space-x-1">
                <div className="flex items-center justify-center gap-x-2">
                  <Clock className="text-gray-600 lg:size-6 size-4" />
                  <p className="text-foreground-muted text-sm text-center">
                    Ping
                  </p>
                </div>
                <p className="text-foreground-muted text-sm text-center">
                  {speedtestData.ping?.latency?.toFixed(2) ?? "N/A"} ms
                </p>
              </div>

              <div className="grid gap-0.5 lg:flex lg:items-center lg:space-x-1">
                <div className="flex items-center justify-center gap-x-2">
                  <TrendingUp className="text-gray-600 lg:size-6 size-4" />
                  <p className="text-foreground-muted text-sm text-center">
                    Jitter
                  </p>
                </div>
                <p className="text-foreground-muted text-sm text-center">
                  {speedtestData.ping?.jitter?.toFixed(2) ?? "N/A"} ms
                </p>
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Network className="mr-4 text-blue-600" /> Connection & Server
                Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">ISP:</p>
                  <p>{speedtestData.isp || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Internal IP:</p>
                  <p>{speedtestData.interface?.internalIp || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">External IP:</p>
                  <p>{speedtestData.interface?.externalIp || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Server Name:</p>
                  <p>{speedtestData.server?.name || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Location:</p>
                  <p>{speedtestData.server?.location || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Country:</p>
                  <p>{speedtestData.server?.country || "N/A"}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Server IP:</p>
                  <p>{speedtestData.server?.host || "N/A"}</p>
                </div>

                {speedtestData.result?.url && (
                  <div className="flex items-center gap-x-2 mt-4">
                    <Link className="text-blue-600 size-4" />
                    <a
                      href={speedtestData.result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline"
                    >
                      View Full Result Online
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // If we reach here, there's something unexpected happening
    // Show a generic running state
    return (
      <div className="flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="text-primary size-8 animate-spin" />
        <p className="text-sm text-gray-500">
          Please wait while the test is running...
        </p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Network Speedtest</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 p-4 items-center justify-center">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <div className="relative flex flex-col items-center justify-center">
              <PuffLoader
                color="#5420ab"
                size={192}
                className="-top-8 -left-8 absolute"
                style={{
                  zIndex: 1,
                }}
              />
              <CirclePlay
                className="size-32 z-10 text-primary cursor-pointer hover:text-primary/80 transition-colors duration-300"
                onClick={(e) => {
                  if (!isCooldown) {
                    e.preventDefault(); // Prevent DialogTrigger from opening automatically
                    startSpeedtest();
                  }
                }}
              />
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Gauge className="mr-2" /> Network Speedtest
                {showResults && !isTestRunning && (
                  <Badge variant="outline" className="ml-2 hidden md:block">
                    Complete
                  </Badge>
                )}
                {isTestRunning && (
                  <Badge variant="outline" className="ml-2 bg-primary/10">
                    Running...
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="lg:max-w-full mx-auto min-w-sm py-6">
              {renderSpeedtestContent()}
            </div>
            <DialogFooter className="flex justify-between gap-4">
              {showResults ? (
                <>
                  <div>
                    <Button
                      onClick={() => {
                        if (!isCooldown) {
                          resetState();
                          startSpeedtest();
                        } else {
                          toast({
                            title: "Please wait",
                            description: "Cooldown period active",
                          });
                        }
                      }}
                      variant="outline"
                      disabled={isCooldown}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Run Again
                    </Button>
                  </div>
                  <Button onClick={() => setIsDialogOpen(false)}>Close</Button>
                </>
              ) : (
                <>
                  {isTestRunning ? (
                    <Button
                      onClick={() => {
                        resetState();
                        setIsDialogOpen(false);
                      }}
                      variant="destructive"
                    >
                      Cancel Test
                    </Button>
                  ) : (
                    <Button onClick={() => setIsDialogOpen(false)}>
                      Close
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div>
          <CardDescription className="relative flex flex-col items-center justify-center">
            {isCooldown
              ? "Please wait 10 seconds before starting another test."
              : isTestRunning
              ? "Test in progress..."
              : "Run a speed test to check your internet connection."}
          </CardDescription>
          {speedtestData ? (
            <div className="mt-4">
              <div className="relative flex flex-col items-center justify-center">
                <div className="grid grid-cols-3 grid-flow-row">
                  <div className="flex items-center mx-2">
                    <ArrowDownCircle className="text-green-500 size-4 mr-1" />
                    {speedtestData?.download
                      ? `${formatSpeed(speedtestData?.download?.bandwidth)}`
                      : "N/A"}
                  </div>
                  <div className="flex items-center mx-2">
                    <ArrowUpCircle className="text-violet-500 size-4 mr-1" />
                    {speedtestData?.upload
                      ? `${formatSpeed(speedtestData?.upload?.bandwidth)}`
                      : "N/A"}
                  </div>
                  <div className="flex items-center mx-2">
                    <Clock className="text-gray-600 size-4 mr-1" />
                    {speedtestData?.ping
                      ? `${speedtestData?.ping?.latency?.toFixed(2)} ms`
                      : "N/A"}
                  </div>
                </div>
              </div>
              {/* <div className="relative flex flex-col items-center justify-center mt-2">
                <div className="grid grid-cols-1 grid-flow-row">
                  <div className="grid place-items-center ">
                    { !isTestRunning && speedtestData.timestamp ? `Latest Test: ${speedtestData?.timestamp}` : ''}
                  </div>
                </div>
              </div> */}
            </div>
          ) : isTestRunning ? (
            <p className="text-sm text-gray-500 text-center">
              "Test in progress..."
            </p>
          ) : (
            <p className="text-sm text-gray-500 text-center">
              "Previous data not available."
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SpeedtestStream;
