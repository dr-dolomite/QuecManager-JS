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
import { Clock1, DiscIcon, TriangleAlert } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/hooks/use-toast";

interface KeepAliveStatus {
  enabled: number;
  start_time: string;
  end_time: string;
  interval: number;
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
  const { toast } = useToast();

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async (): Promise<void> => {
    try {
      const response = await fetch(
        "/api/cgi-bin/quecmanager/experimental/keep_alive.sh?status=true"
      );
      const data: KeepAliveStatus = await response.json();

      setStartTime(data.start_time);
      setEndTime(data.end_time);
      setInterval(data.interval.toString());
      setEnabled(data.enabled === 1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch current status",
        variant: "destructive",
      });
    }
  };

  const handleToggle = async (pressed: boolean): Promise<void> => {
    try {
      if (pressed) {
        if (!startTime || !endTime || !interval) {
          toast({
            title: "Error",
            description: "Please fill in all fields",
            variant: "destructive",
          });
          return;
        }

        const intervalNum = parseInt(interval, 10);
        if (isNaN(intervalNum) || intervalNum <= 0) {
          toast({
            title: "Error",
            description: "Interval must be a positive number",
            variant: "destructive",
          });
          return;
        }

        const response = await fetch(
          "/api/cgi-bin/quecmanager/experimental/keep_alive.sh",
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

        const data: KeepAliveResponse = await response.json();

        if (data.error) {
          toast({
            title: "Error",
            description: data.error,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Success",
          description: "Keep-alive scheduling enabled",
        });
      } else {
        const response = await fetch(
          "/api/cgi-bin/quecmanager/experimental/keep_alive.sh",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "disable=true",
          }
        );

        const data: KeepAliveResponse = await response.json();

        toast({
          title: "Success",
          description: "Keep-alive scheduling disabled",
        });
      }

      setEnabled(pressed);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update keep-alive settings",
        variant: "destructive",
      });
    }
  };

  const handleIntervalChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    // Remove any non-numeric characters and leading zeros
    const value = e.target.value.replace(/[^0-9]/g, "").replace(/^0+/, "");
    setInterval(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keep Alive</CardTitle>
        <CardDescription>
          Ensure uninterrupted connectivity by preventing modem idle times with
          scheduled speed tests to keep your connection alive.
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
              disabled={enabled}
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
              disabled={enabled}
            />
          </div>
          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="interval">Interval (minutes)</Label>
            <Input
              type="number"
              id="interval"
              min={1}
              value={interval}
              onChange={handleIntervalChange}
              placeholder="Enter minutes"
              disabled={enabled}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="lg:col-span-2 col-span-1 flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-red-600" />
            <p className="text-sm text-gray-500">
              Please consider your data usage limits when setting the interval.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t py-4">
        <Toggle
          pressed={enabled}
          onPressedChange={handleToggle}
          disabled={!startTime || !endTime || !interval}
        >
          <DiscIcon className="h-4 w-4 mr-2" />
          Enable Keep Alive
        </Toggle>
      </CardFooter>
    </Card>
  );
};

export default KeepAliveCard;
