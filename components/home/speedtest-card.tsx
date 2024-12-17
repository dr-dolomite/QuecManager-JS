"use client";

import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CirclePlay, RefreshCw } from "lucide-react";
import PropagateLoader from "react-spinners/PropagateLoader";
import PuffLoader from "react-spinners/PuffLoader";
import { Button } from "../ui/button";

const SpeedTestCard = () => {
  const [idleSpeedTest, setIdleSpeedTest] = useState(false);
  const [downloadTestRunning, setDownloadTestRunning] = useState(false);
  const [uploadTestRunning, setUploadTestRunning] = useState(false);
  const [speedTestFinished, setSpeedTestFinished] = useState(true);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between">
        <CardTitle>Speed Test</CardTitle>
        <Button variant="outline" asChild>
        <RefreshCw className="size-6 text-primary cursor-pointer" />
        </Button>
        </div>
     
      </CardHeader>
      {idleSpeedTest && (
        <CardContent className="flex flex-col gap-6 p-4 items-center justify-center">
          <div className="relative flex flex-col items-center justify-center">
            <PuffLoader
              color="#5420ab"
              size={192} // Slightly larger than the icon to create a pulsing effect
              className="-top-8 -left-8 absolute"
              style={{
                zIndex: 1,
              }}
            />
            <CirclePlay className="size-32 text-primary cursor-pointer z-10" />
          </div>
          <CardDescription>
            Run a speed test to check your internet connection.
          </CardDescription>
        </CardContent>
      )}

      {downloadTestRunning && (
        <CardContent className="p-6">
          <div className="flex flex-col space-y-8 items-center justify-center">
            <CardDescription className="text-center text-md">
              Testing download speed...
            </CardDescription>
            <PropagateLoader color="#2563EB" />
            <div className="lg:text-6xl text-4xl font-bold">24.5 Mbps</div>
          </div>
        </CardContent>
      )}

      {uploadTestRunning && (
        <CardContent className="p-6">
          <div className="flex flex-col space-y-8 items-center justify-center">
            <CardDescription className="text-center text-md">
              Testing upload speed...
            </CardDescription>
            <PropagateLoader color="#2563EB" />
            <div className="lg:text-6xl text-4xl font-bold">32.5 Mbps</div>
          </div>
        </CardContent>
      )}

      {speedTestFinished && (
        <CardContent className="py-6">
          <div className="grid gap-6">
            <div className="flex items-center justify-center gap-x-6">
              <div className="grid gap-1.5">
                <div className="lg:text-4xl text-3xl font-bold">24.5 Mbps</div>
                <CardDescription className="text-center">
                  Download
                </CardDescription>
              </div>

              <div className="grid gap-1.5">
                <div className="lg:text-4xl text-3xl font-bold">32.5 Mbps</div>
                <CardDescription className="text-center">
                  Upload
                </CardDescription>
              </div>
            </div>
            <div className="grid grid-cols-2 grid-flow-row gap-4">
              <div className="grid gap-0.5">
                <p className="font-semibold text-base text-center">2.289</p>
                <CardDescription className="text-center">Jitter</CardDescription>
              </div>

              <div className="grid gap-0.5">
                <p className="font-semibold text-base text-center">28ms</p>
                <CardDescription className="text-center">Latency</CardDescription>
              </div>

              <div className="grid gap-0.5">
                <p className="font-semibold text-base text-center">Smart Communications</p>
                <CardDescription className="text-center">Provider</CardDescription>
              </div>

              <div className="grid gap-0.5">
                <p className="font-semibold text-base text-center">Paulo City</p>
                <CardDescription className="text-center">Location</CardDescription>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default SpeedTestCard;
