/**
 * Data Usage Tracking Component
 *
 * Provides a comprehensive interface for monitoring and managing monthly data usage.
 * Features include limit setting, backup intervals, usage visualization, and warnings.
 */

"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Wifi,
  Settings,
  RotateCcw,
  Save,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Database,
  Calendar,
  Percent,
  HardDrive,
  InfoIcon,
  RefreshCcwIcon,
} from "lucide-react";

import useDataUsageTracking from "@/hooks/data-usage-tracking";
import DataUsageWarningDialog from "@/components/experimental/data-usage-warning-dialog";

const DataUsageTracking = () => {
  const {
    config,
    usage,
    loading,
    error,
    showWarning,
    usagePercentage,
    formattedUsage,
    formattedLimit,
    remaining,
    updateConfig,
    resetUsage,
    createBackup,
    dismissWarning,
    closeWarning,
    refresh,
    formatBytes,
  } = useDataUsageTracking();

  const [tempConfig, setTempConfig] = useState(config);
  const [showSettings, setShowSettings] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Update temp config when actual config changes
  React.useEffect(() => {
    setTempConfig(config);
  }, [config]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const success = await updateConfig(tempConfig);
    if (success) {
      setShowSettings(false);
    }
    setIsSaving(false);
  };

  const handleResetUsage = async () => {
    const success = await resetUsage();
    if (success) {
      setShowResetDialog(false);
    }
  };

  const getUsageColor = () => {
    if (usagePercentage >= 100) return "text-red-500";
    if (usagePercentage >= 90) return "text-orange-500";
    if (usagePercentage >= 75) return "text-yellow-500";
    return "text-green-500";
  };

  const getProgressColor = () => {
    if (usagePercentage >= 100) return "bg-red-500";
    if (usagePercentage >= 90) return "bg-orange-500";
    if (usagePercentage >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Data Usage Tracking
          </CardTitle>
          <CardDescription>
            Monitor and manage your monthly data consumption
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-8 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Data Usage Tracking</CardTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-4 w-4 mr-1 text-orange-600" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    This is just an estimate based on modem counters and may not
                    be 100% accurate.
                  </p>
                </TooltipContent>
              </Tooltip>
              <CardDescription>
                Monitor and manage your monthly data consumption.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCcwIcon className="h-4 w-4" />
              </Button>
              <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Data Usage Settings</DialogTitle>
                    <DialogDescription>
                      Configure your data usage tracking preferences
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enabled">Enable Tracking</Label>
                      <Switch
                        id="enabled"
                        checked={tempConfig.enabled}
                        onCheckedChange={(checked) =>
                          setTempConfig({ ...tempConfig, enabled: checked })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="limit">Monthly Limit (GB)</Label>
                      <Input
                        id="limit"
                        type="number"
                        min="1"
                        max="1000"
                        value={Math.round(tempConfig.monthlyLimit / 1073741824)}
                        onChange={(e) =>
                          setTempConfig({
                            ...tempConfig,
                            monthlyLimit: parseInt(e.target.value) * 1073741824,
                          })
                        }
                        placeholder="Enter limit in GB"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="threshold">Warning Threshold (%)</Label>
                      <Input
                        id="threshold"
                        type="number"
                        min="50"
                        max="100"
                        value={tempConfig.warningThreshold}
                        onChange={(e) =>
                          setTempConfig({
                            ...tempConfig,
                            warningThreshold: parseInt(e.target.value),
                          })
                        }
                        placeholder="Warning percentage"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="interval">Backup Interval</Label>
                      <Select
                        value={tempConfig.backupInterval.toString()}
                        onValueChange={(value) =>
                          setTempConfig({
                            ...tempConfig,
                            backupInterval: parseInt(value),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">Every 3 hours</SelectItem>
                          <SelectItem value="6">Every 6 hours</SelectItem>
                          <SelectItem value="12">Every 12 hours</SelectItem>
                          <SelectItem value="24">Every 24 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="resetDay">Monthly Reset Day</Label>
                      <Input
                        id="resetDay"
                        type="number"
                        min="1"
                        max="28"
                        value={tempConfig.resetDay}
                        onChange={(e) =>
                          setTempConfig({
                            ...tempConfig,
                            resetDay: parseInt(e.target.value),
                          })
                        }
                        placeholder="Day of month (1-28)"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowSettings(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveSettings} disabled={isSaving}>
                      <Save className="h-4 w-4 " />
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!config.enabled ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="size-6" />
                  <div>
                    <p className="text-sm font-medium">Data usage tracking is currently disabled.</p>
                    <p className="text-sm">Enable it in settings to start monitoring your usage.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Usage Progress */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Monthly Usage</span>
                  <span className={`font-medium ${getUsageColor()}`}>
                    {usagePercentage.toFixed(1)}% used
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${getProgressColor()}`}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formattedUsage.total}</span>
                  <span>{formattedLimit}</span>
                </div>
              </div>

              {/* Usage Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">Upload</p>
                        <p className="text-lg font-bold">
                          {formattedUsage.upload}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <TrendingDown className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Download</p>
                        <p className="text-lg font-bold">
                          {formattedUsage.download}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Database className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">Remaining</p>
                        <p className="text-lg font-bold">{remaining}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Percent className="h-8 w-8 text-purple-500" />
                      <div>
                        <p className="text-sm font-medium">Usage</p>
                        <p className={`text-lg font-bold ${getUsageColor()}`}>
                          {usagePercentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap justify-between">
                <Button onClick={createBackup}>
                  <HardDrive className="h-4 w-4 " />
                  Create Backup
                </Button>

                <Dialog
                  open={showResetDialog}
                  onOpenChange={setShowResetDialog}
                >
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      <RotateCcw className="h-4 w-4" />
                      Reset Usage
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset Usage Data</DialogTitle>
                      <DialogDescription>
                        This will reset all usage counters to zero. This action
                        cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowResetDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={handleResetUsage}>
                        Reset Usage
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Warning Dialog */}
      <DataUsageWarningDialog
        open={showWarning}
        onClose={closeWarning}
        onDismiss={dismissWarning}
        usagePercentage={usagePercentage}
        currentUsage={formattedUsage.total}
        monthlyLimit={formattedLimit}
        remaining={remaining}
        onOpenSettings={() => {
          closeWarning();
          setShowSettings(true);
        }}
      />
    </>
  );
};

export default DataUsageTracking;
