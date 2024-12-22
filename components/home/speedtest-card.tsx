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

import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";

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
}

// Utility functions with type annotations
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

  // Only use decimal for Gbps, round for other units
  if (units[unitIndex] === "Gbps") {
    return `${value.toFixed(2)} ${units[unitIndex]}`;
  } else {
    return `${Math.round(value)} ${units[unitIndex]}`;
  }
};

const SpeedtestStream = () => {
  const [speedtestData, setSpeedtestData] = useState<SpeedtestData | null>(
    null
  );
  const [currentType, setCurrentType] = useState<
    "download" | "upload" | "ping" | null
  >(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [isTestRunning, setIsTestRunning] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [pingProgress, setPingProgress] = useState<number>(0);
  const [isCooldown, setIsCooldown] = useState<boolean>(false);

  // Refs to track state without causing re-renders
  const speedtestDataRef = useRef<SpeedtestData | null>(null);
  const abortControllerRef = useRef<AbortController>(new AbortController());

  // Handle cooldown period
  useEffect(() => {
    if (showResults && !isTestRunning) {
      setIsCooldown(true);
      const timer = setTimeout(() => {
        setIsCooldown(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showResults, isTestRunning]);

  const startSpeedtest = useCallback(async () => {
    if (isCooldown) return; // Prevent starting if in cooldown

    try {
      setIsStarting(true);
      setError(null);

      // Send start request
      const startResponse = await fetch(
        "/cgi-bin/home/speedtest/start_speedtest.sh",
        {
          method: "GET",
        }
      );

      if (!startResponse.ok) {
        throw new Error("Failed to start speedtest");
      }

      // If start request is successful, begin connection
      connectToSpeedtest();
    } catch (startError) {
      console.error("Speedtest start error:", startError);
      setError(
        startError instanceof Error
          ? `Failed to start speedtest: ${startError.message}`
          : "Failed to start speedtest"
      );
      setIsStarting(false);
    }
  }, [isCooldown]);

  const connectToSpeedtest = useCallback(() => {
    // Abort any existing connection
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    // Reset states
    setError(null);
    setIsConnected(false);
    setShowResults(false);
    setIsTestRunning(true);
    setIsStarting(false);
    setPingProgress(0);

    try {
      fetch("/cgi-bin/home/speedtest/speedtest_stream.sh", {
        method: "GET",
        signal: abortControllerRef.current.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }

          setIsConnected(true);
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error("Unable to get reader from response body");
          }

          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // Decode the chunk
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process complete events
            const events = buffer.split("\n\n");
            buffer = events.pop() || ""; // Keep incomplete event in buffer

            events.forEach((event) => {
              if (event.startsWith("data: ")) {
                try {
                  const parsedData = JSON.parse(
                    event.replace("data: ", "").trim()
                  ) as SpeedtestData;

                  // Debug logging
                  console.log(
                    "Debug - Parsed Data:",
                    JSON.stringify(parsedData, null, 2)
                  );

                  // Update state and ref simultaneously
                  speedtestDataRef.current = parsedData;
                  setSpeedtestData(parsedData);

                  // Handle different types of data
                  if (parsedData.type === "ping") {
                    setCurrentType("ping");
                    setPingProgress(parsedData.ping.progress);
                  } else if (
                    parsedData.type === "download" ||
                    parsedData.type === "upload"
                  ) {
                    setCurrentType(parsedData.type);
                  }

                  if (parsedData.type === "result") {
                    setShowResults(true);
                    setIsTestRunning(false);
                    reader.cancel(); // Stop reading
                  }
                } catch (parseError) {
                  console.error("Parsing error:", parseError);
                }
              }
            });
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error("Fetch error:", err);
            setError(
              `Connection failed: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
            setIsTestRunning(false);
          }
        });
    } catch (initError) {
      console.error("Failed to initialize fetch:", initError);
      setError("Failed to connect to speedtest stream");
      setIsTestRunning(false);
    }

    return () => {
      abortControllerRef.current.abort();
    };
  }, []);

  const renderSpeedtestContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4">
          <TriangleAlert className="text-rose-600 lg:size-48 size-16 animate-pulse" />
          <h3 className="text-xl font-semibold">Network Speedtest Failed</h3>
          <p className="text-sm text-gray-500">
            Something went wrong while running the speedtest.
            <p
              className="underline cursor-pointer ml-2"
              onClick={startSpeedtest}
            >
              Please try again.
            </p>
          </p>
        </div>
      );
    }

    // Waiting for speedtest to start
    if (isStarting) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Play className="text-primary lg:size-48 size-16 animate-pulse" />
          <h3 className="text-xl font-semibold">
            Initiating Network Speedtest
          </h3>
          <p className="text-sm text-gray-500 text-center">
            Locating and establishing a connection to a server. Please wait...
          </p>
        </div>
      );
    }

    // Ping latency calculation state
    if (currentType === "ping") {
      return (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Clock className="text-gray-600 size-16 animate-pulse" />
          <h3 className="text-xl font-semibold">Calculating Ping Latency</h3>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${(pingProgress || 0) * 100}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500">
            {speedtestData?.ping
              ? `Latency: ${speedtestData.ping.latency.toFixed(2)} ms, 
                 Jitter: ${speedtestData.ping.jitter.toFixed(2)} ms`
              : "Measuring network responsiveness..."}
          </p>
        </div>
      );
    }

    // Result view
    if (showResults) {
      return (
        <div className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-4 w-full min-w-sm">
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
                    {formatSpeed(speedtestData?.download.bandwidth)}
                  </h1>
                  <div className="grid gap-0.5 lg:flex lg:items-center lg:space-x-1">
                    <div className="flex items-center justify-center gap-x-2">
                      <TrendingDown className="text-gray-600 lg:size-6 size-4" />
                      <p className="text-foreground-muted text-sm text-center">
                        Latency
                      </p>
                    </div>
                    <p className="text-foreground-muted text-sm text-center">
                      {speedtestData?.download.latency?.iqm?.toFixed(2) ??
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
                    {formatSpeed(speedtestData?.upload.bandwidth)}
                  </h1>
                  <div className="grid gap-0.5 lg:flex lg:items-center lg:space-x-1">
                    <div className="flex items-center justify-center gap-x-2">
                      <TrendingDown className="text-gray-600 lg:size-6 size-4" />
                      <p className="text-foreground-muted text-sm text-center">
                        Latency
                      </p>
                    </div>
                    <p className="text-foreground-muted text-sm text-center">
                      {speedtestData?.upload.latency?.iqm?.toFixed(2) ?? "N/A"}{" "}
                      ms
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="mt-4 grid grid-cols-2 grid-flow-row gap-2 truncate">
              <div className="grid gap-0.5 lg:flex lg:items-center lg:space-x-1">
                <div className="flex items-center justify-center gap-x-2">
                  <Clock className="text-gray-600 lg:size-6 size-4" />
                  <p className="text-foreground-muted text-sm text-center">
                    Ping
                  </p>
                </div>
                <p className="text-foreground-muted text-sm text-center">
                  {speedtestData?.ping.latency.toFixed(2) ?? "N/A"} ms
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
                  {speedtestData?.ping.jitter.toFixed(2) ?? "N/A"} ms
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
                  <p>{speedtestData?.isp}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Internal IP:</p>
                  <p>{speedtestData?.interface.internalIp}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">External IP:</p>
                  <p>{speedtestData?.interface.externalIp}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Server Name:</p>
                  <p>{speedtestData?.server.name}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Location:</p>
                  <p>{speedtestData?.server.location}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Country:</p>
                  <p>{speedtestData?.server.country}</p>
                </div>

                <div className="grid grid-cols-2 grid-flow-row gap-2 truncate">
                  <p className="font-medium">Server IP:</p>
                  <p>{speedtestData?.server.host}</p>
                </div>

                {speedtestData?.result.url && (
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

    // Previous download/upload view
    if (!currentType) return null;
    if (!speedtestData) return null;
    const data = speedtestData[currentType];
    const isDownload = currentType === "download";

    return (
      <Card className="p-4 w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            {isDownload ? (
              <ArrowDownCircle className="text-green-500 lg:size-6 size-4 mr-1" />
            ) : (
              <ArrowUpCircle className="text-violet-500 lg:size-6 size-4 mr-1" />
            )}
            <p className="ml-2">
              Testing {isDownload ? "Download" : "Upload"} Speed
            </p>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid place-items-center max-w-sm lg:max-w-full mx-auto w-full">
            <h1 className="lg:text-[4rem] text-[3rem] font-semibold text-center">
              {formatSpeed(data.bandwidth)}
            </h1>
          </div>
        </CardContent>
        <CardFooter>
          <div className="grid lg:grid-cols-3 grid-cols-1 grid-flow-row gap-4">
            <div className="grid gap-1 place-items-center">
              <div className="flex items-center">
                <Zap className="mr-2 text-yellow-600" />
                Bytes Transferred
              </div>
              <p className="lg:text-md text-base text-muted font-semibold">
                {formatBytes(data.bytes)}
              </p>
            </div>
            <div className="grid gap-1 place-items-center">
              <div className="flex items-center">
                <Gauge className="mr-2 text-purple-600" />
                Elapsed Time
              </div>
              <p className="lg:text-md text-base text-muted font-semibold">
                {(data.elapsed / 1000).toFixed(2)} sec
              </p>
            </div>
            <div className="grid gap-1 place-items-center">
              <div className="flex items-center">
                <Clock className="mr-2 text-gray-600" />
                Latency (IQM)
              </div>
              <p className="lg:text-md text-base text-muted font-semibold">
                {data.latency?.iqm?.toFixed(2) ?? "N/A"} ms
              </p>
            </div>
          </div>
        </CardFooter>
      </Card>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Network Speedtest</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 p-4 items-center justify-center">
        <Drawer>
          <DrawerTrigger asChild>
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
                className="size-32 text-primary cursor-pointer z-10"
                onClick={startSpeedtest}
              />
            </div>
          </DrawerTrigger>
          <DrawerContent>
            <div className="lg:max-w-full max-w-sm mx-auto min-w-sm p-6 py-12">
              {renderSpeedtestContent()}
            </div>
          </DrawerContent>
        </Drawer>
        <CardDescription>
          {isCooldown
            ? " Please wait 10 seconds before starting another test."
            : "Run a speed test to check your internet connection."}
        </CardDescription>
      </CardContent>
    </Card>
  );
};

export default SpeedtestStream;