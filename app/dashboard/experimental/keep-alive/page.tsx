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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { FaRunning } from "react-icons/fa";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/hooks/use-toast";

interface KeepAliveStatus {
  enabled: number;
  start_time: string;
  end_time: string;
  interval: number;
  last_activity?: string;
}

interface KeepAliveResponse {
  status: string;
  message: string;
  error?: string;
}

const KeepAliveCard = () => {
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [interval, setInterval] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async (): Promise<void> => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/experimental/keep_alive_reworked.sh?status=true"
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: KeepAliveStatus = await response.json();

      setStartTime(data.start_time || "");
      setEndTime(data.end_time || "");
      setInterval(data.interval ? data.interval.toString() : "");
      setEnabled(data.enabled === 1);
    } catch (error) {
      console.error("Failed to fetch status:", error);
      toast({
        title: "Error",
        description: "Failed to fetch current status",
        variant: "destructive",
      });
    }
  };

  const handleToggle = async (pressed: boolean): Promise<void> => {
    if (loading) return;

    setLoading(true);

    try {
      if (pressed) {
        // Validate inputs before enabling
        if (!startTime || !endTime || !interval) {
          toast({
            title: "Error",
            description: "Please fill in all fields",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const intervalNum = parseInt(interval, 10);
        if (isNaN(intervalNum) || intervalNum < 5) {
          toast({
            title: "Error",
            description: "Interval must be at least 5 minutes",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const response = await fetch(
          "/cgi-bin/quecmanager/experimental/keep_alive_reworked.sh",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `start_time=${encodeURIComponent(
              startTime
            )}&end_time=${encodeURIComponent(
              endTime
            )}&interval=${encodeURIComponent(interval)}`,
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: KeepAliveResponse = await response.json();

        if (data.error) {
          toast({
            title: "Error",
            description: data.error,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        toast({
          title: "Success",
          description: "Keep-alive scheduling enabled with download method",
        });
        setEnabled(true);
      } else {
        // Disable keep-alive
        const response = await fetch(
          "/cgi-bin/quecmanager/experimental/keep_alive_reworked.sh",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "disable=true",
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: KeepAliveResponse = await response.json();

        if (data.error) {
          toast({
            title: "Error",
            description: data.error,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        toast({
          title: "Success",
          description: "Keep-alive scheduling disabled",
        });
        setEnabled(false);
      }
    } catch (error) {
      console.error("Failed to update keep-alive settings:", error);
      toast({
        title: "Error",
        description:
          "Failed to update keep-alive settings. Please check your connection.",
        variant: "destructive",
      });
      // Don't change the enabled state on error
    } finally {
      setLoading(false);
    }
  };

  const handleIntervalChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const value = e.target.value.replace(/[^0-9]/g, "").replace(/^0+/, "");
    setInterval(value);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Keep Alive</CardTitle>
        </div>

        <CardDescription>
          Ensure uninterrupted connectivity by downloading test files at
          scheduled intervals to keep your connection alive.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="start-time">Start Time</Label>
            <Input
              type="time"
              id="start-time"
              value={startTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setStartTime(e.target.value)
              }
              disabled={enabled || loading}
            />
          </div>
          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="end-time">End Time</Label>
            <Input
              type="time"
              id="end-time"
              value={endTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEndTime(e.target.value)
              }
              disabled={enabled || loading}
            />
          </div>
          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="interval">Interval (minutes)</Label>
            <Input
              type="number"
              id="interval"
              min={5}
              value={interval}
              onChange={handleIntervalChange}
              placeholder="Enter minutes (minimum 5)"
              disabled={enabled || loading}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          {enabled ? (
            <div className="lg:col-span-2 col-span-1 flex items-center gap-2">
              <CircleCheck className="h-4 w-4 text-green-500 hidden md:block" />
              <p className="text-sm text-gray-500">
                Keep-alive scheduling is enabled.
              </p>
            </div>
          ) : (
            <div className="lg:col-span-2 col-span-1 flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-orange-500 hidden md:block" />
              <p className="text-sm text-gray-500">
                Downloads a
                <a
                  href="https://ash-speed.hetzner.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline mx-1"
                >
                  100MB test file
                </a>
                at each interval. Please consider your data usage limits. The
                minimum interval is 5 minutes.
              </p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="border-t py-4">
        <Toggle
          pressed={enabled}
          onPressedChange={handleToggle}
          disabled={loading || !startTime || !endTime || !interval}
        >
          <FaRunning className="h-4 w-4 mr-2" />
          {loading
            ? "Processing..."
            : enabled
            ? "Disable Keep Alive"
            : "Enable Keep Alive"}
        </Toggle>
      </CardFooter>
    </Card>
  );
};

export default KeepAliveCard;
