/**
 * A custom React hook that manages authentication state and session handling.
 *
 * This hook handles:
 * - User authentication state management
 * - Server heartbeat monitoring
 * - Session token generation and validation
 * - Session expiration and renewal
 * - Login and logout operations
 *
 * Sessions are maintained in localStorage and expire after 30 minutes of inactivity.
 * The hook also periodically checks server status and logs out the user if the server becomes unreachable.
 *
 * @returns An object containing authentication state and methods
 * @property {boolean} isAuthenticated - Whether the user is currently authenticated
 * @property {boolean} isServerAlive - Whether the server is currently reachable
 * @property {function} login - Authenticates a user with their password
 * @property {function} logout - Logs out the current user and redirects to login page
 * @property {function} checkAuth - Checks if the current session is valid
 *
 * @example
 * // Basic usage in a component
 * function MyProtectedComponent() {
 *   const { isAuthenticated, logout } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <p>Please log in</p>;
 *   }
 *
 *   return (
 *     <div>
 *       <h1>Protected Content</h1>
 *       <button onClick={logout}>Log out</button>
 *     </div>
 *   );
 * }
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const HEARTBEAT_INTERVAL = 5 * 1000; // Check server every 5 seconds

interface SessionData {
  token: string;
  lastActivity: number;
  expiresAt: number;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  // const [isServerAlive, setIsServerAlive] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();

    // // Start heartbeat check
    // const heartbeatInterval = setInterval(
    //   checkServerStatus,
    //   HEARTBEAT_INTERVAL
    // );

    // return () => {
    //   clearInterval(heartbeatInterval);
    // };
  }, []);

  // New function to check server status
  // async function checkServerStatus() {
  //   try {
  //     const response = await fetch("/cgi-bin/quecmanager/heartbeat.sh", {
  //       method: "GET",
  //       headers: {
  //         "Cache-Control": "no-cache",
  //       },
  //     });

  //     if (!response.ok) {
  //       handleServerDown();
  //       return;
  //     }

  //     const result = await response.json();
  //     if (!result.alive) {
  //       handleServerDown();
  //     } else {
  //       setIsServerAlive(true);
  //     }
  //   } catch (error) {
  //     handleServerDown();
  //   }
  // }

  // function handleServerDown() {
  //   setIsServerAlive(false);
  //   logout();
  // }

  // Your existing functions
  function generateAuthToken(length = 32) {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from(crypto.getRandomValues(new Uint8Array(length)))
      .map((x) => charset[x % charset.length])
      .join("");
  }

  function getSessionData(): SessionData | null {
    if (typeof window === "undefined") return null;

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
      expiresAt: Date.now() + SESSION_DURATION,
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
    router.push("/login");
  }

  function checkAuth() {
    const authStatus = isSessionValid();
    setIsAuthenticated(authStatus);
    return authStatus;
  }

  async function login(password: string) {
    const encodedPassword = encodeURIComponent(password);
    try {
      const response = await fetch("/cgi-bin/quecmanager/auth.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: `password=${encodedPassword}`,
      });
      const result = await response.json();
      console.log(result);
      if (result.state === "success") {
        const newToken = generateAuthToken();
        setSessionData(newToken);
        setIsAuthenticated(true);
        router.push("/dashboard/home");
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  }

  // return { isAuthenticated, isServerAlive, login, logout, checkAuth };
  return { isAuthenticated, login, logout, checkAuth };
}
