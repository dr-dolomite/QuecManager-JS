/**
 * Home Page Data Usage Warning Hook
 * 
 * This hook integrates with the home page to show data usage warnings
 * when users reach their configured thresholds. It's designed to be
 * lightweight and non-intrusive while providing important alerts.
 */

import { useState, useEffect, useCallback } from "react";

interface DataUsageWarning {
  show: boolean;
  percentage: number;
  currentUsage: string;
  monthlyLimit: string;
  remaining: string;
  isOverLimit: boolean;
}

const useHomeDataUsageWarning = () => {
  const [warning, setWarning] = useState<DataUsageWarning>({
    show: false,
    percentage: 0,
    currentUsage: "0 Bytes",
    monthlyLimit: "0 Bytes",
    remaining: "0 Bytes",
    isOverLimit: false,
  });

  const [loading, setLoading] = useState(false);

  // Format bytes to human readable format
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }, []);

  // Check for data usage warnings
  const checkDataUsageWarning = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await fetch("/cgi-bin/quecmanager/experimental/data_usage_tracking/config_manager.sh");
      
      if (!response.ok) {
        // Silently fail - this is optional functionality
        return;
      }

      const data = await response.json();
      
      // Only show warning if tracking is enabled and warning hasn't been shown
      if (data.config.enabled && !data.config.warningShown) {
        const percentage = (data.usage.total / data.config.monthlyLimit) * 100;
        
        if (percentage >= data.config.warningThreshold) {
          setWarning({
            show: true,
            percentage,
            currentUsage: formatBytes(data.usage.total),
            monthlyLimit: formatBytes(data.config.monthlyLimit),
            remaining: formatBytes(Math.max(0, data.config.monthlyLimit - data.usage.total)),
            isOverLimit: percentage >= 100,
          });
        } else {
          setWarning(prev => ({ ...prev, show: false }));
        }
      } else {
        setWarning(prev => ({ ...prev, show: false }));
      }
    } catch (error) {
      // Silently handle errors - this is optional functionality
      console.debug("Data usage warning check failed:", error);
    } finally {
      setLoading(false);
    }
  }, [formatBytes]);

  // Dismiss warning and mark as shown
  const dismissWarning = useCallback(async () => {
    try {
      await fetch("/cgi-bin/quecmanager/experimental/data_usage_tracking/config_manager.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ warningShown: true }),
      });
      
      setWarning(prev => ({ ...prev, show: false }));
    } catch (error) {
      console.error("Failed to dismiss warning:", error);
      // Still hide the warning locally even if the server update fails
      setWarning(prev => ({ ...prev, show: false }));
    }
  }, []);

  // Check on mount and set up periodic checking
  useEffect(() => {
    checkDataUsageWarning();
    
    // Check every 5 minutes when on the home page
    const intervalId = setInterval(checkDataUsageWarning, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [checkDataUsageWarning]);

  return {
    warning,
    loading,
    dismissWarning,
    checkWarning: checkDataUsageWarning,
  };
};

export default useHomeDataUsageWarning;
