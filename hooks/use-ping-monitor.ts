/** NOTE THIS FILE IS DEPRECATED DUE TO WEBSOCKET INCORPORATION AND CAN BE DELETED AT CONVENIENCE - IM LEAVING IN PLACE FOR REFERENCE */
/** NOTE THIS FILE IS DEPRECATED DUE TO WEBSOCKET INCORPORATION AND CAN BE DELETED AT CONVENIENCE - IM LEAVING IN PLACE FOR REFERENCE */
/** NOTE THIS FILE IS DEPRECATED DUE TO WEBSOCKET INCORPORATION AND CAN BE DELETED AT CONVENIENCE - IM LEAVING IN PLACE FOR REFERENCE */
/** NOTE THIS FILE IS DEPRECATED DUE TO WEBSOCKET INCORPORATION AND CAN BE DELETED AT CONVENIENCE - IM LEAVING IN PLACE FOR REFERENCE */
/** NOTE THIS FILE IS DEPRECATED DUE TO WEBSOCKET INCORPORATION AND CAN BE DELETED AT CONVENIENCE - IM LEAVING IN PLACE FOR REFERENCE */
import { useState, useEffect, useRef, useCallback } from 'react';

interface PingData {
    timestamp: string;
    host: string;
    latency: number | null;
    packet_loss: number;
    ok: boolean;
}

interface PingHistoryData {
    current: PingData;
    history: PingData[]; // Rolling history of up to 30 data points
    averageLatency: number;
    averagePacketLoss: number;
}

interface UsePingMonitorReturn {
    historyData: PingHistoryData | null;
    isConnected: boolean;
    error: string | null;
    connectionStatus: string;
    reconnect: () => void;
}

/**
 * Custom hook for monitoring ping latency via WebSocket connection.
 * 
 * Connects to the websocat server on port 8838 using the current hostname
 * (works with both direct IP access and Tailscale) to receive real-time
 * ping monitoring data and maintains a rolling history.
 * 
 * Features:
 * - Real-time ping updates
 * - 30-entry rolling history for average calculations
 * - Calculated averages for latency and packet loss
 * - Error handling and status reporting
 * - Manual reconnect for stability
 * 
 * @returns Object containing historical ping data, connection status, and utilities
 */
export const usePingMonitor = (): UsePingMonitorReturn => {
    const [historyData, setHistoryData] = useState<PingHistoryData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');
    const ws = useRef<WebSocket | null>(null);
    const heartbeatIntervalRef = useRef<number | null>(null);
    const connectionTimeoutRef = useRef<number | null>(null);
    const historyRef = useRef<PingData[]>([]);
    const lastUpdateRef = useRef<number>(0);

    // Keep 30 entries for average calculations
    const MAX_HISTORY_POINTS = 30;
    const MIN_UPDATE_INTERVAL_MS = 1000; // Throttle updates to max 1 per second

    const addDataPoint = useCallback((pingData: PingData) => {
        // Throttle updates to prevent excessive re-renders
        const now = Date.now();
        if (now - lastUpdateRef.current < MIN_UPDATE_INTERVAL_MS) {
            return; // Skip this update if too soon
        }
        lastUpdateRef.current = now;

        // Add new data point to history
        historyRef.current = [...historyRef.current, pingData];

        // Keep only the most recent MAX_HISTORY_POINTS
        if (historyRef.current.length > MAX_HISTORY_POINTS) {
            historyRef.current = historyRef.current.slice(-MAX_HISTORY_POINTS);
        }

        // Calculate statistics (only from successful pings)
        const history = historyRef.current;
        const successfulPings = history.filter(p => p.ok && p.latency !== null);
        
        const averageLatency = successfulPings.length > 0
            ? Math.round(successfulPings.reduce((sum, p) => sum + (p.latency || 0), 0) / successfulPings.length)
            : 0;
        
        const averagePacketLoss = history.length > 0
            ? Math.round(history.reduce((sum, p) => sum + p.packet_loss, 0) / history.length)
            : 0;

        setHistoryData({
            current: pingData,
            history: [...history],
            averageLatency,
            averagePacketLoss
        });

        // Cache current data in localStorage for quick loading
        try {
            localStorage.setItem('pingMonitorData', JSON.stringify(pingData));
        } catch (err) {
            console.error('Failed to cache ping data:', err);
        }
    }, [MAX_HISTORY_POINTS, MIN_UPDATE_INTERVAL_MS]);

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
            const wsUrl = `${protocol}//${host}:8838/old-pings`;

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

                    // Try to parse as JSON (ping data)
                    try {
                        const data = JSON.parse(message);

                        // Check if it's ping data (has timestamp, host, latency, packet_loss, ok fields)
                        if (data.timestamp !== undefined && 
                            data.host !== undefined && 
                            data.latency !== undefined && 
                            data.packet_loss !== undefined &&
                            data.ok !== undefined) {
                            
                            const pingData: PingData = {
                                timestamp: data.timestamp,
                                host: data.host,
                                latency: data.latency,
                                packet_loss: data.packet_loss,
                                ok: data.ok
                            };

                            addDataPoint(pingData);
                        }
                    } catch (jsonError) {
                        // Not JSON or not ping data, ignore
                    }
                } catch (parseError) {
                    console.error('Failed to process WebSocket message:', parseError);
                }
            };

            ws.current.onerror = (error: Event) => {
                console.error('Ping monitor WebSocket error:', error);
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
        // Load cached data on mount
        try {
            const cached = localStorage.getItem('pingMonitorData');
            if (cached) {
                const cachedData = JSON.parse(cached) as PingData;
                addDataPoint(cachedData);
            }
        } catch (err) {
            console.error('Failed to load cached ping data:', err);
        }

        connect();

        return () => {
            disconnect();
        };
    }, [connect, disconnect, addDataPoint]);

    return {
        historyData,
        isConnected,
        error,
        connectionStatus,
        reconnect,
    };
};
