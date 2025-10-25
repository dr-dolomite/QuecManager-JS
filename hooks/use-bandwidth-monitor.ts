import { useState, useEffect, useRef, useCallback } from 'react';
import { BandwidthData, BandwidthDataPoint, BandwidthHistoryData, MultiInterfaceBandwidthData, NetworkInterfaceData } from '@/types/types';

interface UseBandwidthMonitorReturn {
    historyData: BandwidthHistoryData | null;
    isConnected: boolean;
    error: string | null;
    connectionStatus: string;
    reconnect: () => void;
    formatSpeed: (bytesPerSecond: number) => string;
}

/**
 * Custom hook for monitoring bandwidth data via WebSocket connection.
 * 
 * Connects to ws://192.168.224.1:8838 (websocat server) to receive real-time
 * bandwidth monitoring data and maintains a 30-second rolling history of 
 * download and upload speeds in BITS per second.
 * 
 * Data is converted from bytes/sec to bits/sec by multiplying by 8.
 * 
 * Compatible with websocat server: websocat -t ws-l:0.0.0.0:8838 broadcast:mirror:
 * 
 * Features:
 * - Automatic reconnection DISABLED to prevent loops
 * - 30-second rolling history of speed data in bits per second
 * - Calculated averages and maximums over the history period
 * - Error handling and status reporting
 * - Data formatting utilities (bps, Kbps, Mbps, Gbps)
 * - Clean connection management
 * - Compatible with websocat broadcast server
 * - Manual reconnect only for stability
 * 
 * @returns Object containing historical bandwidth data, connection status, and utilities
 */
