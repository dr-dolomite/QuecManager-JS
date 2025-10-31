"use client";

import React, { useState } from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Edit3Icon,
  InfoIcon,
  Loader2,
  RefreshCcwIcon,
} from "lucide-react";
import { Button } from "../ui/button";

interface MonitoringActiveComponentProps {
  onRefresh: () => void;
  onEdit: () => void;
  recipient: string;
  sender: string;
  threshold: number;
  lastNotification: string;
}

const MonitoringActiveComponent = ({
  onRefresh,
  onEdit,
  recipient,
  sender,
  threshold,
  lastNotification,
}: MonitoringActiveComponentProps) => {
  const { toast } = useToast();
  const [isDisabling, setIsDisabling] = useState(false);

  const handleDisable = async (checked: boolean) => {
    if (checked) return; // Only handle disable (when switched off)

    setIsDisabling(true);

    try {
      const response = await fetch("/cgi-bin/quecmanager/alerts/disable.sh", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Success",
          description:
            data.message || "Connection monitoring disabled successfully",
        });
        onRefresh();
      } else {
        throw new Error(data.message || "Failed to disable monitoring");
      }
    } catch (error) {
      console.error("Error disabling monitoring:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to disable connection monitoring",
        variant: "destructive",
      });
    } finally {
      setIsDisabling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection Monitoring Alerts Settings</CardTitle>
        <CardDescription>
          Utilize the <span className="font-semibold">Gmail</span> service to
          manage your Connection Monitoring alert settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center space-x-2 mb-3">
            <Switch
              id="toggle-connection-monitoring"
              checked={true}
              onCheckedChange={handleDisable}
              disabled={isDisabling}
            />
            <Label htmlFor="toggle-connection-monitoring">
              {isDisabling ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Disabling...
                </span>
              ) : (
                "Connection Monitoring Active"
              )}
            </Label>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground">Sender E-mail</h3>
            <p className="font-semibold">{sender || "Not configured"}</p>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground">Recipient E-mail</h3>
            <p className="font-semibold">{recipient}</p>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground">Threshold Duration</h3>
            <p className="font-semibold">
              {threshold} {threshold === 1 ? "minute" : "minutes"}
            </p>
          </div>
        </div>

        <div className="mt-8 w-full">
          <InputGroup>
            <InputGroupTextarea
              id="textarea-last-notification"
              value={
                lastNotification
                  ? lastNotification
                  : "No notifications sent yet."
              }
              className="min-h-[150px]"
              readOnly
            />
            <InputGroupAddon align="block-start">
              <Label
                htmlFor="textarea-last-notification"
                className="text-foreground"
              >
                Last Notification Sent
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    variant="ghost"
                    aria-label="Help"
                    className="ml-auto rounded-full"
                    size="icon-xs"
                  >
                    <InfoIcon />
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Displays the last time a connection monitoring alert was
                    sent to your email.
                  </p>
                </TooltipContent>
              </Tooltip>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex items-center gap-x-4">
          <Button onClick={onEdit} disabled={isDisabling}>
            <Edit3Icon className="h-4 w-4" />
            Edit Configuration
          </Button>

          <Button
            variant="secondary"
            onClick={onRefresh}
            disabled={isDisabling}
          >
            <RefreshCcwIcon className="h-4 w-4" />
            Refresh Status
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default MonitoringActiveComponent;
