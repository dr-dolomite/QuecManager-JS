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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const ConnectivitySettingsPage = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connectivity Settings</CardTitle>
        <CardDescription>
          Configure your device's connectivity settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 grid-flow-row gap-6">
          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="passthrough">IP Passthrough Mode</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select IP Passthrough Mode"></SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Passthrough Mode</SelectLabel>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="ETH">ETH Passthrough</SelectItem>
                  <SelectItem value="USB">USB Passthrough</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="mac">Connected MAC</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select Active MAC"></SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Active MAC</SelectLabel>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Separator className="lg:col-span-2 col-span-1 my-2" />

          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="modemProtocol">USB Modem Protocol</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select USB Modem Protocol"></SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>USB Modem Protocol</SelectLabel>
                  <SelectItem value="rmnet">RMNET</SelectItem>
                  <SelectItem value="ecm">ECM (Recommended)</SelectItem>
                  <SelectItem value="mbim">MBIM</SelectItem>
                  <SelectItem value="rndis">RNDIS</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="modemProtocol">Onboard DNS Proxy Mode</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select DNS Proxy Mode"></SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>DNS Proxy Mode</SelectLabel>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">
                    Disabled (Recommended for Passthrough)
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
      <CardFooter className="grid border-t py-4">
        <Button>Save</Button>
      </CardFooter>
    </Card>
  );
};

export default ConnectivitySettingsPage;
