"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HomeData } from "@/types/types";
import { getAccessTech } from "@/constants/home/index";

interface ConnectionProps {
  data: HomeData | null;
  isLoading: boolean;
  dataConnectionState: string;
  connectionStateLoading: boolean;
}

const Connection = ({
  data,
  isLoading,
  dataConnectionState,
  connectionStateLoading,
}: ConnectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection</CardTitle>
        <CardDescription>Connection information</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex flex-row justify-between text-md">
          <div>APN</div>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <div className="font-bold">{data?.connection.apn}</div>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <div>Operator State</div>
          {isLoading ? (
            <Skeleton className="h-6 w-[100px]" />
          ) : (
            <Badge
              className={`font-bold ${
                data?.connection.operatorState === "Unknown" ||
                data?.connection.operatorState === "Denied" || data?.connection.operatorState === "Not Registered"
                  ? "bg-rose-500 hover:bg-rose-800"
                  : "bg-emerald-500 hover:bg-emerald-800"
              }`}
            >
              {data?.connection.operatorState}
            </Badge>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <div>Functionality State</div>
          {isLoading ? (
            <Skeleton className="h-6 w-[100px]" />
          ) : (
            <Badge
              className={`font-bold ${
                data?.connection.functionalityState === "Enabled"
                  ? "bg-emerald-500 hover:bg-emerald-800"
                  : "bg-rose-500 hover:bg-rose-800"
              }`}
            >
              {data?.connection.functionalityState}
            </Badge>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <div>Data Connection State</div>
          {connectionStateLoading ? (
            <Skeleton className="h-6 w-[100px]" />
          ) : (
              <Badge
                className={`font-bold ${
                  dataConnectionState === "Connected"
                    ? "bg-emerald-500 hover:bg-emerald-800"
                    : "bg-rose-500 hover:bg-rose-800"
                }`}
              >
                {dataConnectionState}
              </Badge>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <div>Network Type</div>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <div className="font-bold">{data?.connection.networkType}</div>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <div>Modem Temperature</div>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <div className="font-bold">{data?.connection.modemTemperature}</div>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <div>Access Technology</div>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <div className="font-bold">
              {data?.connection.accessTechnology
                ? getAccessTech(data.connection.accessTechnology)
                : "Unknown"}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Connection;
