import { useState } from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeData } from "@/types/types";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";
// import { atCommandSender } from "@/utils/at-command";
// import { useToast } from "@/hooks/use-toast";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NetworkInfoCardProps {
  data: HomeData | null;
  isLoading: boolean;
  isPublicIPLoading?: boolean;
  hideSensitiveData: boolean;
  // onRefresh?: () => void;
}

const NetworkInfoCard = ({
  data,
  isLoading,
  isPublicIPLoading = false,
  hideSensitiveData,
}: NetworkInfoCardProps) => {
  return (
    <Card className="md:py-6 md:px-6 py-6 px-4 ">
      <div className="grid lg:grid-cols-5 grid-cols-1 grid-flow-row gap-4">
        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Public IPv4 Address</h2>

          {isLoading || isPublicIPLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : hideSensitiveData ? (
            <div className="border-none bg-gray-600 rounded-md h-5 md:w-36 w-24" />
          ) : (
            <p>{data?.networkAddressing.publicIPv4}</p>
          )}
        </div>

        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Cellular IPv4 Address</h2>
          <div className="flex items-center gap-x-2">
            {isLoading ? (
              <Skeleton className="h-4 w-[100px]" />
            ) : hideSensitiveData ? (
              <div className="border-none bg-gray-600 rounded-md h-5 md:w-36 w-24" />
            ) : (
              <p>{data?.networkAddressing.cellularIPv4}</p>
            )}
          </div>
        </div>

        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Cellular IPv6 Address</h2>

          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : hideSensitiveData ? (
            <div className="border-none bg-gray-600 rounded-md h-5 md:w-36 w-24" />
          ) : (
            <p>{data?.networkAddressing.cellularIPv6}</p>
          )}
        </div>

        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Carrier Primary DNS</h2>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <TooltipProvider> 
              <Tooltip>
                <TooltipTrigger>
                  {data?.networkAddressing.carrierPrimaryDNS}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{data?.networkAddressing.rawCarrierPrimaryDNS}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Carrier Secondary DNS</h2>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {data?.networkAddressing.carrierSecondaryDNS}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{data?.networkAddressing.rawCarrierSecondaryDNS}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </Card>
  );
};

export default NetworkInfoCard;
