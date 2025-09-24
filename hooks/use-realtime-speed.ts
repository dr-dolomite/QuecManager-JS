"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

export interface SpeedData {
  download_kbps: number;
  upload_kbps: number;
  download_mbps: number;
  upload_mbps: number;
  interface: string;
  timestamp: number;
}

export interface WebSocketStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastUpdate: number | null;
}

interface UseRealtimeSpeedOptions {
  websocketUrl?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onData?: (data: SpeedData) => void;
}

export function useRealtimeSpeed(options: UseRealtimeSpeedOptions = {}) {
  const {
    websocketUrl = 'ws://127.0.0.1:8080',
    autoReconnect = true,
    maxReconnectAttempts = 10,
    reconnectInterval = 3000,
    onConnect,
    onDisconnect,
    onError,
    onData,
  } = options;

  const [speedData, setSpeedData] = useState<SpeedData | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    connecting: false,
    error: null,
    lastUpdate: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const isManuallyClosedRef = useRef(false);

  // Function to clear reconnection timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Function to handle WebSocket connection
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.CONNECTING || 
        wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connecting or connected
    }

    setStatus(prev => ({ 
      ...prev, 
      connecting: true, 
      error: null 
    }));

    try {
      const ws = new WebSocket(websocketUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectCountRef.current = 0;
        setStatus(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          error: null,
        }));
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.error) {
            setStatus(prev => ({
              ...prev,
              error: data.error,
            }));
            onError?.(data.error);
            return;
          }

          if (data.status === 'connected') {
            console.log('Monitor connected:', data);
            return;
          }

          // Handle speed data
          if (data.download_kbps !== undefined && data.upload_kbps !== undefined) {
            const speedData: SpeedData = {
              download_kbps: data.download_kbps,
              upload_kbps: data.upload_kbps,
              download_mbps: data.download_mbps,
              upload_mbps: data.upload_mbps,
              interface: data.interface,
              timestamp: data.timestamp,
            };
            
            setSpeedData(speedData);
            setStatus(prev => ({
              ...prev,
              lastUpdate: Date.now(),
            }));
            onData?.(speedData);
          }
        } catch (error) {
          console.error('Error parsing WebSocket data:', error);
          setStatus(prev => ({
            ...prev,
            error: 'Invalid data received',
          }));
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        wsRef.current = null;
        setStatus(prev => ({
          ...prev,
          connected: false,
          connecting: false,
        }));
        onDisconnect?.();

        // Auto-reconnect if not manually closed and attempts remaining
        if (!isManuallyClosedRef.current && autoReconnect && 
            reconnectCountRef.current < maxReconnectAttempts) {
          reconnectCountRef.current++;
          console.log(`Attempting to reconnect (${reconnectCountRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectCountRef.current >= maxReconnectAttempts) {
          setStatus(prev => ({
            ...prev,
            error: 'Max reconnection attempts reached',
          }));
          onError?.('Max reconnection attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus(prev => ({
          ...prev,
          connecting: false,
          error: 'Connection error',
        }));
        onError?.('Connection error');
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setStatus(prev => ({
        ...prev,
        connecting: false,
        error: 'Failed to create connection',
      }));
      onError?.('Failed to create connection');
    }
  }, [websocketUrl, autoReconnect, maxReconnectAttempts, reconnectInterval, onConnect, onDisconnect, onError, onData]);

  // Function to disconnect WebSocket
  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    clearReconnectTimeout();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setStatus({
      connected: false,
      connecting: false,
      error: null,
      lastUpdate: null,
    });
    setSpeedData(null);
  }, [clearReconnectTimeout]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      isManuallyClosedRef.current = false;
      reconnectCountRef.current = 0;
      connect();
    }, 100);
  }, [disconnect, connect]);

  // Auto-connect on mount
  useEffect(() => {
    isManuallyClosedRef.current = false;
    connect();

    return () => {
      isManuallyClosedRef.current = true;
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, clearReconnectTimeout]);

  return {
    speedData,
    status,
    connect,
    disconnect,
    reconnect,
    isConnected: status.connected,
    isConnecting: status.connecting,
    hasError: !!status.error,
    error: status.error,
  };
}