import React from "react";
import { useBandwidthMonitor } from "@/hooks/use-bandwidth-monitor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleArrowDownIcon, MonitorCheckIcon, MonitorOffIcon } from "lucide-react";

/**
 * Compact bandwidth monitor card that fits in the small cards grid section.
 * Shows current speeds in a minimal format similar to other small cards.
 */
const BandwidthMonitorCard = () => {
  const { historyData, isConnected, error, formatSpeed } =
    useBandwidthMonitor();

  const hasData = historyData && isConnected;
  const isLoading = !hasData && isConnected;
  // console.log("historyData:", historyData);
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Live Bandwidth</CardTitle>
        {error ? (
          <MonitorOffIcon className="h-4 w-4 text-red-500" />
        ) : (
          <MonitorCheckIcon
            className={`h-4 w-4 ${
              isConnected ? "text-green-500" : "text-gray-400"
            }`}
          />
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-xs text-red-600 mb-2">Connection error</div>
        )}

        {isLoading ? (
          <div className="space-y-3 mt-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : hasData ? (
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <CircleArrowDownIcon className="h-4 w-4 text-green-600" />
                <p className="text-md font-bold">
                  {formatSpeed(historyData.current.download)}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatSpeed(historyData.averageDownloadSpeed)} avg
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <CircleArrowDownIcon className="h-4 w-4 rotate-180 text-purple-600" />
                <p className="text-md font-bold">
                  {formatSpeed(historyData.current.upload)}
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                {formatSpeed(historyData.averageUploadSpeed)} avg
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="text-sm text-muted-foreground">
              {isConnected ? "Waiting..." : "Disconnected"}
            </div>
            {!isConnected && (
              <div className="text-xs text-red-600 mt-1 text-center">
                WebSocket offline
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BandwidthMonitorCard;
