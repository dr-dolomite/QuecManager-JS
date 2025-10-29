import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleArrowDownIcon, MonitorCheckIcon } from "lucide-react";
import Link from "next/link";
import { useWebSocketData } from "@/components/hoc/protected-route";

interface WebSocketData {
  type: string;
  channel?: string;
  data: {
    timestamp: string;
    upload: number;
    download: number;
  };
}

interface BandwidthMonitorCardProps {
  websocketData?: WebSocketData;
}

/**
 * Compact bandwidth monitor card that fits in the small cards grid section.
 * Shows current speeds in a minimal format similar to other small cards.
 * Receives real-time data via websocketData prop from the layout.
 */
  let hasData = false;
  let isLoading = true;
  let averages = null;
  let currentData = { upload: 0, download: 0 };
const BandwidthMonitorCard = ({ websocketData: propWebsocketData }: BandwidthMonitorCardProps) => {
  // Use prop if provided, otherwise fall back to context
  const contextWebsocketData = useWebSocketData();
  const websocketData = propWebsocketData || contextWebsocketData;
  // Track history for websocketData prop
  const [propHistory, setPropHistory] = useState<Array<{ upload: number; download: number; timestamp: number }>>([]);
  
  // Update history when websocketData changes
  useEffect(() => {
    if (websocketData?.channel === 'network-monitor') {
      const activeInts = websocketData.interfaces.filter((x: any) => x.state.toLowerCase() === 'up' && x.name !== 'rmnet_ipa0');
      const uploadSum = activeInts.map((x: any) => x.tx.bps).reduce((a: any, b: any) => a + b, 0);
      const downloadSum = activeInts.map((x: any) => x.rx.bps).reduce((a: any, b: any) => a + b, 0);
      const newDataPoint = {
        upload: uploadSum,
        download: downloadSum,
        timestamp: Date.now(),
      };

      setPropHistory(prev => {
        const updated = [...prev, newDataPoint];
        // Keep only last 30 seconds of data
        const thirtySecondsAgo = Date.now() - 30000;
        return updated.filter(point => point.timestamp > thirtySecondsAgo);
      });
    }
  }, [websocketData]);

  // Calculate averages from prop history
  const calculateAverages = () => {
    if (propHistory.length === 0) return { avgUpload: 0, avgDownload: 0 };
    const totalUpload = propHistory.reduce((sum, point) => sum + point.upload, 0);
    const totalDownload = propHistory.reduce((sum, point) => sum + point.download, 0);
    return {
      avgUpload: totalUpload / propHistory.length,
      avgDownload: totalDownload / propHistory.length,
    };
  };


  // Format speed from bytes/sec to human-readable format
  const formatSpeed = (bitsPerSecond: number): string => {

    if (bitsPerSecond === 0) return '0 bps';

    const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    const k = 1000;
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
    const value = bitsPerSecond / Math.pow(k, i);

    return `${value.toFixed(2)} ${units[i]}`;
  };
  // Determine which data source to use
  if (websocketData?.channel === 'network-monitor') {
    const useWebSocketProp = websocketData?.channel === 'network-monitor';
    // Calculate all interfaces that are consuming data not including the IPA Packet Accelerator as data originating on modem is double counted
    const activeInts = websocketData?.interfaces.filter((x: any) => x.state.toLowerCase() === 'up' && !x.name.includes('rmnet_ipa'));
    const uploadData = activeInts.map((x: any) => x.tx.bps).reduce((a: any, b: any) => a + b, 0);
    const downloadData = activeInts.map((x: any) => x.rx.bps).reduce((a: any, b: any) => a + b, 0);
    // currentData = websocketData;
    currentData = { upload: uploadData, download: downloadData };
    averages = useWebSocketProp ? calculateAverages() : null;
    hasData = !!currentData;
    isLoading = !hasData && !!websocketData;

    // console.log("currentData:", currentData);
  }
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Link href="/experimental/internet-quality">
          <CardTitle>Live Bandwidth</CardTitle>
        </Link>
        <MonitorCheckIcon
          className={`h-4 w-4 ${
            hasData ? "text-green-500" : "text-gray-400"
          }`}
        />
      </CardHeader>
      <CardContent>

        {isLoading ? (
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-36" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
        ) : hasData ? (
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <CircleArrowDownIcon className="h-4 w-4 text-green-600" />
                <p className="text-md font-bold">
                  {formatSpeed(currentData!.download)}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatSpeed(averages!.avgDownload)} avg
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <CircleArrowDownIcon className="h-4 w-4 rotate-180 text-purple-600" />
                <p className="text-md font-bold">
                  {formatSpeed(currentData!.upload)}
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                {formatSpeed(averages!.avgUpload)} avg
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="text-sm text-muted-foreground">
              {websocketData ? "Waiting..." : "Disconnected"}
            </div>
            {!websocketData && (
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
