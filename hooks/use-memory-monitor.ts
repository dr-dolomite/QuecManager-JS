/** NOTE THIS FILE IS DEPRECATED DUE TO WEBSOCKET INCORPORATION AND CAN BE DELETED AT CONVENIENCE - IM LEAVING IN PLACE FOR REFERENCE */
/** NOTE THIS FILE IS DEPRECATED DUE TO WEBSOCKET INCORPORATION AND CAN BE DELETED AT CONVENIENCE - IM LEAVING IN PLACE FOR REFERENCE */
/** NOTE THIS FILE IS DEPRECATED DUE TO WEBSOCKET INCORPORATION AND CAN BE DELETED AT CONVENIENCE - IM LEAVING IN PLACE FOR REFERENCE */
/** NOTE THIS FILE IS DEPRECATED DUE TO WEBSOCKET INCORPORATION AND CAN BE DELETED AT CONVENIENCE - IM LEAVING IN PLACE FOR REFERENCE */
/** NOTE THIS FILE IS DEPRECATED DUE TO WEBSOCKET INCORPORATION AND CAN BE DELETED AT CONVENIENCE - IM LEAVING IN PLACE FOR REFERENCE */
import { useState, useEffect, useRef, useCallback } from 'react';

interface MemoryData {
    total: number;
    used: number;
    available: number;
    timestamp: string;
}

interface MemoryHistoryData {
    current: MemoryData;
    history: MemoryData[]; // 5-minute rolling history
    averageUsed: number;
    maxUsed: number;
    minAvailable: number;
}

interface UseMemoryMonitorReturn {
    historyData: MemoryHistoryData | null;
    isConnected: boolean;
    error: string | null;
    connectionStatus: string;
    reconnect: () => void;
    formatMemory: (bytes: number) => string;
}

/**
 * Custom hook for monitoring memory usage via WebSocket connection.
 * 
 * Connects to the websocat server on port 8838 using the current hostname
 * (works with both direct IP access and Tailscale) to receive real-time
 * memory monitoring data and maintains a 5-minute rolling history.
 * 
 * Features:
 * - Real-time memory updates
 * - 5-minute rolling history of memory usage
 * - Calculated averages and extremes over the history period
 * - Error handling and status reporting
 * - Data formatting utilities (KB, MB, GB)
 * - Manual reconnect for stability
 * - Backward compatible with file-based monitoring
 * 
 * @returns Object containing historical memory data, connection status, and utilities
 */
