"use client";
import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import useAboutData from "@/hooks/about-data";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
// import PropagateLoader from "react-spinners/PropagateLoader";
import { Skeleton } from "@/components/ui/skeleton";

const AboutPage = () => {
  const { data, isLoading } = useAboutData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>QuecManager</CardTitle>
        <CardDescription>
          What is QuecManager and how it can help you.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Device Technical Details</CardTitle>
            <CardDescription>
              View technical details of your device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span>Modem Manufacturer</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.manufacturer || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Modem Model</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.model || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Firmware Revision</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.firmwareVersion || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>LTE Category</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>CAT-{data?.lteCategory || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Active Phone Number</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.phoneNum || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Active IMSI</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.imsi || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Active ICCID</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.iccid || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>IMEI</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.imei || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Current Device IP</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.currentDeviceIP || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>LAN Gateway</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.lanGateway || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>WWAN IPv4</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.wwanIPv4 || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>WWAN IPv6</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.wwanIPv6 || "N/A"}</>
                    )}
                  </span>
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About Us</CardTitle>
            <CardDescription>Who we are and what we do.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2">
              <h1 className="text-xl font-bold antialiased">QuecManager</h1>
              <p className="text-md font-medium antialiased">
                QuecManager began as 'Simple Admin,' a straightforward GUI in
                the RGMII toolkit. Over time, it’s evolved into a comprehensive
                dashboard with powerful features for managing cellular modems.
                While we’ve moved beyond the 'Simple' name, our goal remains the
                same: providing a clean, easy-to-use interface that makes
                advanced modem management feel straightforward and accessible.
              </p>
            </div>

            <div>
              <h1 className="text-xl font-bold antialiased">Thanks to</h1>
              <ul className="list-disc list-inside text-md font-medium antialiased">
                <li>
                  RGMII Toolkit, Documentation, and Backend
                  <a
                    href="https://github.com/iamromulan"
                    target="_blank"
                    className="text-primary font-semibold ml-2"
                  >
                    iamromulan
                  </a>
                </li>
                <li>
                  Simple Admin 2.0 and QuecManager GUI
                  <a
                    href="https://github.com/dr-dolomite"
                    target="_blank"
                    className="text-primary font-semibold ml-2"
                  >
                    dr-dolomite
                  </a>
                </li>
                <li>
                  Original Simple Admin
                  <a
                    href="https://github.com/aesthernr"
                    target="_blank"
                    className="text-primary font-semibold ml-2"
                  >
                    aesthernr
                  </a>
                </li>
                <li>
                  Original Socat Bridge
                  <a
                    href="https://github.com/natecarlson"
                    target="_blank"
                    className="text-primary font-semibold ml-2"
                  >
                    natecarlson
                  </a>
                </li>
                <li>Wutang Clan</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p>QuecManager © 2024 - For Personal Use Only. All rights reserved.</p>
      </CardFooter>
    </Card>
  );
};

export default AboutPage;