export const useBandwidthMonitor = (): UseBandwidthMonitorReturn => {
    const [historyData, setHistoryData] = useState<BandwidthHistoryData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const heartbeatIntervalRef = useRef<number | null>(null);
    const connectionTimeoutRef = useRef<number | null>(null);
    const maxReconnectAttempts = 5;
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const historyRef = useRef<BandwidthDataPoint[]>([]);

    // Keep only 30 seconds of history (assuming ~1 data point per second)
    const HISTORY_DURATION_MS = 30 * 1000;
    const MAX_HISTORY_POINTS = 30;

    const formatSpeed = useCallback((bitsPerSecond: number): string => {
        if (bitsPerSecond === 0) return "0 bps";
        const k = 1000; // Use 1000 for bits (not 1024 for bytes)
        const sizes = ["bps", "Kbps", "Mbps", "Gbps"];
        const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
        return parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }, []);

    /**
     * Selects the primary cellular interface from the interfaces array.
     * Priority order:
     * 1. rmnet_data1 (state: up) - Primary data interface
     * 2. rmnet_ipa0 (state: up) - IPA offload interface
     * 3. First interface with state: up
     * 4. null if no suitable interface found
     */
    const selectPrimaryCellularInterface = useCallback((interfaces: NetworkInterfaceData[]): NetworkInterfaceData | null => {
        // Priority 1: rmnet_data1 (up)
        const rmnetData1 = interfaces.find(iface => iface.name === 'rmnet_data1' && iface.state === 'up');
        if (rmnetData1) return rmnetData1;

        // Priority 2: rmnet_ipa0 (up)
        const rmnetIpa0 = interfaces.find(iface => iface.name === 'rmnet_ipa0' && iface.state === 'up');
        if (rmnetIpa0) return rmnetIpa0;

        // Priority 3: Any cellular interface that's up
        const anyCellular = interfaces.find(iface => 
            (iface.name.startsWith('rmnet_') || iface.name.includes('wwan')) && iface.state === 'up'
        );
        if (anyCellular) return anyCellular;

        // Priority 4: First interface that's up (fallback)
        const anyUp = interfaces.find(iface => iface.state === 'up');
        return anyUp || null;
    }, []);

    /**
     * Converts various timestamp formats to ISO 8601 string.
     * Supports:
     * - Unix timestamp (number in seconds): 20183.429689
     * - String format: "2025-10-21 14:27:49"
     * - ISO 8601 string: "2025-10-21T14:27:49Z"
     */
    const convertTimestampToISO = useCallback((timestamp: number | string): string => {
        if (typeof timestamp === 'number') {
            // Unix timestamp in seconds - convert to milliseconds
            return new Date(timestamp * 1000).toISOString();
        } else if (typeof timestamp === 'string') {
            // Try to parse as string date
            // Handle format: "2025-10-21 14:27:49" (space instead of T)
            const normalizedTimestamp = timestamp.replace(' ', 'T');
            const date = new Date(normalizedTimestamp);
            
            // Check if valid date
            if (isNaN(date.getTime())) {
                console.warn('Invalid timestamp string:', timestamp, '- using current time');
                return new Date().toISOString();
            }
            
            return date.toISOString();
        }
        
        // Fallback to current time
        console.warn('Unknown timestamp format:', timestamp, '- using current time');
        return new Date().toISOString();
    }, []);

    const addDataPoint = useCallback((downloadBytesPerSec: number, uploadBytesPerSec: number, timestamp: string) => {
        // Convert bytes per second to bits per second (multiply by 8)
        const downloadBits = downloadBytesPerSec * 8;
        const uploadBits = uploadBytesPerSec * 8;

        const newPoint: BandwidthDataPoint = {
            timestamp,
            download: downloadBits,
            upload: uploadBits
        };

        // Update history
        const now = new Date(timestamp).getTime();
        const cutoff = now - HISTORY_DURATION_MS;

        // Remove old points and add new point
        historyRef.current = [
            ...historyRef.current.filter((point: BandwidthDataPoint) => new Date(point.timestamp).getTime() > cutoff),
            newPoint
        ];

        // Keep only the most recent MAX_HISTORY_POINTS
        if (historyRef.current.length > MAX_HISTORY_POINTS) {
            historyRef.current = historyRef.current.slice(-MAX_HISTORY_POINTS);
        }

        // Calculate statistics (all values are in bits per second)
        const history = historyRef.current;
        const downloadSpeeds = history.map((p: BandwidthDataPoint) => p.download);
        const uploadSpeeds = history.map((p: BandwidthDataPoint) => p.upload);

        const averageDownloadSpeed = downloadSpeeds.reduce((a: number, b: number) => a + b, 0) / downloadSpeeds.length || 0;
        const averageUploadSpeed = uploadSpeeds.reduce((a: number, b: number) => a + b, 0) / uploadSpeeds.length || 0;
        const maxDownloadSpeed = Math.max(...downloadSpeeds) || 0;
        const maxUploadSpeed = Math.max(...uploadSpeeds) || 0;

        setHistoryData({
            current: newPoint,
            history: [...history],
            averageDownloadSpeed,
            averageUploadSpeed,
            maxDownloadSpeed,
            maxUploadSpeed
        });
    }, [HISTORY_DURATION_MS, MAX_HISTORY_POINTS]);

    const connect = useCallback(() => {
        try {
            // Only connect if no existing connection (FIXED - prevents connection loops)
            if (ws.current) {
                if (ws.current.readyState === WebSocket.CONNECTING) {
                    console.log('WebSocket already connecting, aborting...');
                    return;
                }
                if (ws.current.readyState === WebSocket.OPEN) {
                    console.log('WebSocket already connected, aborting new connection...');
                    return; // Don't close existing good connection
                }
            }

            setConnectionStatus('Connecting...');
            setError(null);

            // Connect to websocat server (no path needed)
            ws.current = new WebSocket('ws://192.168.224.1:8838');

            // Set connection timeout
            connectionTimeoutRef.current = window.setTimeout(() => {
                if (ws.current?.readyState === WebSocket.CONNECTING) {
                    console.log('WebSocket connection timeout');
                    ws.current.close();
                    setError('Connection timeout');
                    setConnectionStatus('Timeout');
                }
            }, 10000); // 10 second timeout

            ws.current.onopen = () => {
                console.log('Bandwidth monitor WebSocket connected to websocat server');

                // Clear connection timeout
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                }

                setIsConnected(true);
                setConnectionStatus('Connected');
                setReconnectAttempts(0);
                setError(null);

                // Start heartbeat to keep connection alive (simple text ping for websocat)
                heartbeatIntervalRef.current = window.setInterval(() => {
                    if (ws.current?.readyState === WebSocket.OPEN) {
                        ws.current.send('ping'); // Simple text ping instead of JSON
                    }
                }, 30000); // Send ping every 30 seconds
            };

            ws.current.onmessage = (event: MessageEvent) => {
                try {
                    // Handle different message types from websocat server
                    const message = event.data;

                    // Skip ping/pong messages
                    if (message === 'ping' || message === 'pong') {
                        return;
                    }

                    // Try to parse as JSON (bandwidth data)
                    try {
                        const data = JSON.parse(message);
                        // console.log('Received WebSocket data:', data);

                        // NEW FORMAT: Multi-interface bandwidth data
                        if (data.interfaces && Array.isArray(data.interfaces)) {
                            const multiInterfaceData = data as MultiInterfaceBandwidthData;
                            
                            // Select the primary cellular interface
                            const primaryInterface = selectPrimaryCellularInterface(multiInterfaceData.interfaces);
                            
                            if (primaryInterface) {
                                // Extract bps (bits per second) values - already in bits!
                                const downloadBps = primaryInterface.rx.bps;
                                const uploadBps = primaryInterface.tx.bps;
                                
                                // Convert timestamp to ISO string (handles both numeric and string formats)
                                const timestamp = convertTimestampToISO(multiInterfaceData.timestamp);
                                
                                // console.log(`Selected interface: ${primaryInterface.name}, Download: ${downloadBps} bps, Upload: ${uploadBps} bps`);
                                
                                // addDataPoint expects bytes/sec, but we have bps, so divide by 8
                                addDataPoint(downloadBps / 8, uploadBps / 8, timestamp);
                            } else {
                                console.warn('No suitable active interface found in data');
                            }
                        }
                        // LEGACY FORMAT 1: Simple download/upload format
                        else if (data.download !== undefined && data.upload !== undefined) {
                            // Generate timestamp if not provided
                            const timestamp = data.timestamp || new Date().toISOString();
                            addDataPoint(data.downloadSpeed, data.uploadSpeed, timestamp);
                        }
                        // LEGACY FORMAT 2: Wrapped format
                        else if (data.type === 'bandwidth' && data.data) {
                            // Handle wrapped format
                            const bandwidth = data.data as BandwidthData;
                            addDataPoint(bandwidth.downloadSpeed, bandwidth.uploadSpeed, bandwidth.timestamp);
                        }
                    } catch (jsonError) {
                        // Handle plain text messages that aren't JSON
                        console.log('Received text message:', message);

                        // Try to parse as simple format: "download:123,upload:456"
                        const match = message.match(/download:(\d+(?:\.\d+)?),upload:(\d+(?:\.\d+)?)/);
                        if (match) {
                            const download = parseFloat(match[1]);
                            const upload = parseFloat(match[2]);
                            addDataPoint(download, upload, new Date().toISOString());
                        }
                    }
                } catch (parseError) {
                    console.error('Failed to process WebSocket message:', parseError, 'Raw message:', event.data);
                }
            };

            ws.current.onerror = (error: Event) => {
                console.error('Bandwidth monitor WebSocket error:', error);
                setError('Connection error occurred');
                setConnectionStatus('Error');
            };

            ws.current.onclose = (event: CloseEvent) => {
                console.log(`Bandwidth monitor WebSocket disconnected: Code=${event.code}, Reason="${event.reason}", WasClean=${event.wasClean}`);
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
                    case 1001:
                        statusMessage = 'Server going away';
                        errorMessage = 'Websocat server is shutting down or restarting';
                        break;
                    case 1006:
                        statusMessage = 'Connection lost unexpectedly';
                        errorMessage = 'Network connection was lost or websocat server crashed';
                        break;
                    case 1011:
                        statusMessage = 'Server error';
                        errorMessage = 'Websocat server encountered an error';
                        break;
                    case 1012:
                        statusMessage = 'Server restarting';
                        errorMessage = 'Websocat server is restarting, will attempt to reconnect';
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

                // AUTO-RECONNECTION DISABLED (FIXED - prevents reconnection loops)
                // Only manual reconnection allowed for stability
                if (event.code !== 1000) {
                    // For non-normal closures, suggest manual reconnection
                    if (event.code === 1006) {
                        setError('Connection lost unexpectedly. Use the reconnect button to try again.');
                    } else {
                        setError('Connection closed. Use the reconnect button to try again.');
                    }
                    setConnectionStatus('Disconnected - Manual reconnect required');
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            setError('Failed to establish connection');
            setConnectionStatus('Failed');
        }
    }, [addDataPoint, selectPrimaryCellularInterface, convertTimestampToISO]); // Added new helper functions to dependencies

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }

        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }

        if (ws.current) {
            ws.current.close(1000, 'Client disconnect'); // Clean closure
            ws.current = null;
        }

        setIsConnected(false);
        setConnectionStatus('Disconnected');
        setReconnectAttempts(0);
    }, []);

    const reconnect = useCallback(() => {
        console.log('Manual reconnect initiated...');
        disconnect();
        setTimeout(() => {
            setReconnectAttempts(0);
            setError(null); // Clear previous errors
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
        historyData,
        isConnected,
        error,
        connectionStatus,
        reconnect,
        formatSpeed,
    };
};