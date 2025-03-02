import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock1, Info, XCircle } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface ScheduledLockingCardProps {
  loading: boolean;
  scheduling: boolean;
  startTime: string;
  endTime: string;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onSchedulingToggle: (pressed: boolean) => void;
  locked: boolean;
}

interface StatusState {
  text: string;
  color: string;
  icon: LucideIcon;
}

const ScheduledLockingCard = ({
  loading,
  scheduling,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  onSchedulingToggle,
  locked,
}: ScheduledLockingCardProps) => {
  const [status, setStatus] = useState<StatusState>({
    text: "Disabled",
    color: "text-red-600",
    icon: XCircle,
  });

  const updateStatus = () => {
    if (!scheduling) {
      setStatus({ text: "Disabled", color: "text-red-600", icon: XCircle });
      return;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

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

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [scheduling, startTime, endTime]);

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
        <div className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="start-time">Start Time</Label>
            <Input
              type="time"
              id="start-time"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              disabled={loading || scheduling}
              placeholder="START TIME"
            />
          </div>

          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="end-time">End Time</Label>
            <Input
              type="time"
              id="end-time"
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
              disabled={loading || scheduling}
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
        <Toggle
          disabled={loading || !startTime || !endTime || !locked}
          pressed={scheduling}
          onPressedChange={onSchedulingToggle}
          variant="outline"
        >
          <Clock1 className="h-4 w-4 mr-2" />
          {scheduling ? "Disable" : "Enable"} Scheduled Locking
        </Toggle>
      </CardFooter>
    </Card>
  );
};

export default ScheduledLockingCard;
