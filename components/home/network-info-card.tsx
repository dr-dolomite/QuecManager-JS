import React from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeData } from "@/types/types";

interface NetworkInfoCardProps {
  data: HomeData | null;
  isLoading: boolean;
}

const NetworkInfoCard = ({ data, isLoading }: NetworkInfoCardProps) => {
  return (
    <Card className="md:py-6 md:px-6 py-6 px-4 ">
      <div className="grid md:grid-cols-5 grid-cols-1 grid-flow-row gap-4">
        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Public IPv4 Address</h2>
          <p>
            {isLoading ? (
              <Skeleton className="h-4 w-[100px]" />
            ) : (
              data?.networkAddressing.publicIPv4
            )}
          </p>
        </div>

        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Cellular IPv4 Address</h2>
          <p>
            {isLoading ? (
              <Skeleton className="h-4 w-[100px]" />
            ) : (
              data?.networkAddressing.cellularIPv4
            )}
          </p>
        </div>

        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Cellular IPv6 Address</h2>
          <p>
            {isLoading ? (
              <Skeleton className="h-4 w-[100px]" />
            ) : (
              data?.networkAddressing.cellularIPv6
            )}
          </p>
        </div>

        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Carrier Primary DNS</h2>
          <p>
            {isLoading ? (
              <Skeleton className="h-4 w-[100px]" />
            ) : (
              data?.networkAddressing.carrierPrimaryDNS
            )}
          </p>
        </div>

        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Carrier Secondary DNS</h2>
          <p>
            {isLoading ? (
              <Skeleton className="h-4 w-[100px]" />
            ) : (
              data?.networkAddressing.carrierSecondaryDNS
            )}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default NetworkInfoCard;
