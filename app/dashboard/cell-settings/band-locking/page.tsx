import React from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { LockIcon, RefreshCw } from "lucide-react";

const BandLocking = () => {
  const LTEBands =
    "1:2:3:4:5:7:8:12:13:14:18:19:20:25:26:28:29:30:32:34:38:39:40:41:42:43:46:48:66:71";
  const LTEBandArray = LTEBands.split(":");
  const NSABands = "1:2:3:5:7:8:12:20:25:28:38:40:41:48:66:71:77:78:79"
  const NSABandArray = NSABands.split(":");
  const SABandArray = "1:2:3:5:7:8:12:20:25:28:38:40:41:48:66:71:77:78:79";
  const SABands = SABandArray.split(":");

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>4G LTE Band Locking</CardTitle>
          <CardDescription>
            Lock the device to a specific LTE band.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid lg:grid-cols-8 md:grid-cols-6 grid-cols-4 grid-flow-row gap-4">
          {LTEBandArray.map((band, index) => (
            <div className="flex items-center space-x-2" key={index}>
              <Checkbox id={band} checked />
              <label
                htmlFor={band}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                B{band}
              </label>
            </div>
          ))}
        </CardContent>
        <CardFooter className="border-t py-4 px-6 flex flex-row items-center space-x-6 mt-2">
          <Button>
            <LockIcon className="h-4 w-4 mr-2" />
            Lock Selected Bands
            </Button>
          <Button variant="secondary">Uncheck All</Button>
          <Button variant="secondary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Default
            </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NR5G-NSA Band Locking</CardTitle>
          <CardDescription>
            Lock the device to a specific NR5G-NSA band.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid lg:grid-cols-8 md:grid-cols-6 grid-cols-4 grid-flow-row gap-4">
          {LTEBandArray.map((band, index) => (
            <div className="flex items-center space-x-2" key={index}>
              <Checkbox id={band} checked />
              <label
                htmlFor={band}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                N{band}
              </label>
            </div>
          ))}
        </CardContent>
        <CardFooter className="border-t py-4 px-6 flex flex-row items-center space-x-6 mt-2">
          <Button>
            <LockIcon className="h-4 w-4 mr-2" />
            Lock Selected Bands
            </Button>
          <Button variant="secondary">Uncheck All</Button>
          <Button variant="secondary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Default
            </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NR5G-SA Band Locking</CardTitle>
          <CardDescription>
            Lock the device to a specific NR5G-SA band.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid lg:grid-cols-8 md:grid-cols-6 grid-cols-4 grid-flow-row gap-4">
          {LTEBandArray.map((band, index) => (
            <div className="flex items-center space-x-2" key={index}>
              <Checkbox id={band} checked />
              <label
                htmlFor={band}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                N{band}
              </label>
            </div>
          ))}
        </CardContent>
        <CardFooter className="border-t py-4 px-6 flex flex-row items-center space-x-6 mt-2">
          <Button>
            <LockIcon className="h-4 w-4 mr-2" />
            Lock Selected Bands
            </Button>
          <Button variant="secondary">Uncheck All</Button>
          <Button variant="secondary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Default
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default BandLocking;
