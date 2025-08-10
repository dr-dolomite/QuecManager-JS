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
import { Clock3Icon } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";

const ScheduledRebootPage = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Reboot</CardTitle>
        <CardDescription>
          Manage the scheduled reboot settings for your device.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid space-y-6">
        <div className="flex items-center space-x-2 mt-4">
          <Switch id="scheduled-reboot" />
          <Label htmlFor="scheduled-reboot">Enable Scheduled Reboot</Label>
        </div>
        <div className="grid w-full max-w-sm items-center gap-2">
          <Label htmlFor="rebootTime">Set Reboot Time</Label>
          <div className="relative">
            <Input
              type="time"
              placeholder="Reboot Time"
              //   Set default time to 02:00 AM
              defaultValue="03:00"
              className="peer block w-full rounded-md border py-[9px] text-sm"
            />
            <Clock3Icon className="pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2" />
          </div>
        </div>
        <div className="grid w-full max-w-sm items-center gap-2">
          <Label htmlFor="days">Set Reboot Days</Label>
          <ToggleGroup variant="outline" type="multiple">
            <ToggleGroupItem value="monday" aria-label="Toggle Monday">
              <Label className="cursor-pointer" htmlFor="monday">
                Monday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem value="tuesday" aria-label="Toggle Tuesday">
              <Label className="cursor-pointer" htmlFor="tuesday">
                Tuesday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem value="wednesday" aria-label="Toggle Wednesday">
              <Label className="cursor-pointer" htmlFor="wednesday">
                Wednesday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem value="thursday" aria-label="Toggle Thursday">
              <Label className="cursor-pointer" htmlFor="thursday">
                Thursday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem value="friday" aria-label="Toggle Friday">
              <Label className="cursor-pointer" htmlFor="friday">
                Friday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem value="saturday" aria-label="Toggle Saturday">
              <Label className="cursor-pointer" htmlFor="saturday">
                Saturday
              </Label>
            </ToggleGroupItem>
            <ToggleGroupItem value="sunday" aria-label="Toggle Sunday">
              <Label className="cursor-pointer" htmlFor="sunday">
                Sunday
              </Label>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduledRebootPage;
