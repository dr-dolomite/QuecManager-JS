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

interface CellularInformationProps {
  data: HomeData | null;
  isLoading: boolean;
}

const CellularInformation = ({ data, isLoading }: CellularInformationProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cellular Information</CardTitle>
        <CardDescription>Cellular network information</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex flex-row justify-between text-md">
          <p>Cell ID</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[80px]" />
          ) : (
            <p className="font-bold">{data?.cellularInfo.cellId}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>TAC</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[80px]" />
          ) : (
            <p className="font-bold">{data?.cellularInfo.trackingAreaCode}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Physical Cell IDs</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[80px]" />
          ) : (
            <p className="font-bold">{data?.cellularInfo.physicalCellId}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>E/ARFCN</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[80px]" />
          ) : (
            <p className="font-bold">{data?.cellularInfo.earfcn}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Mobile Country Code</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[80px]" />
          ) : (
            <p className="font-bold">{data?.cellularInfo.mcc}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Mobile Network Code</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[80px]" />
          ) : (
            <p className="font-bold">{data?.cellularInfo.mnc}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Antenna Signal Quality</p>
          {isLoading ? (
            <Skeleton className="h-6 w-[80px]" />
          ) : (
            <Badge
              className={`
                font-bold ${
                  data?.cellularInfo.signalQuality &&
                  parseInt(data?.cellularInfo.signalQuality) > 80
                    ? "bg-emerald-500 hover:bg-emerald-800"
                    : data?.cellularInfo.signalQuality &&
                      parseInt(data?.cellularInfo.signalQuality) > 40
                    ? "bg-orange-500 hover:bg-orange-800"
                    : "bg-rose-500 hover:bg-rose-800"
                }`}
            >
              {data?.cellularInfo.signalQuality}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CellularInformation;
