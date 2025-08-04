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

interface SimDataProps {
  data: HomeData | null;
  isLoading: boolean;
  hideSensitiveData: boolean;
}

const SimData = ({ data, isLoading, hideSensitiveData }: SimDataProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sim Card</CardTitle>
        <CardDescription>Sim card information</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex flex-row justify-between text-md">
          <p>Sim Card Slot in Use</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[50px]" />
          ) : (
            <p className="font-bold">{data?.simCard.slot}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Sim Card State</p>
          {isLoading ? (
            <Skeleton className="h-6 w-[100px]" />
          ) : (
            <Badge
              className={`font-bold ${
                data?.simCard.state === "Inserted"
                  ? "bg-emerald-500 hover:bg-emerald-800"
                  : "bg-rose-500 hover:bg-rose-800"
              }`}
            >
              {data?.simCard.state}
            </Badge>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Provider</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <p className="font-bold">{data?.simCard.provider}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Phone Number</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : hideSensitiveData ? (
            <div className="border-none bg-gray-600 rounded-md h-5 md:w-36 w-24" />
          ) : (
            <p className="font-bold">{data?.simCard.phoneNumber}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>IMSI</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : hideSensitiveData ? (
            <div className="border-none bg-gray-600 rounded-md h-5 md:w-36 w-24" />
          ) : (
            <p className="font-bold">{data?.simCard.imsi}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>ICCID</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : hideSensitiveData ? (
            <div className="border-none bg-gray-600 rounded-md h-5 md:w-36 w-24" />
          ) : (
            <p className="font-bold">{data?.simCard.iccid}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>IMEI</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : hideSensitiveData ? (
            <div className="border-none bg-gray-600 rounded-md h-5 md:w-36 w-24" />
          ) : (
            <p className="font-bold">{data?.simCard.imei}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SimData;
