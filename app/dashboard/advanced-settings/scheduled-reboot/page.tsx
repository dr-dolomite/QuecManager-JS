"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Clock3Icon, Loader2, Undo2Icon } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";

interface ScheduledRebootConfig {
  enabled: boolean;
  time: string;
  days: string[];
}

const ScheduledRebootPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Separate states for current config and pending changes
  const [config, setConfig] = useState<ScheduledRebootConfig>({
    enabled: false,
    time: "03:00",
    days: [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ],
  });

  // Local state for pending changes
  const [pendingTime, setPendingTime] = useState("03:00");
  const [pendingDays, setPendingDays] = useState<string[]>([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]);

  // Fetch current configuration
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/experimental/scheduled_reboot.sh"
      );
      if (!response.ok) throw new Error("Failed to fetch configuration");

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data.status === "success" && data.data) {
          const configData = data.data;
          const newConfig = {
            enabled:
              typeof configData.enabled === "boolean"
                ? configData.enabled
                : false,
            time:
              typeof configData.time === "string" ? configData.time : "03:00",
            days: Array.isArray(configData.days)
              ? configData.days
              : [
                  "monday",
                  "tuesday",
                  "wednesday",
                  "thursday",
                  "friday",
                  "saturday",
                  "sunday",
                ],
          };
          setConfig(newConfig);
          // Initialize pending states with current config
          setPendingTime(newConfig.time);
          setPendingDays(newConfig.days);
        } else {
          throw new Error(data.message || "Invalid configuration format");
        }
      } catch (parseError) {
        console.error("Response parsing error:", text);
        throw new Error("Failed to parse server response");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to fetch configuration",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig: ScheduledRebootConfig, showToast: boolean = true) => {
    try {
      setSaving(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/experimental/scheduled_reboot.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newConfig),
        }
      );

      if (!response.ok) throw new Error("Failed to save configuration");

      const data = await response.json();
      if (data.status === "success") {
        setConfig(data.data);
        setPendingTime(data.data.time);
        setPendingDays(data.data.days);
        if (showToast) {
          toast({
            title: "Success",
            description: "Scheduled reboot settings saved successfully",
          });
        }
      } else {
        throw new Error(data.message || "Failed to save configuration");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save configuration",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle changes
  const handleEnableChange = async (enabled: boolean) => {
    if (enabled) {
      // When enabling, use the pending changes
      await saveConfig({
        enabled: true,
        time: pendingTime,
        days: pendingDays,
      });
    } else {
      // When disabling, just update the enabled state
      await saveConfig({
        ...config,
        enabled: false,
      });
    }
  };

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPendingTime(event.target.value);
  };

  const handleDaysChange = async (days: string[]) => {
    setPendingDays(days);
    
    // If scheduled reboot is enabled, automatically save the new configuration
    if (config.enabled) {
      await saveConfig({
        enabled: true,
        time: pendingTime,
        days: days,
      }, false); // Don't show toast for automatic saves
    }
  };

  // Reset configuration
  const resetConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/experimental/scheduled_reboot.sh",
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to reset configuration");

      const data = await response.json();
      if (data.status === "success") {
        setConfig(data.data);
        setPendingTime(data.data.time);
        setPendingDays(data.data.days);
        toast({
          title: "Success",
          description: "Scheduled reboot settings reset to default",
        });
      } else {
        throw new Error(data.message || "Failed to reset configuration");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to reset configuration",
      });
    } finally {
      setSaving(false);
    }
  };

  // Load initial configuration
  useEffect(() => {
    fetchConfig();
  }, []);

  return (
        <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          Scheduled Reboot Settings
        </h1>
        <p className="text-muted-foreground">
          Configure scheduled reboot settings for your device.
        </p>
      </div>
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Reboot</CardTitle>
      </CardHeader>
      <CardContent className="grid space-y-6">
        <div className="flex items-center space-x-2 mt-4">
          <Switch
            id="scheduled-reboot"
            checked={config.enabled}
            onCheckedChange={handleEnableChange}
            disabled={saving || loading}
          />
          <Label htmlFor="scheduled-reboot">Enable Scheduled Reboot</Label>
        </div>
        <div className="grid w-full max-w-sm items-center gap-2">
          <Label htmlFor="rebootTime">Set Reboot Time</Label>
          <div className="relative">
            <Input
              id="rebootTime"
              type="time"
              placeholder="Reboot Time"
              value={pendingTime}
              onChange={handleTimeChange}
              disabled={saving}
              className="peer block w-full rounded-md border py-[9px] text-sm"
            />
            <Clock3Icon className="pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2" />
          </div>
        </div>
        <div className="grid w-full max-w-sm items-center gap-2">
          <Label htmlFor="days">Set Reboot Days</Label>
          <ToggleGroup
            type="multiple"
            variant="outline"
            value={pendingDays}
            onValueChange={handleDaysChange}
            disabled={saving}
          >
            <ToggleGroupItem
              value="monday"
              aria-label="Toggle Monday"
              className="data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:border-none"
            >
              <Label className="cursor-pointer" htmlFor="monday">
                Monday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="tuesday"
              aria-label="Toggle Tuesday"
              className="data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:border-none"
            >
              <Label className="cursor-pointer" htmlFor="tuesday">
                Tuesday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="wednesday"
              aria-label="Toggle Wednesday"
              className="data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:border-none"
            >
              <Label className="cursor-pointer" htmlFor="wednesday">
                Wednesday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="thursday"
              aria-label="Toggle Thursday"
              className="data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:border-none"
            >
              <Label className="cursor-pointer" htmlFor="thursday">
                Thursday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="friday"
              aria-label="Toggle Friday"
              className="data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:border-none"
            >
              <Label className="cursor-pointer" htmlFor="friday">
                Friday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="saturday"
              aria-label="Toggle Saturday"
              className="data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:border-none"
            >
              <Label className="cursor-pointer" htmlFor="saturday">
                Saturday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="sunday"
              aria-label="Toggle Sunday"
              className="data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:border-none"
            >
              <Label className="cursor-pointer" htmlFor="sunday">
                Sunday
              </Label>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardContent>
      <CardFooter className="flex border-t py-4">
        <Button
          variant="secondary"
          onClick={resetConfig}
          disabled={saving || loading}
        >
          <Undo2Icon className="h-4 w-4" />
          Reset to Default
        </Button>
      </CardFooter>
    </Card>
    </div>
  );
};

export default ScheduledRebootPage;
