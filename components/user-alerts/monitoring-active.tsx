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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, InfoIcon, Loader2 } from "lucide-react";

interface MonitoringActiveComponentProps {
  onRefresh: () => void;
  recipient: string;
  threshold: number;
}

const MonitoringActiveComponent: React.FC<MonitoringActiveComponentProps> = ({
  onRefresh,
  recipient,
  threshold,
}) => {
  const { toast } = useToast();
  const [isDisabling, setIsDisabling] = useState(false);

  const handleDisable = async (checked: boolean) => {
    if (checked) return; // Only handle disable (when switched off)

    setIsDisabling(true);

    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/alerts/disable.sh",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Success",
          description: data.message || "Connection monitoring disabled successfully",
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
            <h3 className="text-muted-foreground">Threshold Duration</h3>
            <p className="font-semibold">
              {threshold} {threshold === 1 ? "minute" : "minutes"}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground">Recipient E-mail</h3>
            <p className="font-semibold">{recipient}</p>
          </div>
        </div>

        <div className="mt-8 w-full">
          <InputGroup>
            <InputGroupTextarea
              id="textarea-code-32"
              placeholder="No notifications sent yet."
              className="min-h-[150px]"
              readOnly
            />
            <InputGroupAddon align="block-start">
              <Label htmlFor="logs" className="text-foreground">
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
    </Card>
  );
};

export default MonitoringActiveComponent;
