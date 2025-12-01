"use client";
import React, { useEffect, useState, createContext, useContext } from 'react';
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
  const { isAuthenticated, checkAuth, logout } = useAuth();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateAuth = async () => {
      // First check frontend session
      if (!checkAuth()) {
        router.push('/login');
        return;
      }

      // Then verify the auth token is still valid with backend
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        // No auth token means we need to re-login
        console.log('No auth token found, logging out');
        await logout();
        return;
      }

      try {
        // Verify token with backend
        const response = await fetch('/cgi-bin/quecmanager/auth_verify.sh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken,
          },
        });

        const result = await response.json();
        
        if (result.state !== 'valid') {
          // Token is invalid or expired on backend (e.g., after reboot)
          console.log('Auth token invalid on backend, logging out');
          await logout();
          return;
        }
      } catch (error) {
        // If verification fails, assume token is invalid
        console.error('Auth verification failed:', error);
        await logout();
        return;
      }

      setIsValidating(false);
    };

    validateAuth();
  }, []);

  if (isValidating || !isAuthenticated) {
    return null; // or a loading spinner
  }

  // Provide WebSocket data through context
  return (
    <WebSocketContext.Provider value={websocketData}>
      {children}
    </WebSocketContext.Provider>
  );
};