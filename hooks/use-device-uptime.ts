import { useState, useEffect, useRef } from 'react';

export interface DeviceUptimeData {
  uptime_seconds: number;
  uptime_formatted: string;
  timestamp: number;
}

export function useDeviceUptime() {
  const [uptimeData, setUptimeData] = useState<DeviceUptimeData | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;

    const connectWebSocket = () => {
      if (!isMounted) return;

      try {
        // Dynamically get the WebSocket URL based on current window location
        // This works whether accessing via 192.168.224.1 or Tailscale IP
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Use 192.168.224.1 instead of localhost
        const host = window.location.hostname === 'localhost' ? '192.168.224.1' : window.location.hostname;
        const wsUrl = `${protocol}//${host}:8838`;
        
        console.log(`[useDeviceUptime] Connecting to ${wsUrl}`);
        
        // Connect to WebSocket server on device IP
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isMounted) {
            console.log('[useDeviceUptime] WebSocket connected');
            setIsConnecting(false);
            setError(null);
          }
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;

          try {
            // Skip ping/pong messages
            if (event.data === 'ping' || event.data === 'pong') {
              return;
            }

            const data = JSON.parse(event.data);
            
            // Log all received messages for debugging
            console.log('[useDeviceUptime] Received message:', data);
            
            // Filter for device_uptime messages
            if (data.type === 'device_uptime') {
              console.log('[useDeviceUptime] Setting device uptime data:', data);
              setUptimeData({
                uptime_seconds: data.uptime_seconds || 0,
                uptime_formatted: data.uptime_formatted || '0s',
                timestamp: data.timestamp || Date.now() / 1000
              });
            } else {
              console.log('[useDeviceUptime] Ignoring message with type:', data.type);
            }
          } catch (err) {
            console.error('[useDeviceUptime] Failed to parse WebSocket message:', err);
          }
        };

        ws.onerror = (event) => {
          if (isMounted) {
            console.error('[useDeviceUptime] WebSocket error:', event);
            setError('WebSocket connection error');
          }
        };

        ws.onclose = () => {
          if (isMounted) {
            console.log('[useDeviceUptime] WebSocket disconnected, reconnecting in 3s...');
            setIsConnecting(true);
            
            // Reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, 3000);
          }
        };
      } catch (err) {
        console.error('[useDeviceUptime] Failed to create WebSocket:', err);
        setError('Failed to connect to WebSocket');
        setIsConnecting(false);
      }
    };

    // Initial connection
    connectWebSocket();

    // Cleanup
    return () => {
      isMounted = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    uptimeData,
    isConnecting,
    error
  };
}
