import { useState, useEffect, useRef } from 'react';

export interface ConnectionUptimeData {
  uptime_seconds: number;
  uptime_formatted: string;
  is_connected: boolean;
  disconnect_count: number;
  last_disconnect: number;
  timestamp: number;
}

export function useConnectionUptime() {
  const [uptimeData, setUptimeData] = useState<ConnectionUptimeData | null>(null);
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
        
        // Connect to WebSocket server on device IP (same as memory monitor)
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isMounted) {
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
            
            // Filter for uptime messages
            if (data.type === 'uptime') {
              setUptimeData({
                uptime_seconds: data.uptime_seconds || 0,
                uptime_formatted: data.uptime_formatted || '0s',
                is_connected: data.is_connected !== false,
                disconnect_count: data.disconnect_count || 0,
                last_disconnect: data.last_disconnect || 0,
                timestamp: data.timestamp || Date.now() / 1000
              });
            }
          } catch (err) {
            console.error('[useConnectionUptime] Failed to parse WebSocket message:', err);
          }
        };

        ws.onerror = (event) => {
          if (isMounted) {
            console.error('[useConnectionUptime] WebSocket error:', event);
            setError('WebSocket connection error');
          }
        };

        ws.onclose = () => {
          if (isMounted) {
            setIsConnecting(true);
            
            // Reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, 3000);
          }
        };
      } catch (err) {
        console.error('[useConnectionUptime] Failed to create WebSocket:', err);
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