export const useMemoryMonitor = (): UseMemoryMonitorReturn => {
    const [historyData, setHistoryData] = useState<MemoryHistoryData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');
    const ws = useRef<WebSocket | null>(null);
    const heartbeatIntervalRef = useRef<number | null>(null);
    const connectionTimeoutRef = useRef<number | null>(null);
    const historyRef = useRef<MemoryData[]>([]);
    const lastUpdateRef = useRef<number>(0);

    // Keep 5 minutes of history (assuming ~1 data point per second)
    const HISTORY_DURATION_MS = 5 * 60 * 1000;
    const MAX_HISTORY_POINTS = 300; // 5 minutes at 1/sec
    const MIN_UPDATE_INTERVAL_MS = 1000; // Throttle updates to max 1 per second
    const STORED_HISTORY_SIZE = 6; // Store last 6 data points for persistence

    const formatMemory = useCallback((bytes: number): string => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }, []);

    const addDataPoint = useCallback((memoryData: MemoryData) => {
        // Throttle updates to prevent excessive re-renders
        const now = Date.now();
        if (now - lastUpdateRef.current < MIN_UPDATE_INTERVAL_MS) {
            return; // Skip this update if too soon
        }
        lastUpdateRef.current = now;

        const pointTime = new Date(memoryData.timestamp).getTime();
        const cutoff = pointTime - HISTORY_DURATION_MS;

        // Remove old points and add new point
        historyRef.current = [
            ...historyRef.current.filter((point) => new Date(point.timestamp).getTime() > cutoff),
            memoryData
        ];

        // Keep only the most recent MAX_HISTORY_POINTS
        if (historyRef.current.length > MAX_HISTORY_POINTS) {
            historyRef.current = historyRef.current.slice(-MAX_HISTORY_POINTS);
        }

        // Calculate statistics
        const history = historyRef.current;
        const usedValues = history.map((p) => p.used);
        const availableValues = history.map((p) => p.available);

        const averageUsed = usedValues.reduce((a, b) => a + b, 0) / usedValues.length || 0;
        const maxUsed = Math.max(...usedValues) || 0;
        const minAvailable = Math.min(...availableValues) || 0;

        setHistoryData({
            current: memoryData,
            history: [...history],
            averageUsed,
            maxUsed,
            minAvailable
        });

        // Cache last 10 data points in localStorage for persistence
        try {
            const recentHistory = historyRef.current.slice(-STORED_HISTORY_SIZE);
            localStorage.setItem('memoryHistoryData', JSON.stringify(recentHistory));
        } catch (err) {
            console.error('Failed to cache memory history:', err);
        }
    }, [HISTORY_DURATION_MS, MAX_HISTORY_POINTS, MIN_UPDATE_INTERVAL_MS, STORED_HISTORY_SIZE]);

    const connect = useCallback(() => {
        try {
            // Only connect if no existing connection
            if (ws.current) {
                if (ws.current.readyState === WebSocket.CONNECTING) {
                    return;
                }
                if (ws.current.readyState === WebSocket.OPEN) {
                    return;
                }
            }

            setConnectionStatus('Connecting...');
            setError(null);

            // Dynamically get the WebSocket URL based on current window location
            // This works whether accessing via 192.168.224.1 or Tailscale IP
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Use 192.168.224.1 instead of localhost
            const host = window.location.hostname === 'localhost' ? '192.168.224.1' : window.location.hostname;
            const wsUrl = `${protocol}//${host}:8838/old-mems`;

            // Connect to websocat server
            ws.current = new WebSocket(wsUrl);

            // Set connection timeout
            connectionTimeoutRef.current = window.setTimeout(() => {
                if (ws.current?.readyState === WebSocket.CONNECTING) {
                    ws.current.close();
                    setError('Connection timeout');
                    setConnectionStatus('Timeout');
                }
            }, 10000); // 10 second timeout

            ws.current.onopen = () => {
                // Clear connection timeout
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                }

                setIsConnected(true);
                setConnectionStatus('Connected');
                setError(null);

                // Start heartbeat to keep connection alive
                heartbeatIntervalRef.current = window.setInterval(() => {
                    if (ws.current?.readyState === WebSocket.OPEN) {
                        ws.current.send('ping');
                    }
                }, 30000); // Send ping every 30 seconds
            };

            ws.current.onmessage = (event: MessageEvent) => {
                try {
                    const message = event.data;

                    // Skip ping/pong messages
                    if (message === 'ping' || message === 'pong') {
                        return;
                    }

                    // Try to parse as JSON (memory data)
                    try {
                        const data = JSON.parse(message);

                        // Check if it's memory data (has total, used, available fields)
                        if (data.total !== undefined && data.used !== undefined && data.available !== undefined) {
                            const memoryData: MemoryData = {
                                total: data.total,
                                used: data.used,
                                available: data.available,
                                timestamp: data.timestamp || new Date().toISOString()
                            };

                            addDataPoint(memoryData);
                        }
                    } catch (jsonError) {
                        // Not JSON or not memory data, ignore
                    }
                } catch (parseError) {
                    console.error('Failed to process WebSocket message:', parseError);
                }
            };

            ws.current.onerror = (error: Event) => {
                console.error('Memory monitor WebSocket error:', error);
                setError('Connection error occurred');
                setConnectionStatus('Error');
            };

            ws.current.onclose = (event: CloseEvent) => {
                setIsConnected(false);

                // Clear heartbeat
                if (heartbeatIntervalRef.current) {
                    clearInterval(heartbeatIntervalRef.current);
                    heartbeatIntervalRef.current = null;
                }

                // Provide detailed close reasons
                let statusMessage = 'Disconnected';
                let errorMessage: string | null = null;

                switch (event.code) {
                    case 1000:
                        statusMessage = 'Connection closed normally';
                        break;
                    case 1006:
                        statusMessage = 'Connection lost unexpectedly';
                        errorMessage = 'Network connection was lost or websocat server is not running';
                        break;
                    default:
                        statusMessage = `Disconnected (code: ${event.code})`;
                        if (event.reason) {
                            errorMessage = `Server says: ${event.reason}`;
                        }
                }

                setConnectionStatus(statusMessage);
                if (errorMessage) {
                    setError(errorMessage);
                }

                // No automatic reconnection - manual only
                if (event.code !== 1000) {
                    setError('Connection closed. Use the reconnect button to try again.');
                    setConnectionStatus('Disconnected - Manual reconnect required');
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            setError('Failed to establish connection');
            setConnectionStatus('Failed');
        }
    }, [addDataPoint]);

    const disconnect = useCallback(() => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }

        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }

        if (ws.current) {
            ws.current.close(1000, 'Client disconnect');
            ws.current = null;
        }

        // Clear history to free memory
        historyRef.current = [];
        setHistoryData(null);

        setIsConnected(false);
        setConnectionStatus('Disconnected');
    }, []);

    const reconnect = useCallback(() => {
        disconnect();
        setTimeout(() => {
            setError(null);
            connect();
        }, 1000);
    }, [connect, disconnect]);

    useEffect(() => {
        // Load cached history data on mount
        try {
            const cachedHistory = localStorage.getItem('memoryHistoryData');
            if (cachedHistory) {
                const storedHistory = JSON.parse(cachedHistory) as MemoryData[];
                // Restore the history
                historyRef.current = storedHistory;
                
                // Calculate initial statistics from stored data
                if (storedHistory.length > 0) {
                    const usedValues = storedHistory.map((p) => p.used);
                    const availableValues = storedHistory.map((p) => p.available);
                    const averageUsed = usedValues.reduce((a, b) => a + b, 0) / usedValues.length || 0;
                    const maxUsed = Math.max(...usedValues) || 0;
                    const minAvailable = Math.min(...availableValues) || 0;
                    
                    setHistoryData({
                        current: storedHistory[storedHistory.length - 1],
                        history: [...storedHistory],
                        averageUsed,
                        maxUsed,
                        minAvailable
                    });
                }
            }
        } catch (err) {
            console.error('Failed to load cached memory history:', err);
        }

        connect();

        return () => {
            disconnect();
        };
    }, [connect, disconnect]);

    return {
        historyData,
        isConnected,
        error,
        connectionStatus,
        reconnect,
        formatMemory,
    };
};
