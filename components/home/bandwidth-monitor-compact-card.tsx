import React from 'react';
import { useBandwidthMonitor } from '@/hooks/use-bandwidth-monitor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, AlertCircle } from 'lucide-react';

/**
 * Compact bandwidth monitor card that fits in the small cards grid section.
 * Shows current speeds in a minimal format similar to other small cards.
 */
const BandwidthMonitorCompactCard: React.FC = () => {
    const { historyData, isConnected, error, formatSpeed } = useBandwidthMonitor();

    const hasData = historyData && isConnected;
    const isLoading = !hasData && isConnected;
    console.log('historyData:', historyData);
    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bandwidth</CardTitle>
                {error ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                    <Activity className={`h-4 w-4 ${isConnected ? 'text-green-500' : 'text-gray-400'}`} />
                )}
            </CardHeader>
            <CardContent>
                {error && (
                    <div className="text-xs text-red-600 mb-2">
                        Connection error
                    </div>
                )}

                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                    </div>
                ) : hasData ? (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <div className="text-2xl font-bold text-blue-600">
                                {formatSpeed(historyData.current.download)}
                            </div>
                            <div className="text-xs text-muted-foreground">↓ Down</div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="text-2xl font-bold text-green-600">
                                {formatSpeed(historyData.current.upload)}
                            </div>
                            <div className="text-xs text-muted-foreground">↑ Up</div>
                        </div>

                        {/* Show averages if we have enough data */}
                        {historyData.history.length >= 5 && (
                            <div className="pt-2 border-t">
                                <div className="text-xs text-muted-foreground mb-1">30s avg</div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-blue-500">
                                        {formatSpeed(historyData.averageDownloadSpeed)}
                                    </span>
                                    <span className="text-green-500">
                                        {formatSpeed(historyData.averageUploadSpeed)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="text-xs text-muted-foreground text-center pt-1">
                            {historyData.history.length}/30 points
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className="text-sm text-muted-foreground">
                            {isConnected ? 'Waiting...' : 'Disconnected'}
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

export default BandwidthMonitorCompactCard;