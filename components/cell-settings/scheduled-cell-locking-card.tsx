import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Clock1,
  XCircle,
  LockIcon,
  CalendarIcon,
} from "lucide-react";
import { LucideIcon } from "lucide-react";
import { Button } from "../ui/button";

// Update the props to receive schedule data from parent
interface ScheduledLockingCardProps {
  loading: boolean;
  scheduleData: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    active: boolean;
    status: string;
    message: string;
    locked: boolean;
  };
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onSchedulingToggle: (pressed: boolean) => void;
}

interface StatusState {
  text: string;
  color: string;
  icon: LucideIcon;
}

const ScheduledLockingCard = ({
  loading,
  scheduleData,
  onStartTimeChange,
  onEndTimeChange,
  onSchedulingToggle,
}: ScheduledLockingCardProps) => {
  const [status, setStatus] = useState<StatusState>({
    text: "Disabled",
    color: "text-red-600",
    icon: XCircle,
  });

  // Use local time calculation
  const updateStatusFromLocalTime = () => {
    if (!scheduleData.enabled) {
      setStatus({ text: "Disabled", color: "text-red-600", icon: XCircle });
      return;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMinute] = scheduleData.startTime
      .split(":")
      .map(Number);
    const [endHour, endMinute] = scheduleData.endTime.split(":").map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes <= endMinutes) {
      // Same day schedule
      if (currentTime >= startMinutes && currentTime <= endMinutes) {
        setStatus({
          text: "Active",
          color: "text-green-600",
          icon: CheckCircle2,
        });
      } else {
        setStatus({
          text: "Inactive",
          color: "text-yellow-500",
          icon: Clock1,
        });
      }
    } else {
      // Overnight schedule
      if (currentTime >= startMinutes || currentTime <= endMinutes) {
        setStatus({
          text: "Active",
          color: "text-green-600",
          icon: CheckCircle2,
        });
      } else {
        setStatus({
          text: "Inactive",
          color: "text-yellow-500",
          icon: Clock1,
        });
      }
    }
  };

  // Update status based on backend data
  const updateStatusFromBackend = () => {
    if (scheduleData.active) {
      setStatus({
        text: "Active",
        color: "text-green-600",
        icon: CheckCircle2,
      });
    } else if (scheduleData.enabled && !scheduleData.active) {
      setStatus({
        text: "Inactive",
        color: "text-yellow-500",
        icon: Clock1,
      });
    } else {
      setStatus({
        text: "Disabled",
        color: "text-red-600",
        icon: XCircle,
      });
    }
  };

  useEffect(() => {
    // Use backend data for status if available
    updateStatusFromBackend();

    // Also start an interval to update based on local time if needed
    const localInterval = setInterval(updateStatusFromLocalTime, 60000);

    return () => {
      clearInterval(localInterval);
    };
  }, [scheduleData]);

  const StatusIcon = status.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <span>Cell Locking Scheduler</span>
          </div>

          <div className="flex items-center">
            <StatusIcon className={`h-4 w-4 mr-1 ${status.color}`} />
            <div className="text-sm text-gray-500">{status.text}</div>
          </div>
        </CardTitle>
        <CardDescription>
          Schedule the device to lock to specific cells at certain times.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {scheduleData.enabled && (
          <Alert className="mb-6">
            <LockIcon className="h-4 w-4" color="orange" />
            <AlertTitle>Scheduled Cell Locking Active</AlertTitle>
            <AlertDescription>
              Cell locking is currently being managed by the scheduler. Manual
              changes to cell locks may be overridden during scheduled hours.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="start-time">Start Time</Label>
            <Input
              type="time"
              id="start-time"
              value={scheduleData.startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              disabled={loading || scheduleData.enabled}
              placeholder="START TIME"
            />
          </div>

          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="end-time">End Time</Label>
            <Input
              type="time"
              id="end-time"
              value={scheduleData.endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
              disabled={loading || scheduleData.enabled}
              placeholder="END TIME"
            />
          </div>

          <div className="lg:col-span-2 col-span-1">
            <p className="text-sm text-gray-500">
              Make sure to properly set the timezone using Luci for this to
              properly work. The scheduler will lock the device to the selected
              cells during the specified time range. The scheduler will not lock
              the device if the time range is not valid (e.g. start time is
              after end time).
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t py-4">
        <Button
          onClick={() => onSchedulingToggle(!scheduleData.enabled)}
          disabled={loading || (!scheduleData.locked && !scheduleData.enabled)}
        >
          <CalendarIcon className="h-4 w-4" />
          {scheduleData.enabled ? "Disable Scheduler" : "Enable Scheduler"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ScheduledLockingCard;
