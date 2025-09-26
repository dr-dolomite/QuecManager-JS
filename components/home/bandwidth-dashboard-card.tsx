import React from 'react';
import { useBandwidthMonitor } from '@/hooks/use-bandwidth-monitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Wifi, WifiOff, TrendingUp, TrendingDown, Activity } from 'lucide-react';

/**
 * Comprehensive bandwidth monitor dashboard card.
 * Shows detailed bandwidth statistics and historical data visualization.
 * This card takes up more space but provides complete bandwidth insights.
 */
const BandwidthDashboardCard: React.FC = () => {
    const { historyData, isConnected, error, connectionStatus, reconnect, formatSpeed } = useBandwidthMonitor();

    const hasData = historyData && isConnected;
    const isLoading = !hasData && isConnected && !error;

    // Simple sparkline data (last 10 points for mini chart)
    const getSparklineData = (type: 'download' | 'upload') => {
        if (!historyData || historyData.history.length < 2) return [];
        const data = historyData.history.slice(-10);
        return data.map(point => type === 'download' ? point.download : point.upload);
    };

    const downloadSparkline = getSparklineData('download');
    const uploadSparkline = getSparklineData('upload');

    const getConnectionStatusColor = () => {
        if (error) return 'destructive';
        if (!isConnected) return 'secondary';
        return 'success';
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-lg">Network Bandwidth Monitor</CardTitle>
                        <CardDescription>Real-time speed tracking with 30-second history</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={getConnectionStatusColor() as any} className="text-xs">
                            {isConnected ? (
                                <>
                                    <Wifi className="w-3 h-3 mr-1" />
                                    Connected
                                </>
                            ) : (
                                <>
                                    <WifiOff className="w-3 h-3 mr-1" />
                                    Offline
                                </>
                            )}
                        </Badge>
                        {!isConnected && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={reconnect}
                                className="h-8 px-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2">
                            <WifiOff className="w-4 h-4 text-red-500" />
                            <span className="text-sm font-medium text-red-800">Connection Error</span>
                        </div>
                        <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                )}

                {isLoading ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        </div>
                        <Skeleton className="h-20 w-full" />
                    </div>
                ) : hasData ? (
                    <>
                        {/* Current Speeds */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm font-medium text-blue-700">Download</span>
                                </div>
                                <div className="text-3xl font-bold text-blue-600">
                                    {formatSpeed(historyData.current.download)}
                                </div>
                                {downloadSparkline.length > 1 && (
                                    <div className="flex items-end gap-0.5 h-8">
                                        {downloadSparkline.map((speed, i) => {
                                            const maxSpeed = Math.max(...downloadSparkline);
                                            const height = maxSpeed > 0 ? (speed / maxSpeed) * 100 : 0;
                                            return (
                                                <div
                                                    key={i}
                                                    className="bg-blue-500 w-2 rounded-t-sm"
                                                    style={{ height: `${Math.max(height, 2)}%` }}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                    <span className="text-sm font-medium text-green-700">Upload</span>
                                </div>
                                <div className="text-3xl font-bold text-green-600">
                                    {formatSpeed(historyData.current.upload)}
                                </div>
                                {uploadSparkline.length > 1 && (
                                    <div className="flex items-end gap-0.5 h-8">
                                        {uploadSparkline.map((speed, i) => {
                                            const maxSpeed = Math.max(...uploadSparkline);
                                            const height = maxSpeed > 0 ? (speed / maxSpeed) * 100 : 0;
                                            return (
                                                <div
                                                    key={i}
                                                    className="bg-green-500 w-2 rounded-t-sm"
                                                    style={{ height: `${Math.max(height, 2)}%` }}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Statistics */}
                        {historyData.history.length >= 5 && (
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-blue-700">Download Stats (30s)</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">Average:</span>
                                            <span className="text-sm font-medium text-blue-600">
                                                {formatSpeed(historyData.averageDownloadSpeed)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">Peak:</span>
                                            <span className="text-sm font-medium text-red-600">
                                                {formatSpeed(historyData.maxDownloadSpeed)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-green-700">Upload Stats (30s)</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">Average:</span>
                                            <span className="text-sm font-medium text-green-600">
                                                {formatSpeed(historyData.averageUploadSpeed)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">Peak:</span>
                                            <span className="text-sm font-medium text-orange-600">
                                                {formatSpeed(historyData.maxUploadSpeed)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Status Footer */}
                        <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Activity className="w-3 h-3" />
                                <span>Data points: {historyData.history.length}/30</span>
                            </div>
                            <div>
                                Last update: {new Date(historyData.current.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                        <WifiOff className="w-12 h-12 text-gray-400 mb-4" />
                        <div className="text-center">
                            <div className="text-lg font-medium text-muted-foreground mb-2">
                                {connectionStatus}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Connecting to ws://192.168.224.1:8838/bandwidth-monitor
                            </div>
                            {!isConnected && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={reconnect}
                                    className="mt-3"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Retry Connection
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default BandwidthDashboardCard;