import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleArrowDownIcon, MonitorCheckIcon, MonitorXIcon } from "lucide-react";
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
const BandwidthMonitorCard = ({ websocketData: propWebsocketData }: BandwidthMonitorCardProps) => {
  // Use prop if provided, otherwise fall back to context
  const contextWebsocketData = useWebSocketData();
  const websocketData = propWebsocketData || contextWebsocketData;
  
  // State for enabled/disabled - only checked on initial mount
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [hasCheckedInitial, setHasCheckedInitial] = useState<boolean>(false);
  
  // Track history for websocketData prop
  const [propHistory, setPropHistory] = useState<Array<{ upload: number; download: number; timestamp: number }>>([]);
  
  // Check enabled status only on initial mount
  useEffect(() => {
    const checkBandwidthEnabled = async () => {
      try {
        const response = await fetch("/cgi-bin/quecmanager/settings/bandwidth_settings.sh");
        const data = await response.json();
        if (data.status === "success" && data.data) {
          setIsEnabled(data.data.enabled);
        }
      } catch (error) {
        console.error("Error checking bandwidth settings:", error);
        // Default to enabled on error
        setIsEnabled(true);
      } finally {
        setHasCheckedInitial(true);
      }
    };

    checkBandwidthEnabled();
  }, []);

  // Listen for settings changes from personalization page (no API call needed)
  useEffect(() => {
    const handleSettingsUpdate = async () => {
      // Re-fetch the setting when user changes it in personalization
      try {
        const response = await fetch("/cgi-bin/quecmanager/settings/bandwidth_settings.sh");
        const data = await response.json();
        if (data.status === "success" && data.data) {
          setIsEnabled(data.data.enabled);
        }
      } catch (error) {
        console.error("Error refreshing bandwidth settings:", error);
      }
    };

    window.addEventListener("bandwidthSettingsUpdated", handleSettingsUpdate);
    return () => {
      window.removeEventListener("bandwidthSettingsUpdated", handleSettingsUpdate);
    };
  }, []);

  // Update history when websocketData changes
  useEffect(() => {
    if (!isEnabled) return; // Don't process data if disabled
    
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
  }, [websocketData, isEnabled]);

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

  // If still checking enabled status on initial mount, show loading
  if (!hasCheckedInitial) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Live Bandwidth</CardTitle>
          <MonitorCheckIcon className="h-4 w-4 text-gray-400" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3 mt-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // If disabled, show disabled state
  if (!isEnabled) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Link href="/dashboard/settings/personalization">
            <CardTitle>Live Bandwidth</CardTitle>
          </Link>
          <MonitorXIcon className="h-4 w-4 text-gray-400" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="text-sm text-muted-foreground">Disabled</div>
            <div className="text-xs text-muted-foreground mt-1 text-center">
              Enable in Settings → Personalization
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine which data source to use
  let hasData = false;
  let averages = null;
  let currentData = { upload: 0, download: 0 };

  if (websocketData?.channel === 'network-monitor') {
    // Calculate all interfaces that are consuming data not including the IPA Packet Accelerator as data originating on modem is double counted
    const activeInts = websocketData?.interfaces.filter((x: any) => x.state.toLowerCase() === 'up' && !x.name.includes('rmnet_ipa'));
    const uploadData = activeInts.map((x: any) => x.tx.bps).reduce((a: any, b: any) => a + b, 0);
    const downloadData = activeInts.map((x: any) => x.rx.bps).reduce((a: any, b: any) => a + b, 0);
    currentData = { upload: uploadData, download: downloadData };
    averages = calculateAverages();
    hasData = true;
  } else if (propHistory.length > 0) {
    // Use last known data from history if websocket is on a different channel
    const lastEntry = propHistory[propHistory.length - 1];
    currentData = { upload: lastEntry.upload, download: lastEntry.download };
    averages = calculateAverages();
    hasData = true;
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
        {hasData ? (
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
