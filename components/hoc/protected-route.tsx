"use client";
import React, { useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  websocketData?: any; // Add websocket data prop - you can type this more specifically
}

// Create context for WebSocket data
const WebSocketContext = createContext<any>(null);

// Export hook to use WebSocket data in any component
export const useWebSocketData = () => {
  return useContext(WebSocketContext);
};

export const ProtectedRoute = ({ children, websocketData } : ProtectedRouteProps) => {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuth();

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/login');
    }
  }, []);

  if (!isAuthenticated) {
    return null; // or a loading spinner
  }

  // Provide WebSocket data through context
  return (
    <WebSocketContext.Provider value={websocketData}>
      {children}
    </WebSocketContext.Provider>
  );
};