"use client";

import React, { useState, useCallback, useEffect } from "react";
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
import { useRealtimeSpeed, SpeedData, WebSocketStatus } from "@/hooks/use-realtime-speed";

import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Wifi,
  WifiOff,
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Monitor,
  Server,
} from "lucide-react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface HistoryPoint {
  timestamp: number;
  download: number;
  upload: number;
  time: string;
}

const formatSpeed = (kbps: number): string => {
  if (kbps >= 1024) {
    return `${(kbps / 1024).toFixed(2)} Mbps`;
  }
  return `${kbps.toFixed(0)} Kbps`;
};

const formatSpeedShort = (kbps: number): string => {
  if (kbps >= 1024) {
    const mbps = kbps / 1024;
    return mbps >= 10 ? `${mbps.toFixed(1)}M` : `${mbps.toFixed(2)}M`;
  }
  return `${kbps.toFixed(0)}K`;
};

const RealtimeSpeedMonitor = () => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [speedHistory, setSpeedHistory] = useState<HistoryPoint[]>([]);
  const [isMonitorActive, setIsMonitorActive] = useState(false);
  const [maxDownload, setMaxDownload] = useState(0);
  const [maxUpload, setMaxUpload] = useState(0);
  
  const {
    speedData,
    status,
    connect,
    disconnect,
    reconnect,
    isConnected,
    isConnecting,
    hasError,
    error,
  } = useRealtimeSpeed({
    websocketUrl: 'ws://127.0.0.1:8080',
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectInterval: 3000,
    onConnect: () => {
      console.log('WebSocket connected');
      setIsMonitorActive(true);
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
    },
    onError: (error) => {
      toast({
        title: "Connection Error",
        description: error,
        variant: "destructive",
      });
    },
    onData: (data: SpeedData) => {
      // Update history (keep last 60 points - 1 minute of data)
      setSpeedHistory(prev => {
        const newPoint: HistoryPoint = {
          timestamp: data.timestamp,
          download: data.download_kbps,
          upload: data.upload_kbps,
          time: new Date(data.timestamp * 1000).toLocaleTimeString(),
        };
        
        const updated = [...prev, newPoint].slice(-60);
        return updated;
      });
      
      // Update max values
      setMaxDownload(prev => Math.max(prev, data.download_kbps));
      setMaxUpload(prev => Math.max(prev, data.upload_kbps));
    },
  });

  // Function to start monitoring
  const startMonitoring = useCallback(async () => {
    try {
      // First, start the WebSocket monitoring service via CGI
      const response = await fetch('/cgi-bin/quecmanager/experimental/speed_monitor_control.sh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' })
      });

      if (!response.ok) {
        throw new Error('Failed to start monitoring service');
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Clear history when starting fresh
      setSpeedHistory([]);
      setMaxDownload(0);
      setMaxUpload(0);
      
      // Connect to WebSocket
      connect();
      setIsDialogOpen(true);
      
      toast({
        title: "Monitor Started",
        description: "Real-time speed monitoring is now active",
      });

    } catch (error) {
      console.error('Error starting monitoring:', error);
      toast({
        title: "Start Failed",
        description: error instanceof Error ? error.message : "Failed to start monitoring",
        variant: "destructive",
      });
    }
  }, [connect, toast]);

  // Function to stop monitoring
  const stopMonitoring = useCallback(async () => {
    try {
      // Stop the WebSocket connection first
      disconnect();
      setIsMonitorActive(false);

      // Stop the monitoring service via CGI
      const response = await fetch('/cgi-bin/quecmanager/experimental/speed_monitor_control.sh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'stop' })
      });

      if (response.ok) {
        toast({
          title: "Monitor Stopped",
          description: "Real-time speed monitoring has been stopped",
        });
      }

    } catch (error) {
      console.error('Error stopping monitoring:', error);
      toast({
        title: "Stop Failed",
        description: "Failed to stop monitoring service",
        variant: "destructive",
      });
    }
  }, [disconnect, toast]);

  // Function to restart monitoring
  const restartMonitoring = useCallback(async () => {
    await stopMonitoring();
    setTimeout(() => {
      startMonitoring();
    }, 1000);
  }, [stopMonitoring, startMonitoring]);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm text-green-600">
            <ArrowDownCircle className="inline w-3 h-3 mr-1" />
            Download: {formatSpeed(payload[0]?.value || 0)}
          </p>
          <p className="text-sm text-violet-600">
            <ArrowUpCircle className="inline w-3 h-3 mr-1" />
            Upload: {formatSpeed(payload[1]?.value || 0)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderConnectionStatus = () => {
    if (isConnecting) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Activity className="w-3 h-3 mr-1 animate-pulse" />
          Connecting
        </Badge>
      );
    }
    
    if (isConnected && isMonitorActive) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Wifi className="w-3 h-3 mr-1" />
          Live
        </Badge>
      );
    }
    
    if (hasError) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
        <WifiOff className="w-3 h-3 mr-1" />
        Disconnected
      </Badge>
    );
  };

  const renderMainContent = () => {
    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <AlertCircle className="text-red-500 w-16 h-16" />
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">Connection Error</h3>
            <p className="text-sm text-gray-600">{error}</p>
            <p className="text-xs text-gray-500">
              Make sure the monitoring service is running on your device
            </p>
          </div>
          <div className="flex space-x-2">
            <Button onClick={restartMonitoring} variant="outline" size="sm">
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry Connection
            </Button>
          </div>
        </div>
      );
    }

    if (!isConnected || !speedData) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <div className="relative">
            <Monitor className="text-primary w-16 h-16" />
            {isConnecting && (
              <div className="absolute -inset-2 bg-primary/10 rounded-full animate-ping"></div>
            )}
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">
              {isConnecting ? "Connecting..." : "Start Real-time Monitoring"}
            </h3>
            <p className="text-sm text-gray-600">
              {isConnecting 
                ? "Establishing connection to speed monitor..."
                : "Monitor your internet speed in real-time"
              }
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Current Speed Display */}
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <ArrowDownCircle className="text-green-600 w-5 h-5" />
              <span className="font-medium text-green-700">Download</span>
            </div>
            <div className="text-3xl font-bold text-green-600 tabular-nums">
              {formatSpeed(speedData.download_kbps)}
            </div>
            <div className="text-sm text-gray-500">
              {speedData.download_mbps.toFixed(2)} Mbps
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <ArrowUpCircle className="text-violet-600 w-5 h-5" />
              <span className="font-medium text-violet-700">Upload</span>
            </div>
            <div className="text-3xl font-bold text-violet-600 tabular-nums">
              {formatSpeed(speedData.upload_kbps)}
            </div>
            <div className="text-sm text-gray-500">
              {speedData.upload_mbps.toFixed(2)} Mbps
            </div>
          </div>
        </div>

        {/* Speed Chart */}
        {speedHistory.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <TrendingUp className="w-5 h-5 mr-2" />
                Speed History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={speedHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatSpeedShort}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="download"
                    stackId="1"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="upload"
                    stackId="2"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="font-medium text-green-700">Max Download</span>
            </div>
            <div className="text-lg font-semibold text-green-600">
              {formatSpeed(maxDownload)}
            </div>
          </div>
          
          <div className="bg-violet-50 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="w-4 h-4 text-violet-600" />
              <span className="font-medium text-violet-700">Max Upload</span>
            </div>
            <div className="text-lg font-semibold text-violet-600">
              {formatSpeed(maxUpload)}
            </div>
          </div>
        </div>

        {/* Interface Info */}
        {speedData.interface && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex items-center space-x-2 mb-2">
              <Server className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-gray-700">Interface</span>
            </div>
            <div className="text-gray-600">
              {speedData.interface} • Last update: {new Date(speedData.timestamp * 1000).toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Real-time Speed Monitor
          </CardTitle>
          {renderConnectionStatus()}
        </div>
        <CardDescription>
          Monitor your internet speed continuously with live updates
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center space-y-4">
        {/* Quick Stats - Always visible */}
        {speedData && (
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-1">
              <ArrowDownCircle className="w-4 h-4 text-green-600" />
              <span>{formatSpeed(speedData.download_kbps)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <ArrowUpCircle className="w-4 h-4 text-violet-600" />
              <span>{formatSpeed(speedData.upload_kbps)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4 text-gray-600" />
              <span>{new Date(speedData.timestamp * 1000).toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        {/* Main Action Button */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={!isConnected ? startMonitoring : undefined}
              className="relative"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <Activity className="w-5 h-5 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : isConnected ? (
                <>
                  <Activity className="w-5 h-5 mr-2 animate-pulse" />
                  View Live Monitor
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Start Monitoring
                </>
              )}
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[900px] max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Real-time Speed Monitor
                </div>
                {renderConnectionStatus()}
              </DialogTitle>
              <DialogDescription>
                Live monitoring of your internet connection speed
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {renderMainContent()}
            </div>
            
            <DialogFooter className="flex justify-between">
              <div className="flex space-x-2">
                {isConnected ? (
                  <Button onClick={stopMonitoring} variant="outline" size="sm">
                    <Pause className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                ) : (
                  <Button onClick={startMonitoring} variant="outline" size="sm">
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </Button>
                )}
                <Button onClick={restartMonitoring} variant="outline" size="sm">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restart
                </Button>
              </div>
              <Button onClick={() => setIsDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default RealtimeSpeedMonitor;