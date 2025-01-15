"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

interface SessionData {
  token: string;
  lastActivity: number;
  expiresAt: number;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  function generateAuthToken(length = 32) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from(crypto.getRandomValues(new Uint8Array(length)))
      .map(x => charset[x % charset.length])
      .join('');
  }

  function getSessionData(): SessionData | null {
    if (typeof window === 'undefined') return null;
    
    const sessionStr = localStorage.getItem("session");
    if (!sessionStr) return null;
    
    try {
      return JSON.parse(sessionStr);
    } catch {
      return null;
    }
  }

  function setSessionData(token: string) {
    const session: SessionData = {
      token,
      lastActivity: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION
    };
    localStorage.setItem("session", JSON.stringify(session));
  }

  function isSessionValid(): boolean {
    const session = getSessionData();
    if (!session) return false;
    
    const now = Date.now();
    
    // Check if session has expired
    if (now > session.expiresAt) {
      logout();
      return false;
    }
    
    // Extend session if it's been more than 5 minutes since last activity
    if (now - session.lastActivity > 5 * 60 * 1000) {
      setSessionData(session.token);
    }
    
    return true;
  }

  function logout() {
    localStorage.removeItem("session");
    setIsAuthenticated(false);
    router.push('/login');
  }

  function checkAuth() {
    const authStatus = isSessionValid();
    setIsAuthenticated(authStatus);
    return authStatus;
  }

  async function login(password: string) {
    const encodedPassword = encodeURIComponent(password);
    try {
      // const response = await fetch("/api/auth", {
      const response = await fetch("/api/cgi-bin/auth.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // body: JSON.stringify({ password }),
        body: `password=${encodedPassword}`,
      });

      const result = await response.json();
      console.log(result);

      if (result.state === "success") {
        const newToken = generateAuthToken();
        setSessionData(newToken);
        setIsAuthenticated(true);
        router.push('/dashboard/home');
        return true;
      } else {
        return false;
      }
      // if (result.success) {
      //   const newToken = generateAuthToken();
      //   setSessionData(newToken);
      //   setIsAuthenticated(true);
      //   router.push('/dashboard/home');
      //   return true;
      // } else {
      //   return false;
      // }
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  }

  return { isAuthenticated, login, logout, checkAuth };
}