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
  hideSensitiveData: boolean;
  // onRefresh?: () => void;
}

const NetworkInfoCard = ({
  data,
  isLoading,
  hideSensitiveData
  // onRefresh,
}: NetworkInfoCardProps) => {
  // const { toast } = useToast();
  // const [isReconnecting, setIsReconnecting] = useState(false);

  // const handleNetworkReconnect = async () => {
  //   setIsReconnecting(true);
  //   toast({
  //     title: "Disconnecting from network...",
  //     description: "Please wait while we refresh the network.",
  //   });

  //   try {
  //     // Disconnect from network
  //     await atCommandSender("AT+COPS=2;+COPS=0");

  //     // Wait for 2 seconds
  //     await new Promise((resolve) => setTimeout(resolve, 2000));

  //     // // Reconnect to network
  //     // toast({
  //     //   title: "Reconnecting to network...",
  //     //   description: "Please wait while we reconnect to the network.",
  //     // });
  //     // await atCommandSender("AT+COPS=0");

  //     toast({
  //       title: "Network Reconnection",
  //       description: "Network reconnection completed successfully.",
  //     });

  //     // If a refresh callback was provided, call it after a short delay
  //     // to allow time for the modem to register on the network
  //     if (onRefresh) {
  //       setTimeout(onRefresh, 5000);
  //     }
  //   } catch (error) {
  //     console.error("Network reconnection failed:", error);
  //     toast({
  //       title: "Network Reconnection",
  //       description: "Failed to reconnect to the network.",
  //       variant: "destructive",
  //     });
  //   } finally {
  //     setIsReconnecting(false);
  //   }
  // };

  return (
    <Card className="md:py-6 md:px-6 py-6 px-4 ">
      <div className="grid lg:grid-cols-5 grid-cols-1 grid-flow-row gap-4">
        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Public IPv4 Address</h2>
          <p>
            {isLoading ? (
              <Skeleton className="h-4 w-[100px]" />
            ) : hideSensitiveData ? (
              <i>127.0.0.1 (Masked)</i>
            ) : (
              data?.networkAddressing.publicIPv4
            )}
          </p>
        </div>

        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Cellular IPv4 Address</h2>
          <div className="flex items-center gap-x-2">
            <p>
              {isLoading ? (
                <Skeleton className="h-4 w-[100px]" />
              ) : hideSensitiveData ? (
                <i>127.0.0.1 (Masked)</i>
              ) : (
                data?.networkAddressing.cellularIPv4
              )}
            </p>
            {/* {data?.networkAddressing.cellularIPv4 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={handleNetworkReconnect}
                disabled={isReconnecting}
              >
                {isReconnecting ? (
                  <RotateCw className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <RotateCw className="h-4 w-4 text-primary" />
                )}
              </Button>
            )} */}
          </div>
        </div>

        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Cellular IPv6 Address</h2>
          <p>
            {isLoading ? (
              <Skeleton className="h-4 w-[100px]" />
            ) : hideSensitiveData ? (
              <i>::1 (Masked)</i>
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
          </p>
        </div>

        <div className="grid place-items-center gap-1.5">
          <h2 className="font-semibold">Carrier Secondary DNS</h2>
          <p>
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
          </p>
        </div>
      </div>
    </Card>
  );
};

export default NetworkInfoCard;
