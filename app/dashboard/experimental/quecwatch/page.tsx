"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  ShieldClose,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Status type updated to include maxRetries state
type QuecWatchStatus =
  | "inactive"
  | "active"
  | "error"
  | "maxRetries"
  | "loading";

interface QuecWatchConfig {
  pingTarget: string;
  pingInterval: number;
  pingFailures: number;
  maxRetries: number;
  connectionRefresh: boolean;
  autoSimFailover: boolean;
  simFailoverSchedule: number;
  currentRetries?: number;
  refreshCount?: number;
}

interface QuecWatchResponse {
  status: "success" | "error" | "inactive" | "active";
  message?: string;
  config?: QuecWatchConfig;
  lastActivity?: string;
}

const QuecWatchPage = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<QuecWatchConfig>({
    pingTarget: "",
    pingInterval: 30,
    pingFailures: 3,
    maxRetries: 5,
    connectionRefresh: false,
    autoSimFailover: false,
    simFailoverSchedule: 30,
  });

  const [status, setStatus] = useState<QuecWatchStatus>("loading");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<string | null>(null);

  // Fetch QuecWatch configuration
  const fetchQuecWatchConfig = async () => {
    try {
      const response = await fetch(
        "/cgi-bin/experimental/quecwatch/fetch-quecwatch.sh"
      );
      if (!response.ok) throw new Error("Network response was not ok");

      const data: QuecWatchResponse = await response.json();

      switch (data.status) {
        case "active":
          if (data.config) {
            const newConfig = {
              pingTarget: data.config.pingTarget,
              pingInterval: data.config.pingInterval,
              pingFailures: data.config.pingFailures,
              maxRetries: data.config.maxRetries,
              connectionRefresh: data.config.connectionRefresh === true,
              autoSimFailover: data.config.autoSimFailover === true,
              simFailoverSchedule: data.config.simFailoverSchedule || 30,
              currentRetries: data.config.currentRetries,
              refreshCount: data.config.refreshCount,
            };
            setConfig(newConfig);

            // Update status based on retries
            if (
              newConfig.currentRetries !== undefined &&
              newConfig.currentRetries >= newConfig.maxRetries
            ) {
              setStatus("maxRetries");
              toast({
                title: "Maximum Retries Reached",
                description: "QuecWatch has reached maximum retry attempts",
                variant: "destructive",
              });
            } else {
              setStatus("active");
            }

            setLastActivity(data.lastActivity || null);
          }
          break;
        case "inactive":
          setStatus("inactive");
          break;
        default:
          setStatus("error");
          setError(data.message || "Unknown error occurred");
      }
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      toast({
        title: "Error",
        description: "Failed to fetch QuecWatch configuration",
        variant: "destructive",
      });
    }
  };

  // Initial configuration fetch
  useEffect(() => {
    fetchQuecWatchConfig();
  }, []);

  useEffect(() => {
    // Only set up interval when status is active
    if (status === "active") {
      const intervalId = setInterval(fetchQuecWatchConfig, 5000);

      // Cleanup interval when component unmounts or status changes
      return () => clearInterval(intervalId);
    }
  }, [status]);

  // Reset retry counter
  const resetRetryCounter = async () => {
    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("action", "reset");

      const response = await fetch(
        "/cgi-bin/experimental/quecwatch/reset-quecwatch.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Network response was not ok");

      const result = await response.json();
      if (result.status === "success") {
        toast({
          title: "QuecWatch Reset",
          description: "Counter reset and service restarted successfully",
        });
        // Set status back to active immediately
        setStatus("active");
        // Update the current retries in the config
        setConfig((prev) => ({
          ...prev,
          currentRetries: 0,
        }));
        // Fetch the latest config after a brief delay to ensure service has restarted
        setTimeout(fetchQuecWatchConfig, 1000);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to reset retry counter",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Enable QuecWatch function
  const enableQuecWatch = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new URLSearchParams();

      // Add configuration parameters
      formData.append("action", "enable");
      formData.append("ping_target", config.pingTarget);
      formData.append("ping_interval", config.pingInterval.toString());
      formData.append("ping_failures", config.pingFailures.toString());
      formData.append("max_retries", config.maxRetries.toString());
      formData.append(
        "connection_refresh",
        config.connectionRefresh.toString()
      );
      formData.append("auto_sim_failover", config.autoSimFailover.toString());
      formData.append(
        "sim_failover_schedule",
        config.simFailoverSchedule.toString()
      );

      const response = await fetch(
        "/cgi-bin/experimental/quecwatch/enable-quecwatch.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const result = (await response.json()) as QuecWatchResponse;

      if (result.status === "success") {
        setStatus("active");
        // Refetch configuration to ensure latest state

        toast({
          title: "QuecWatch Enabled",
          description: "Quecwatch enabled successfully",
        });

        await fetchQuecWatchConfig();
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Disable QuecWatch function
  const disableQuecWatch = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new URLSearchParams();
      formData.append("action", "disable");

      const response = await fetch(
        "/cgi-bin/experimental/quecwatch/disable-quecwatch.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const result = (await response.json()) as QuecWatchResponse;

      if (result.status === "success") {
        setStatus("inactive");
        // Reset configuration to defaults
        setConfig({
          pingTarget: "",
          pingInterval: 30,
          pingFailures: 3,
          maxRetries: 5,
          connectionRefresh: false,
          autoSimFailover: false,
          simFailoverSchedule: 30,
        });

        toast({
          title: "QuecWatch Disabled",
          description: "Quecwatch disabled successfully",
          variant: "default",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      toast({
        title: "Error",
        description: "Failed to disable QuecWatch",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>QuecWatch</CardTitle>
        <CardDescription>
          A watchdog feature catered for Quectel-AP modems
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8">
          <div className="grid gap-2">
            <div className="flex justify-between items-center gap-x-4 rounded-lg border p-4">
              <Label>QuecWatch Status</Label>
              <div className="flex items-center space-x-1">
                {status === "inactive" ? (
                  <>
                    <ShieldClose className="text-rose-500 size-4" />
                    <p className="text-muted-foreground text-sm">Inactive</p>
                  </>
                ) : status === "active" ? (
                  <>
                    <ShieldCheck className="text-green-500 size-4" />
                    <p className="text-muted-foreground text-sm">Active</p>
                  </>
                ) : status === "maxRetries" ? (
                  <>
                    <AlertTriangle className="text-yellow-500 size-4" />
                    <p className="text-muted-foreground text-sm">
                      Maximum Retries Exhausted
                    </p>
                  </>
                ) : (
                  <>
                    <ShieldClose className="text-amber-500 size-4" />
                    <p className="text-muted-foreground text-sm">Error</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center gap-x-4 rounded-lg border p-4">
              <Label>Remaining Retries</Label>
              <div className="flex items-center gap-2">
                {(status === "active" || status === "maxRetries") && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={resetRetryCounter}
                    disabled={isLoading}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                <p className="text-muted-foreground text-sm">
                  {config.currentRetries} / {config.maxRetries}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-flow-row lg:grid-cols-2 grid-cols-1 gap-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="ping">Ping Target</Label>
              <Input
                id="ping"
                placeholder="8.8.8.8"
                value={config.pingTarget}
                disabled={status === "active"}
                readOnly={status === "active"}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    pingTarget: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="ping-interval">Ping Interval</Label>
              <Select
                value={config.pingInterval.toString()}
                disabled={status === "active"}
                onValueChange={(value) =>
                  setConfig((prev) => ({
                    ...prev,
                    pingInterval: parseInt(value),
                  }))
                }
              >
                <SelectTrigger id="ping-interval">
                  <SelectValue placeholder="Select Ping Interval" />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 10, 15, 30, 60, 120, 600, 1800, 3600].map(
                    (interval) => (
                      <SelectItem key={interval} value={interval.toString()}>
                        {interval >= 3600
                          ? `${interval / 3600} hour${
                              interval > 3600 ? "s" : ""
                            }`
                          : interval >= 60
                          ? `${interval / 60} minute${
                              interval >= 120 ? "s" : ""
                            }`
                          : `${interval} second${interval !== 1 ? "s" : ""}`}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="ping-failure">Ping Failures</Label>
              <Select
                value={config.pingFailures.toString()}
                disabled={status === "active"}
                onValueChange={(value) =>
                  setConfig((prev) => ({
                    ...prev,
                    pingFailures: parseInt(value),
                  }))
                }
              >
                <SelectTrigger id="ping-failure">
                  <SelectValue placeholder="Select Ping Failures" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 3, 5, 10].map((failures) => (
                    <SelectItem key={failures} value={failures.toString()}>
                      {failures} failure{failures !== 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="max-retries">Max Retries</Label>
              <Select
                value={config.maxRetries.toString()}
                disabled={status === "active"}
                onValueChange={(value) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxRetries: parseInt(value),
                  }))
                }
              >
                <SelectTrigger id="max-retries">
                  <SelectValue placeholder="Select Max Retries" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 3, 5, 10, 15, 20].map((retries) => (
                    <SelectItem key={retries} value={retries.toString()}>
                      {retries}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5 grid">
              <Label className="text-base">Connection Refresh</Label>
              <Label className="text-sm font-normal text-muted-foreground">
                Toggle the connection refresh for the modem to first attempt
                reconnecting to the network before restarting.
              </Label>
            </div>
            <Switch
              checked={config.connectionRefresh}
              disabled={status === "active"}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({
                  ...prev,
                  connectionRefresh: checked,
                }))
              }
            />
          </div>

          <div className=" rounded-lg border p-4 grid gap-y-6">
            <div className="flex flex-row items-center justify-between">
              <div className="space-y-0.5 grid">
                <Label className="text-base">Auto SIM Failover</Label>
                <Label className="text-sm font-normal text-muted-foreground">
                  Auto SIM Failover will automatically switch to the next
                  available SIM card when the current SIM card fails to connect
                  to the network.
                </Label>
              </div>
              <Switch
                checked={config.autoSimFailover}
                disabled={status === "active"}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({
                    ...prev,
                    autoSimFailover: checked,
                  }))
                }
              />
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="sim-failover">Schedule SIM Checking</Label>
              <Select
                value={config.simFailoverSchedule.toString()}
                disabled={status === "active"}
                onValueChange={(value) =>
                  setConfig((prev) => ({
                    ...prev,
                    simFailoverSchedule: parseInt(value),
                  }))
                }
              >
                <SelectTrigger id="sim-failover" className="max-w-xs">
                  <SelectValue placeholder="Select SIM Checking Interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Minute</SelectItem>
                  <SelectItem value="5">5 Minutes</SelectItem>
                  <SelectItem value="30">30 Minutes</SelectItem>
                  <SelectItem value="60">1 Hour</SelectItem>
                  <SelectItem value="360">6 Hours</SelectItem>
                  <SelectItem value="720">12 Hours</SelectItem>
                  <SelectItem value="1440">24 Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <Label className="text-base">Last Activity</Label>
            <p className="text-sm text-muted-foreground mt-2">{lastActivity}</p>
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>
      </CardContent>
      <CardFooter className="flex gap-4 border-t py-4">
        <Button
          onClick={enableQuecWatch}
          disabled={
            isLoading ||
            !config.pingTarget ||
            status === "active" ||
            status === "maxRetries"
          }
        >
          {isLoading ? "Enabling..." : "Enable QuecWatch"}
        </Button>
        {(status === "active" || status === "maxRetries") && (
          <Button
            variant="destructive"
            onClick={disableQuecWatch}
            disabled={isLoading}
          >
            {isLoading ? "Disabling..." : "Disable QuecWatch"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default QuecWatchPage;
