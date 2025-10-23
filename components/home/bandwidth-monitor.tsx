import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BandwidthData, WebSocketBandwidthMessage } from '@/types/types';

interface UseBandwidthMonitorReturn {
    bandwidthData: BandwidthData | null;
    isConnected: boolean;
    error: string | null;
    connectionStatus: string;
    reconnect: () => void;
}

const useBandwidthMonitor = (): UseBandwidthMonitorReturn => {
    const [bandwidthData, setBandwidthData] = useState<BandwidthData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const maxReconnectAttempts = 5;
    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    const formatBytes = useCallback((bytes: number): string => {
        if (bytes === 0) return "0 B/s";
        const k = 1024;
        const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }, []);

    const connect = useCallback(() => {
        try {
            if (ws.current?.readyState === WebSocket.OPEN) {
                return;
            }

            setConnectionStatus('Connecting...');
            setError(null);

            ws.current = new WebSocket('ws://192.168.224.1:8838/bandwidth-monitor');

            ws.current.onopen = () => {
                console.log('Bandwidth monitor WebSocket connected');
                setIsConnected(true);
                setConnectionStatus('Connected');
                setReconnectAttempts(0);
                setError(null);
            };

            ws.current.onmessage = (event: MessageEvent) => {
                try {
                    const message: WebSocketBandwidthMessage = JSON.parse(event.data);

                    switch (message.type) {
                        case 'bandwidth':
                            if (typeof message.data === 'object') {
                                setBandwidthData(message.data as BandwidthData);
                            }
                            break;
                        case 'error':
                            setError(typeof message.data === 'string' ? message.data : 'Unknown error');
                            break;
                        case 'status':
                            setConnectionStatus(typeof message.data === 'string' ? message.data : 'Status update');
                            break;
                    }
                } catch (parseError) {
                    console.error('Failed to parse WebSocket message:', parseError);
                    setError('Failed to parse server message');
                }
            };

            ws.current.onerror = (error: Event) => {
                console.error('Bandwidth monitor WebSocket error:', error);
                setError('Connection error occurred');
                setConnectionStatus('Error');
            };

            ws.current.onclose = (event: CloseEvent) => {
                console.log('Bandwidth monitor WebSocket disconnected:', event.code, event.reason);
                setIsConnected(false);
                setConnectionStatus('Disconnected');

                // Auto-reconnect logic
                if (reconnectAttempts < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
                    setConnectionStatus(`Reconnecting in ${delay / 1000}s...`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        setReconnectAttempts((prev: number) => prev + 1);
                        connect();
                    }, delay);
                } else {
                    setError('Max reconnection attempts reached. Please reconnect manually.');
                    setConnectionStatus('Failed');
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            setError('Failed to establish connection');
            setConnectionStatus('Failed');
        }
    }, [reconnectAttempts, maxReconnectAttempts]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        setIsConnected(false);
        setConnectionStatus('Disconnected');
        setReconnectAttempts(0);
    }, []);

    const reconnect = useCallback(() => {
        disconnect();
        setTimeout(() => {
            setReconnectAttempts(0);
            connect();
        }, 1000);
    }, [connect, disconnect]);

    useEffect(() => {
        connect();

        return () => {
            disconnect();
        };
    }, [connect, disconnect]);

    return {
        bandwidthData,
        isConnected,
        error,
        connectionStatus,
        reconnect,
    };
};

// Component for displaying bandwidth monitor data
interface BandwidthMonitorProps {
    className?: string;
}

const BandwidthMonitor: React.FC<BandwidthMonitorProps> = ({ className = '' }) => {
    const { bandwidthData, isConnected, error, connectionStatus, reconnect } = useBandwidthMonitor();

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const formatSpeed = (bytesPerSecond: number): string => {
        if (bytesPerSecond === 0) return "0 B/s";
        const k = 1024;
        const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
        const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
        return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    return (
        <div className={`bandwidth-monitor ${className}`}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Bandwidth Monitor</h2>
                <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className="text-sm text-gray-600">{connectionStatus}</span>
                    {!isConnected && (
                        <button
                            onClick={reconnect}
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Reconnect
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {bandwidthData ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-blue-800">Download Speed</h3>
                        <p className="text-2xl font-bold text-blue-600">{formatSpeed(bandwidthData.download)}</p>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-green-800">Upload Speed</h3>
                        <p className="text-2xl font-bold text-green-600">{formatSpeed(bandwidthData.upload)}</p>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-purple-800">Total Downloaded</h3>
                        <p className="text-lg font-bold text-purple-600">{formatBytes(bandwidthData.totalDownload)}</p>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-orange-800">Total Uploaded</h3>
                        <p className="text-lg font-bold text-orange-600">{formatBytes(bandwidthData.totalUpload)}</p>
                    </div>

                    {bandwidthData.latency && (
                        <div className="bg-yellow-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-yellow-800">Latency</h3>
                            <p className="text-lg font-bold text-yellow-600">{bandwidthData.latency} ms</p>
                        </div>
                    )}

                    {bandwidthData.signalStrength && (
                        <div className="bg-indigo-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-indigo-800">Signal Strength</h3>
                            <p className="text-lg font-bold text-indigo-600">{bandwidthData.signalStrength} dBm</p>
                        </div>
                    )}

                    <div className="bg-gray-50 p-4 rounded-lg col-span-2 md:col-span-4">
                        <h3 className="text-sm font-medium text-gray-800">Last Update</h3>
                        <p className="text-sm text-gray-600">{new Date(bandwidthData.timestamp).toLocaleString()}</p>
                    </div>
                </div>
            ) : (
                <div className="text-center py-8">
                    <p className="text-gray-500">
                        {isConnected ? 'Waiting for bandwidth data...' : 'Not connected to bandwidth monitor'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default BandwidthMonitor;
export { useBandwidthMonitor };