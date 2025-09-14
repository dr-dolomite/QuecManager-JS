/**
 * Custom hook for managing data usage tracking functionality
 * 
 * This hook provides comprehensive data usage tracking features including:
 * - Monthly data limit monitoring
 * - Usage warnings and alerts
 * - Configuration management
 * - Backup and restore functionality
 * 
 * @returns Object containing usage data, configuration, and control functions
 */

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface DataUsageConfig {
  enabled: boolean;
  monthlyLimit: number; // in bytes
  backupInterval: number; // in hours
  autoBackupEnabled: boolean; // whether automated backups are enabled
  resetDay: number; // day of month (1-28)
  warningThreshold: number; // percentage (1-100)
  warningShown: boolean; // Legacy - keep for compatibility
  warningThresholdShown: boolean; // Warning at threshold percentage
  warningOverlimitShown: boolean; // Warning when over 100%
  lastBackup: number; // Unix timestamp of last backup/initialization
}

interface DataUsage {
  upload: number; // in bytes
  download: number; // in bytes
  total: number; // in bytes
}

interface DataUsageResponse {
  config: DataUsageConfig;
  usage: DataUsage;
}

const useDataUsageTracking = () => {
  const [config, setConfig] = useState<DataUsageConfig>({
    enabled: false,
    monthlyLimit: 10737418240, // 10GB default
    backupInterval: 12,
    autoBackupEnabled: false,
    resetDay: 1,
    warningThreshold: 90,
    warningShown: false,
    warningThresholdShown: false,
    warningOverlimitShown: false,
    lastBackup: 0,
  });

  const [usage, setUsage] = useState<DataUsage>({
    upload: 0,
    download: 0,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const { toast } = useToast();

  // Format bytes to human readable format
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }, []);

  // Format Unix timestamp to human readable date
  const formatDate = useCallback((timestamp: number): string => {
    if (timestamp === 0) return "Never";
    return new Date(timestamp * 1000).toLocaleString();
  }, []);

  // Calculate usage percentage
  const getUsagePercentage = useCallback((): number => {
    if (config.monthlyLimit === 0) return 0;
    return Math.min((usage.total / config.monthlyLimit) * 100, 100);
  }, [usage.total, config.monthlyLimit]);

  // Check if warning should be shown
  const shouldShowWarning = useCallback((): boolean => {
    if (!config.enabled) return false;
    const percentage = getUsagePercentage();
    
    // Check for over-limit warning (100%+)
    if (percentage >= 100 && !config.warningOverlimitShown) {
      return true;
    }
    
    // Check for threshold warning (e.g., 90%)
    if (percentage >= config.warningThreshold && !config.warningThresholdShown) {
      return true;
    }
    
    return false;
  }, [config.enabled, config.warningThresholdShown, config.warningOverlimitShown, config.warningThreshold, getUsagePercentage]);

  // Fetch current configuration and usage
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch configuration
      const configResponse = await fetch("/cgi-bin/quecmanager/experimental/data_usage_tracking/config_manager.sh");
      
      if (!configResponse.ok) {
        throw new Error(`HTTP error! status: ${configResponse.status}`);
      }

      const configData: DataUsageResponse = await configResponse.json();
      setConfig(configData.config);
      
      // Fetch real-time usage from CGI script
      let usageData = configData.usage; // fallback to config data
      
      try {
        const usageResponse = await fetch("/cgi-bin/quecmanager/experimental/data_usage_tracking/fetch_realtime_usage.sh");
        if (usageResponse.ok) {
          const realtimeData = await usageResponse.json();
          if (realtimeData.enabled !== undefined && !realtimeData.error) {
            // Use real-time data if available and valid
            usageData = {
              upload: realtimeData.upload || 0,
              download: realtimeData.download || 0,
              total: realtimeData.total || 0
            };
          } else if (realtimeData.error) {
            // Log the specific error but continue with fallback data
            console.warn("Real-time usage data error:", realtimeData.error);
          }
        }
      } catch (usageError) {
        // Fall back to config data if real-time data unavailable
        console.warn("Real-time usage data unavailable, using stored data:", usageError);
      }
      
      setUsage(usageData);

      // Check if warning should be displayed
      if (configData.config.enabled) {
        const percentage = (usageData.total / configData.config.monthlyLimit) * 100;
        
        // Check for over-limit warning (100%+)
        if (percentage >= 100 && !configData.config.warningOverlimitShown) {
          setShowWarning(true);
        }
        // Check for threshold warning (e.g., 90%) - only if not over limit
        else if (percentage >= configData.config.warningThreshold && !configData.config.warningThresholdShown) {
          setShowWarning(true);
        }
      }

    } catch (err) {
      console.error("Error fetching data usage data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Update configuration
  const updateConfig = useCallback(async (newConfig: Partial<DataUsageConfig>): Promise<boolean> => {
    try {
      setError(null);
      
      // Check if autoBackupEnabled is being changed
      const isBackupToggleChanged = 'autoBackupEnabled' in newConfig && 
        newConfig.autoBackupEnabled !== config.autoBackupEnabled;
      
      const response = await fetch("/cgi-bin/quecmanager/experimental/data_usage_tracking/config_manager.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // If backup toggle was changed, also call the service toggle API
        if (isBackupToggleChanged) {
          try {
            const serviceResponse = await fetch(
              `/cgi-bin/quecmanager/experimental/data_usage_tracking/config_manager.sh?action=toggle_backup&enabled=${newConfig.autoBackupEnabled}`,
              { method: "GET" }
            );
            
            if (!serviceResponse.ok) {
              console.warn("Failed to toggle backup service, but config was saved");
            }
          } catch (serviceErr) {
            console.warn("Error toggling backup service:", serviceErr);
          }
        }
        
        // Update local state
        setConfig(prev => ({ ...prev, ...newConfig }));
        
        toast({
          title: "Success",
          description: "Configuration updated successfully",
        });
        
        return true;
      } else {
        throw new Error(result.message || "Update failed");
      }
    } catch (err) {
      console.error("Error updating configuration:", err);
      setError(err instanceof Error ? err.message : "Failed to update configuration");
      
      toast({
        title: "Error",
        description: "Failed to update configuration",
        variant: "destructive",
      });
      
      return false;
    }
  }, [toast, config.autoBackupEnabled]);

  // Reset usage data
  const resetUsage = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      
      const response = await fetch("/cgi-bin/quecmanager/experimental/data_usage_tracking/config_manager.sh?action=reset");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Reset local usage state
        setUsage({ upload: 0, download: 0, total: 0 });
        setShowWarning(false);
        
        toast({
          title: "Success",
          description: "Usage data reset successfully",
        });
        
        return true;
      } else {
        throw new Error(result.message || "Reset failed");
      }
    } catch (err) {
      console.error("Error resetting usage:", err);
      setError(err instanceof Error ? err.message : "Failed to reset usage data");
      
      toast({
        title: "Error",
        description: "Failed to reset usage data",
        variant: "destructive",
      });
      
      return false;
    }
  }, [toast]);

  // Create manual backup
  const createBackup = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      
      const response = await fetch("/cgi-bin/quecmanager/experimental/data_usage_tracking/config_manager.sh?action=backup");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Backup created successfully",
        });
        
        return true;
      } else {
        throw new Error(result.message || "Backup failed");
      }
    } catch (err) {
      console.error("Error creating backup:", err);
      setError(err instanceof Error ? err.message : "Failed to create backup");
      
      toast({
        title: "Error",
        description: "Failed to create backup",
        variant: "destructive",
      });
      
      return false;
    }
  }, [toast]);

  // Dismiss warning and mark as shown
  const dismissWarning = useCallback(async () => {
    const percentage = getUsagePercentage();
    
    // Determine which warning flag to set based on current usage
    if (percentage >= 100) {
      // Over limit - set over limit flag
      await updateConfig({ warningOverlimitShown: true });
    } else if (percentage >= config.warningThreshold) {
      // At threshold - set threshold flag
      await updateConfig({ warningThresholdShown: true });
    }
    
    setShowWarning(false);
  }, [updateConfig, getUsagePercentage, config.warningThreshold]);

  // Close warning without marking as shown (for X button or clicking outside)
  const closeWarning = useCallback(() => {
    setShowWarning(false);
  }, []);

  // Initialize and set up polling
  useEffect(() => {
    fetchData();
    
    // Poll every 66 seconds when enabled (modem counter updates every 65 seconds)
    let intervalId: NodeJS.Timeout;
    
    if (config.enabled) {
      intervalId = setInterval(fetchData, 66000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchData, config.enabled]);

  // Check for warnings when usage or config changes
  useEffect(() => {
    if (shouldShowWarning()) {
      setShowWarning(true);
    }
  }, [shouldShowWarning]);

  return {
    // State
    config,
    usage,
    loading,
    error,
    showWarning,
    
    // Computed values
    usagePercentage: getUsagePercentage(),
    formattedUsage: {
      upload: formatBytes(usage.upload),
      download: formatBytes(usage.download),
      total: formatBytes(usage.total),
    },
    formattedLimit: formatBytes(config.monthlyLimit),
    remaining: formatBytes(Math.max(0, config.monthlyLimit - usage.total)),
    
    // Actions
    updateConfig,
    resetUsage,
    createBackup,
    dismissWarning,
    closeWarning,
    refresh: fetchData,
    formatBytes,
    formatDate,
  };
};

export default useDataUsageTracking;
