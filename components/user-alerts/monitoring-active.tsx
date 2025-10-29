import React from "react";

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
import { CheckCircle2, InfoIcon } from "lucide-react";

const MonitoringActiveComponent = () => {
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
            <Switch id="toggle-connection-monitoring" checked />
            <Label htmlFor="toggle-connection-monitoring">
              Disable Connection Monitoring Alerts
            </Label>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground">Internet Status</h3>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <p className="text-green-500 font-semibold">Connected</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground">E-mail Address</h3>
            <p className="font-semibold">user@example.com</p>
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
