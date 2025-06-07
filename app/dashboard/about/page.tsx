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
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

const AboutPage = () => {
  const { data, isLoading } = useAboutData();
  const [hideSensitiveData, setHideSensitiveData] = React.useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>QuecManager</CardTitle>
        <CardDescription>

          <div className="grid xl:gap-y-10 gap-y-8 gap-4">
            <div className="grid gap-4">
              <div className="flex flex-row justify-between items-center">
                <div className="flex flex-row items-center gap-x-2">
                  What is QuecManager and how it can help you.
                </div>
                <div className="flex flex-row items-center gap-x-2">
                  <Button onClick={() => setHideSensitiveData((prev) => !prev)}>
                    { hideSensitiveData ? <Eye className="xl:size-6 size-5" /> : <EyeOff className="xl:size-6 size-5" /> }
                      <span className="hidden md:block">{hideSensitiveData ? 'Show' : 'Hide' } Sensitive Data</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
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
              <div className="grid md:gap-2 gap-4">
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>Modem Manufacturer</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.manufacturer || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>Modem Model</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.model || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>LTE 3GPP Release Version</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>Release {data?.LTE3GppRel || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>NR5G 3GPP Release Version</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>Release {data?.NR3GppRel || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>Firmware Revision</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.firmwareVersion || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>LTE Category</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>CAT-{data?.lteCategory || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>Active Phone Number</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : hideSensitiveData ? (
                      <i>{data?.phoneNum?.replace(/[0-9]/g,'0')} (Masked)</i>
                    ) : (
                      <>{data?.phoneNum || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>Active IMSI</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : hideSensitiveData ? (
                      <i>{data?.imsi?.replace(/[0-9a-zA-Z]/g,'X')} (Masked)</i>
                    ) : (
                      <>{data?.imsi || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>Active ICCID</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : hideSensitiveData ? (
                      <i>{data?.iccid?.replace(/[0-9a-zA-Z]/g,'X')} (Masked)</i>
                    ) : (
                      <>{data?.iccid || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>IMEI</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : hideSensitiveData ? (
                      <i>{data?.imei?.replace(/[0-9a-zA-Z]/g,'X')} (Masked)</i>
                    ) : (
                      <>{data?.imei || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>Current Device IP</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.currentDeviceIP || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>LAN Gateway</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.lanGateway || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>WWAN IPv4</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : hideSensitiveData ? (
                        <i>127.0.0.1 (Masked)</i>
                    ) : (
                      <>{data?.wwanIPv4 || "N/A"}</>
                    )}
                  </span>
                </div>
                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>WWAN IPv6</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : hideSensitiveData ? (
                      <i>::1  (Masked)</i>
                    ) : (
                      <>{data?.wwanIPv6 || "N/A"}</>
                    )}
                  </span>
                </div>

                <div className="flex md:flex-row flex-col md:items-center justify-between">
                  <span>Device Uptime</span>
                  <span className="font-semibold max-w-32 md:max-w-full truncate">
                    {isLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : (
                      <>{data?.deviceUptime || "N/A"}</>
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
                QuecManager is a modern dashboard for managing and monitoring
                cellular modems, evolved from its roots as 'Simple Admin' in the
                RGMII toolkit. The application provides real-time insights into
                signal metrics, carrier aggregation, network addressing, and
                band-specific performance while offering intuitive controls for
                modem configuration. With its comprehensive feature set and
                clean interface, QuecManager transforms complex cellular
                technology into an accessible experience for both technical
                users and those simply looking to optimize their connectivity.
                Our mission remains focused on delivering powerful monitoring
                and management capabilities without sacrificing usability or
                visual clarity.
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
                  Simple Admin 2.0 and QuecManager Scripts & GUI
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
