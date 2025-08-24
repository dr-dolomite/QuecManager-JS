import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MonitorCheckIcon, MonitorOffIcon } from "lucide-react";

interface MemoryData {
  total: number;
  used: number;
  available: number;
}

interface MemoryConfig {
  enabled: boolean;
  interval: number;
  running: boolean;
}

const formatMemory = (bytes: number) => {
  const megabytes = bytes / (1024 * 1024);
  return `${Math.round(megabytes)} MB`;
};

const MemoryCard = () => {
  const [memoryData, setMemoryData] = useState<MemoryData>({
    total: 0,
    used: 0,
    available: 0,
  });
  const [config, setConfig] = useState<MemoryConfig>({
    enabled: false,
    interval: 1,
    running: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  // Fetch memory data (optimistic)
  const fetchMemoryData = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/memory/fetch_memory.sh",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        return false;
      }

      const result = await response.json();

      if (result.status === "success" && result.data) {
        setMemoryData(result.data);
        setHasData(true);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error("Failed to fetch memory information:", err);
      return false;
    }
  }, []);

  // Fetch memory configuration
  const fetchMemoryConfig = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/home/memory/memory_service.sh",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch memory configuration");
      }
      const result = await response.json();
      if (result.status === "success" && result.data) {
        setConfig(result.data);
        return result.data;
      }
      throw new Error("Invalid configuration response");
    } catch (err) {
      console.error("Failed to fetch memory configuration:", err);
      return null;
    }
  }, []);

  // Enable memory monitoring

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const initialize = async () => {
      // 1. Always fetch memory data first (optimistic)
      // Add a 500ms buffer
      await fetchMemoryData();
      setIsLoading(false);

      // Log
      console.log("Memory data fetched:", memoryData);

      // 2. Then fetch config to determine if we should start polling
      const configResult = await fetchMemoryConfig();

      // Log
      console.log("Memory config fetched:", configResult);

      // 3. Only start polling if config says enabled
      if (configResult?.enabled && hasData) {
        const pollInterval = Math.max((configResult.interval || 2) * 1000, 1000);
        intervalId = setInterval(fetchMemoryData, pollInterval);

        // Log
        console.log("Memory polling started:", pollInterval);
      }
    };

    const handleSettingsUpdate = async () => {
      // Clear existing interval
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      
      // Re-fetch config and restart polling if needed
      const configResult = await fetchMemoryConfig();
      if (configResult?.enabled && hasData) {
        const pollInterval = Math.max((configResult.interval || 2) * 1000, 1000);
        intervalId = setInterval(fetchMemoryData, pollInterval);
      }
    };

    initialize();

    // Listen for settings updates from personalization page
    window.addEventListener("memorySettingsUpdated", handleSettingsUpdate);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener("memorySettingsUpdated", handleSettingsUpdate);
    };
  }, [fetchMemoryData, fetchMemoryConfig, hasData]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Memory</CardTitle>
        {config.enabled && config.running && hasData ? (
          <MonitorCheckIcon className="h-4 w-4 text-green-500" />
        ) : (
          <MonitorOffIcon className="h-4 w-4 text-red-500" />
        )}
      </CardHeader>
      <CardContent>
        {isLoading && !hasData ? (
          // Only show loading state if we don't have any data yet
          <div className="grid lg:grid-cols-3 grid-cols-2 grid-flow-row gap-4 col-span-3">
            <div className="grid gap-1">
              <span className="text-sm text-muted-foreground">Total</span>
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="grid gap-1">
              <span className="text-sm text-muted-foreground">Used</span>
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="grid gap-1">
              <span className="text-sm text-muted-foreground">Available</span>
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ) : (
          // Show data (either fresh or stale, but we have something to show)
          <div className="grid lg:grid-cols-3 grid-cols-2 grid-flow-row gap-4 col-span-3">
            <div className="grid gap-1">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-base font-bold">
                {formatMemory(memoryData.total)}
              </span>
            </div>
            <div className="grid gap-1">
              <span className="text-sm text-muted-foreground">Used</span>
              <span className="text-base font-bold">
                {formatMemory(memoryData.used)}
              </span>
            </div>
            <div className="grid gap-1">
              <span className="text-sm text-muted-foreground">Available</span>
              <span className="text-base font-bold">
                {formatMemory(memoryData.available)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MemoryCard;
