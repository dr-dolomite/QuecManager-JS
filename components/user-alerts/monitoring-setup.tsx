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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";

import {
  DownloadCloudIcon,
  HelpCircleIcon,
  KeyRoundIcon,
  MailIcon,
} from "lucide-react";
import { Label } from "../ui/label";

const MonitoringSetupComponent = () => {
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
        <form className="grid gap-6 max-w-md">
          <div className="grid gap-1.5">
            <Label htmlFor="email" className="text-muted-foreground">
              Email Address
            </Label>
            <InputGroup>
              <InputGroupInput
                id="email"
                type="email"
                placeholder="Enter your email"
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
          <Button type="submit" className="w-40">
            <DownloadCloudIcon className="h-4 w-4" />
            Save Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MonitoringSetupComponent;
