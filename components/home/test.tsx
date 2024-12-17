"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import {
  Download,
  Upload,
  Gauge,
  Clock,
  Zap,
  Network,
  MapPin,
  Globe,
  Link,
  Wifi,
  RefreshCw,
  Play,
  CirclePlay,
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

  return `${value.toFixed(2)} ${units[unitIndex]}`;
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

  // Refs to track state without causing re-renders
  const speedtestDataRef = useRef<SpeedtestData | null>(null);
  const abortControllerRef = useRef<AbortController>(new AbortController());

  const startSpeedtest = useCallback(async () => {
    try {
      setIsStarting(true);
      setError(null);

      // Send start request
      const startResponse = await fetch(
        "http://192.168.224.1/cgi-bin/home/speedtest/start_speedtest.sh",
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
  }, []);

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
      fetch("http://192.168.224.1/cgi-bin/home/speedtest/speedtest_stream.sh", {
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
        <div className="text-red-500 flex items-center justify-center">
          <RefreshCw className="mr-2 animate-spin" /> {error}
        </div>
      );
    }

    // Waiting for speedtest to start
    if (isStarting) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Play className="text-primary lg:size-32 size-16 animate-pulse" />
          <h3 className="text-xl font-semibold">Starting Speedtest</h3>
          <p className="text-sm text-gray-500">
            Please wait while searching and connecting to a server...
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Network className="mr-2 text-blue-600" /> Connection Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">ISP:</span>
                  <span>{speedtestData?.isp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Internal IP:</span>
                  <span>{speedtestData?.interface.internalIp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">External IP:</span>
                  <span>{speedtestData?.interface.externalIp}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="p-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="mr-2 text-green-600" /> Server Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Name:</span>
                  <span>{speedtestData?.server.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Location:</span>
                  <span>
                    {speedtestData?.server.location},{" "}
                    {speedtestData?.server.country}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Server IP:</span>
                  <span>{speedtestData?.server.host}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="p-4 md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Gauge className="mr-2 text-purple-600" /> Speed & Ping Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="font-semibold flex items-center">
                    <Download className="mr-2 text-blue-600" /> Download
                  </h4>
                  <p>{formatSpeed(speedtestData?.download.bandwidth)}</p>
                  <small>
                    Latency:{" "}
                    {speedtestData?.download.latency?.iqm?.toFixed(2) ?? "N/A"}{" "}
                    ms
                  </small>
                </div>
                <div>
                  <h4 className="font-semibold flex items-center">
                    <Upload className="mr-2 text-green-600" /> Upload
                  </h4>
                  <p>{formatSpeed(speedtestData?.upload.bandwidth)}</p>
                  <small>
                    Latency:{" "}
                    {speedtestData?.upload.latency?.iqm?.toFixed(2) ?? "N/A"} ms
                  </small>
                </div>
                <div>
                  <h4 className="font-semibold flex items-center">
                    <Clock className="mr-2 text-gray-600" /> Ping
                  </h4>
                  <p>{speedtestData?.ping.latency.toFixed(2)} ms</p>
                  <small>
                    Jitter: {speedtestData?.ping.jitter.toFixed(2)} ms
                  </small>
                </div>
              </div>
            </CardContent>
          </Card>

          {speedtestData?.result.url && (
            <div className="md:col-span-2 text-center mt-4">
              <a
                href={speedtestData.result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center text-blue-600 hover:underline"
              >
                <Link className="mr-2" /> View Full Result Online
              </a>
            </div>
          )}
        </div>
      );
    }

    // Previous download/upload view
    if (!currentType) return null;

    if (!speedtestData) return null;
    const data = speedtestData[currentType];
    const isDownload = currentType === "download";

    return (
      <Card className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-4 p-6 w-full items-center">
        <Card className="p-2 max-w-sm mx-auto">
          <div className="grid gap-1.5">
          <h1 className="lg:text-4rem text-3rem font-semibold text-center">
          {formatSpeed(data.bandwidth)}
          </h1>
          <CardDescription className="text-center">
            {isDownload ? "Download" : "Upload"} Speed
          </CardDescription>
          </div>
        </Card>

        <div className="grid grid-rows-3 gap-2">
          <div className="flex items-center">
            <Zap className="mr-2 text-yellow-600" />
            <span>Bytes Transferred: {formatBytes(data.bytes)}</span>
          </div>
          <div className="flex items-center">
            <Gauge className="mr-2 text-purple-600" />
            <span>Elapsed Time: {(data.elapsed / 1000).toFixed(2)} sec</span>
          </div>
          <div className="flex items-center">
            <Clock className="mr-2 text-gray-600" />
            <span>
              Latency (IQM): {data.latency?.iqm?.toFixed(2) ?? "N/A"} ms
            </span>
          </div>
        </div>
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
            <div className="lg:max-w-full max-w-sm mx-auto p-6 py-12">
              {renderSpeedtestContent()}
            </div>
          </DrawerContent>
        </Drawer>
        <CardDescription>
          Run a speed test to check your internet connection.
        </CardDescription>
      </CardContent>
    </Card>
  );
};

export default SpeedtestStream;
