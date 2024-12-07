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
import { ShieldClose, ShieldCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Updated types for QuecWatch configuration
interface QuecWatchConfig {
  pingTarget: string;
  pingInterval: number;
  pingFailures: number;
  maxRetries: number;
  connectionRefresh: boolean;
  mobileDataReconnect: boolean;
  autoSimFailover: boolean;
  simFailoverSchedule: number;
  currentRetries?: number;
  refreshCount?: number;
}

// Types for API response
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
    mobileDataReconnect: false,
    autoSimFailover: false,
    simFailoverSchedule: 30,
  });

  const [status, setStatus] = useState<
    "inactive" | "active" | "error" | "loading"
  >("loading");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<string | null>(null);

  // Fetch QuecWatch configuration
  const fetchQuecWatchConfig = async () => {
    try {
      const response = await fetch(
        "/cgi-bin/experimental/quecwatch/quecwatch-fetch.sh",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

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
              mobileDataReconnect: data.config.mobileDataReconnect === true,
              autoSimFailover: data.config.autoSimFailover === true,
              simFailoverSchedule: data.config.simFailoverSchedule || 30,
              currentRetries: data.config.currentRetries,
              refreshCount: data.config.refreshCount,
            };
            setConfig(newConfig);

            // Check if max retries have been exhausted
            if (
              newConfig.currentRetries !== undefined &&
              newConfig.currentRetries >= newConfig.maxRetries
            ) {
              setStatus("inactive");
              toast({
                title: "QuecWatch Stopped",
                description: "Maximum retries exhausted",
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
          toast({
            title: "Error",
            description: "Failed to fetch quecwatch configuration",
            variant: "destructive",
          });
      }
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      toast({
        title: "Error",
        description: "Failed to fetch quecwatch configuration",
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
      formData.append(
        "mobile_data_reconnect",
        config.mobileDataReconnect.toString()
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
          mobileDataReconnect: false,
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
                    <p className="text-muted-foreground text-sm">
                      {config.currentRetries !== undefined &&
                      config.currentRetries >= config.maxRetries
                        ? "Max Retries Exhausted"
                        : "Inactive"}
                    </p>
                  </>
                ) : status === "active" ? (
                  <>
                    <ShieldCheck className="text-green-500 size-4" />
                    <p className="text-muted-foreground text-sm">Active</p>
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
              <p className="text-muted-foreground text-sm">
                {config.currentRetries} / {config.maxRetries}
              </p>
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
                  {[1, 3, 5, 10, 15, 30, 60].map((interval) => (
                    <SelectItem key={interval} value={interval.toString()}>
                      {interval} second{interval !== 1 ? "s" : ""}
                    </SelectItem>
                  ))}
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
                  {[1, 3, 5, 10].map((retries) => (
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
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5 grid">
              <Label className="text-base">Use Mobile Data Reconnect</Label>
              <Label className="text-sm font-normal text-muted-foreground">
                Use Mobile Data Reconnect will turn off and on the mobile data
                connection rather than restarting the modem.
              </Label>
            </div>
            <Switch
              checked={config.mobileDataReconnect}
              disabled={status === "active"}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({
                  ...prev,
                  mobileDataReconnect: checked,
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
      <CardFooter className="flex gap-4">
        <Button
          onClick={enableQuecWatch}
          disabled={isLoading || !config.pingTarget || status === "active"}
        >
          {isLoading ? "Enabling..." : "Enable QuecWatch"}
        </Button>
        {status === "active" && (
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
