"use client";

import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";

import {
  Clock2Icon,
  DownloadCloudIcon,
  HelpCircleIcon,
  KeyRoundIcon,
  Loader2,
  MailIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";

interface MonitoringSetupProps {
  onRefresh: () => void;
}

const MonitoringSetupComponent = ({ onRefresh }: MonitoringSetupProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [recipient, setRecipient] = useState("");
  const [threshold, setThreshold] = useState("1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate inputs
      if (!email || !appPassword || !recipient) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!threshold || parseInt(threshold) < 1) {
        toast({
          title: "Validation Error",
          description: "Threshold must be at least 1 minute",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Configure email settings
      const configResponse = await fetch(
        "/cgi-bin/quecmanager/alerts/configure.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            app_password: appPassword,
            recipient: recipient,
            threshold: threshold,
          }),
        }
      );

      if (!configResponse.ok) {
        throw new Error(`HTTP error! status: ${configResponse.status}`);
      }

      const responseText = await configResponse.text();
      console.log("Configure response:", responseText);

      let configData;
      try {
        configData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse JSON:", responseText);
        throw new Error(
          `Server returned invalid JSON. Response: ${responseText.substring(0, 200)}`
        );
      }

      if (configData.status !== "success") {
        throw new Error(configData.message || "Failed to configure email");
      }

      // Show appropriate toast based on test email result
      if (configData.test_email_sent) {
        toast({
          title: "Configuration Successful! 🎉",
          description: `Email settings saved and test email sent to ${recipient}. Starting monitoring service...`,
        });
      } else {
        toast({
          title: "Configuration Saved ⚠️",
          description:
            "Email settings saved but test email failed. Please check your credentials.",
          variant: "destructive",
        });
      }

      // Enable and start the monitoring daemon
      try {
        const enableResponse = await fetch(
          "/cgi-bin/quecmanager/alerts/enable.sh",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const enableData = await enableResponse.json();

        if (enableData.status === "success") {
          toast({
            title: "Monitoring Service Started",
            description: "Connection monitoring is now active",
          });
        } else {
          throw new Error(
            enableData.message || "Failed to enable monitoring service"
          );
        }
      } catch (serviceError) {
        console.error("Error starting service:", serviceError);
        toast({
          title: "Service Start Warning",
          description:
            "Configuration saved but failed to start monitoring service. Please start it manually.",
          variant: "destructive",
        });
      }

      // Refresh parent component to update status
      setTimeout(() => {
        onRefresh();
      }, 1000);
    } catch (error) {
      console.error("Error configuring alerts:", error);
      toast({
        title: "Configuration Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
        <form onSubmit={handleSubmit} className="grid gap-6 max-w-md">
          <div className="grid gap-1.5">
            <Label htmlFor="email" className="text-muted-foreground">
              Email Address
            </Label>
            <InputGroup>
              <InputGroupInput
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
              <InputGroupAddon>
                <MailIcon />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <InputGroupText>@gmail.com</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="app-password" className="text-muted-foreground">
              App Password
            </Label>
            <InputGroup>
              <InputGroupInput
                id="app-password"
                type="password"
                placeholder="Enter your app password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <InputGroupAddon>
                <KeyRoundIcon />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InputGroupButton
                      variant="ghost"
                      aria-label="Help"
                      size="icon-xs"
                    >
                      <HelpCircleIcon />
                    </InputGroupButton>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-pretty max-w-xs">
                      An app password is required for enhanced security. Please
                      generate one from your email provider's security settings.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </InputGroupAddon>
            </InputGroup>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Generate App Password
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-pretty max-w-xs">
                  The email account used to generate the app password must match
                  the one provided above.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="recipient" className="text-muted-foreground">
              Recipient Email
            </Label>
            <InputGroup>
              <InputGroupInput
                id="recipient"
                type="email"
                placeholder="Enter recipient email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
                disabled={isLoading}
              />
              <InputGroupAddon>
                <MailIcon />
              </InputGroupAddon>
            </InputGroup>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="duration" className="text-muted-foreground">
              Duration Threshold for Alerts (in minutes)
            </Label>
            <InputGroup>
              <InputGroupAddon>
                <Clock2Icon />
              </InputGroupAddon>
              <InputGroupInput
                id="duration"
                type="number"
                placeholder="Enter duration in minutes"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                min="1"
                required
                disabled={isLoading}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>minutes</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <Button type="submit" className="w-40" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <DownloadCloudIcon className="h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MonitoringSetupComponent;
