import React from 'react';
import { useBandwidthMonitor } from '@/hooks/use-bandwidth-monitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

/**
 * Compact bandwidth monitor card for the home dashboard.
 * Shows current speeds and 30-second averages in a card format.
 */
const BandwidthMonitorCard: React.FC = () => {
    const { historyData, isConnected, error, reconnect, formatSpeed } = useBandwidthMonitor();

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle className="text-sm font-medium">Bandwidth Monitor</CardTitle>
                    <CardDescription>Real-time network speeds</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    {isConnected ? (
                        <Wifi className="w-4 h-4 text-green-600" />
                    ) : (
                        <WifiOff className="w-4 h-4 text-red-600" />
                    )}
                    {!isConnected && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={reconnect}
                            className="h-6 px-2"
                        >
                            <RefreshCw className="w-3 h-3" />
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {error && (
                    <div className="text-xs text-red-600 mb-2 p-2 bg-red-50 rounded border">
                        {error}
                    </div>
                )}

                {historyData ? (
                    <div className="space-y-3">
                        {/* Current Speeds */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="text-center">
                                <div className="text-xs text-muted-foreground">Download</div>
                                <div className="text-lg font-semibold text-blue-600">
                                    {formatSpeed(historyData.current.download)}
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-muted-foreground">Upload</div>
                                <div className="text-lg font-semibold text-green-600">
                                    {formatSpeed(historyData.current.upload)}
                                </div>
                            </div>
                        </div>

                        {/* Averages */}
                        {historyData.history.length >= 5 && (
                            <>
                                <div className="border-t pt-2">
                                    <div className="text-xs text-muted-foreground mb-1">30s Averages</div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="text-center">
                                            <div className="font-medium text-blue-500">
                                                {formatSpeed(historyData.averageDownloadSpeed)}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="font-medium text-green-500">
                                                {formatSpeed(historyData.averageUploadSpeed)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Peak Speeds */}
                                <div className="border-t pt-2">
                                    <div className="text-xs text-muted-foreground mb-1">Peak (30s)</div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="text-center">
                                            <div className="font-medium text-red-500">
                                                {formatSpeed(historyData.maxDownloadSpeed)}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="font-medium text-orange-500">
                                                {formatSpeed(historyData.maxUploadSpeed)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Data points indicator */}
                        <div className="text-xs text-muted-foreground text-center">
                            {historyData.history.length}/30 data points
                            {historyData.history.length < 5 && (
                                <div className="text-yellow-600">Collecting initial data...</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <div className="text-xs text-muted-foreground">
                            {isConnected ? 'Waiting for data...' : 'Not connected'}
                        </div>
                        {!isConnected && (
                            <div className="text-xs text-red-600 mt-1">
                                Check WebSocket server at ws://192.168.224.1:8838/bandwidth-monitor
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default BandwidthMonitorCard;