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
  // Load cached data and set initial states
  const [memoryData, setMemoryData] = useState<MemoryData>(() => {
    const savedData = localStorage.getItem("memoryData");
    return savedData ? JSON.parse(savedData) : { total: 0, used: 0, available: 0 };
  });

  const [config, setConfig] = useState<MemoryConfig>({
    enabled: true,
    interval: 2,
    running: false,
  });

  const [isLoading, setIsLoading] = useState(() => {
    const savedData = localStorage.getItem("memoryData");
    if (!savedData) return true;
    
    try {
      const parsedData = JSON.parse(savedData);
      // Only show loading if we have no valid cached data
      return !parsedData || parsedData.total === 0;
    } catch {
      return true;
    }
  });

  const [hasData, setHasData] = useState(() => {
    const savedData = localStorage.getItem("memoryData");
    if (!savedData) return false;
    
    try {
      const parsedData = JSON.parse(savedData);
      return parsedData && parsedData.total > 0;
    } catch {
      return false;
    }
  });

  // Fetch memory data
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

      if (!response.ok) return false;

      const result = await response.json();
      if (result.status === "success" && result.data) {
        setMemoryData(result.data);
        setHasData(true);
        
        // Cache the data in localStorage
        localStorage.setItem("memoryData", JSON.stringify(result.data));
        
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to fetch memory data:", err);
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

      if (!response.ok) return null;

      const result = await response.json();
      if (result.status === "success" && result.data) {
        setConfig(result.data);
        return result.data;
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch memory config:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const initialize = async () => {
      // 1. First fetch config to see if memory monitoring is enabled
      const configResult = await fetchMemoryConfig();

      // 2. If we don't have cached data, show loading during initial fetch
      const savedData = localStorage.getItem("memoryData");
      const hasCachedData = savedData && JSON.parse(savedData).total > 0;
      
      if (!hasCachedData) {
        setIsLoading(true);
      }

      // 3. Only try to fetch memory data if it's enabled
      if (configResult?.enabled) {
        // Try to fetch existing data
        await fetchMemoryData();

        // Start polling based on interval from config (convert to milliseconds)
        const pollInterval = Math.max(
          (configResult.interval || 2) * 1000,
          1000
        );
        console.log(
          `Starting memory polling with ${pollInterval}ms interval (${configResult.interval}s from config)`
        );
        intervalId = setInterval(fetchMemoryData, pollInterval);
      }

      // Always set loading to false after config check and initial fetch
      setIsLoading(false);
    };

    initialize();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchMemoryConfig, fetchMemoryData]); // Only depend on the callback functions

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Memory</CardTitle>
        {config.enabled && config.running ? (
          <MonitorCheckIcon className="h-4 w-4 text-green-500" />
        ) : (
          <MonitorOffIcon className="h-4 w-4 text-red-500" />
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[120px] w-full" />
        ) : !config.enabled ? (
          <div className="h-[60px] flex flex-col items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Memory monitoring is disabled.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Enable it in Settings → Personalization
            </p>
          </div>
        ) : !hasData ? (
          <div className="h-[120px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Starting memory monitoring...
            </p>
          </div>
        ) : (
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
