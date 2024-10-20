"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HomeData } from '@/types/types';
import { getAccessTech } from '@/constants/home/index';

interface ConnectionProps {
  data: HomeData | null;
  isLoading: boolean;
  dataConnectionState: string;
  connectionStateLoading: boolean;
}

const Connection = ({ data, isLoading, dataConnectionState, connectionStateLoading } : ConnectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection</CardTitle>
        <CardDescription>Connection information</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex flex-row justify-between text-md">
          <p>APN</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <p className="font-bold">{data?.connection.apn}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Operator State</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <Badge
              className={`font-bold ${
                data?.connection.operatorState === "Unknown" || data?.connection.operatorState === "Denied"
                  ? "bg-rose-500 hover:bg-rose-800"
                  : "bg-emerald-500 hover:bg-emerald-800"
              }`}
            >
              {data?.connection.operatorState}
            </Badge>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Functionality State</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
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
          <p>Data Connection State</p>
          {connectionStateLoading ? (
            <Skeleton className="h-4 w-[100px]" />
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
          <p>Network Type</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <p className="font-bold">{data?.connection.networkType}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Modem Temperature</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <p className="font-bold">{data?.connection.modemTemperature}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Access Technology</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <p className="font-bold">
              {data?.connection.accessTechnology 
                ? getAccessTech(data.connection.accessTechnology)
                : "Unknown"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Connection;