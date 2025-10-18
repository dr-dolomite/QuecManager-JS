import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CircleArrowDownIcon, CircleArrowUpIcon, Info } from "lucide-react";
import {
  HiOutlineStatusOnline,
  HiOutlineStatusOffline,
  HiOutlineSwitchHorizontal,
} from "react-icons/hi";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "../ui/separator";
import { HomeData } from "@/types/types";
import { getAccessTech } from "@/constants/home/index";

interface SummaryCardProps {
  data: HomeData | null;
  isLoading: boolean;
  dataConnectionState: string;
  connectionStateLoading: boolean;
  bytesSent: string;
  bytesReceived: string;
  hideSensitiveData: boolean;
}

const SummaryCardComponent = ({
  data,
  isLoading,
  dataConnectionState,
  connectionStateLoading,
  bytesSent,
  bytesReceived,
  hideSensitiveData,
}: SummaryCardProps) => {
  // Calculate temperature progress (0-100°C scale)
  const getTemperatureProgress = (temp: string | undefined): number => {
    if (!temp) return 0;
    const tempValue = parseInt(temp.replace("°C", ""));
    return Math.min(tempValue, 100);
  };

  // Get temperature color based on value
  const getTemperatureColor = (temp: string | undefined): string => {
    if (!temp) return "bg-gray-500";
    const tempValue = parseInt(temp.replace("°C", ""));
    if (tempValue > 65) return "bg-red-600";
    if (tempValue > 50) return "bg-orange-600";
    return "bg-green-600";
  };

  // Check if operator is connected
  const isOperatorConnected = (operatorState: string | undefined): boolean => {
    return operatorState === "Registered" || operatorState === "Roaming";
  };
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Device and SIM Information</CardTitle>
        <CardDescription>
          Summary of SIM card and data connection status
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {/* Device Temperature */}
        <div className="flex items-center justify-between">
          <p>Device Temperature</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <div className="flex items-center">
              <Progress
                value={getTemperatureProgress(
                  data?.connection.modemTemperature
                )}
                className={`w-24 mr-2 [&>div]:${getTemperatureColor(
                  data?.connection.modemTemperature
                )}`}
              />
              <p className="ml-2 font-bold">
                {data?.connection.modemTemperature}
              </p>
            </div>
          )}
        </div>

        {/* Data Usage */}
        <div className="flex items-center justify-between">
          <p>Data Usage</p>
          <div className="flex items-center">
            <div className="flex items-center">
              <CircleArrowDownIcon className="w-4 h-4 mr-1 text-green-500" />
              {isLoading ? (
                <Skeleton className="h-4 w-[60px]" />
              ) : (
                <p className="font-bold">{bytesReceived}</p>
              )}
            </div>
            <span className="mx-2.5">|</span>
            <div className="flex items-center">
              <CircleArrowUpIcon className="w-4 h-4 mr-1 text-purple-500" />
              {isLoading ? (
                <Skeleton className="h-4 w-[60px]" />
              ) : (
                <p className="font-bold">{bytesSent}</p>
              )}
            </div>
          </div>
        </div>

        {/* Internet Connection */}
        <div className="flex items-center justify-between">
          <p>Internet Connection</p>
          {connectionStateLoading ? (
            <Skeleton className="h-6 w-[100px]" />
          ) : (
            <div className="flex items-center gap-x-1">
              <Tooltip>
                <TooltipTrigger>
                  {data?.connection.functionalityState == "Full Functionality" ? (
                    <HiOutlineStatusOnline className="w-5 h-5 mr-0.5 text-green-500" />
                  ) : (
                    <HiOutlineStatusOffline className="w-5 h-5 mr-0.5 text-red-500" />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{data?.connection.functionalityState}</p>
                </TooltipContent>
              </Tooltip>
              <p className="font-bold">{dataConnectionState || "Unknown"}</p>
            </div>
          )}
        </div>

        <Separator className="my-1 w-full" />

        {/* SIM Slot */}
        <div className="flex items-center justify-between">
          <p>SIM Slot</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[50px]" />
          ) : (
            <div className="flex items-center">
              <HiOutlineSwitchHorizontal className="w-4 h-4 mr-1" />
              <p className="font-bold">SIM {data?.simCard.slot}</p>
            </div>
          )}
        </div>

        {/* SIM Card State */}
        <div className="flex items-center justify-between">
          <p>SIM Card State</p>
          {isLoading ? (
            <Skeleton className="h-6 w-[100px]" />
          ) : (
            <p className="font-bold">{data?.simCard.state}</p>
          )}
        </div>

        <Separator className="my-1 w-full" />

        {/* Network Type */}
        <div className="flex items-center justify-between">
          <p>Network Type</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <TooltipProvider>
              <div className="flex items-center gap-x-1">
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 mr-0.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">
                      {data?.connection.accessTechnology
                        ? getAccessTech(data.connection.accessTechnology)
                        : "Unknown"}
                    </p>
                  </TooltipContent>
                </Tooltip>
                <p className="font-bold">{data?.connection.networkType}</p>
              </div>
            </TooltipProvider>
          )}
        </div>

        {/* Cell ID */}
        <div className="flex items-center justify-between">
          <p>Cell ID</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[80px]" />
          ) : (
            <p className="font-bold">{data?.cellularInfo.cellId || "N/A"}</p>
          )}
        </div>

        {/* Operator */}
        <div className="flex items-center justify-between">
          <p>Operator</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <TooltipProvider>
              <div className="flex items-center gap-x-1">
                <Tooltip>
                  <TooltipTrigger>
                    {/* {isOperatorConnected(data?.connection.operatorState) ? (
                      <HiOutlineStatusOnline className="w-4 h-4 mr-0.5 text-green-500" />
                    ) : (
                      <HiOutlineStatusOffline className="w-4 h-4 mr-0.5 text-red-500" />
                    )} */}
                    <Info className="w-4 h-4 mr-0.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{data?.connection.operatorState}</p>
                  </TooltipContent>
                </Tooltip>
                <p className="font-bold">{data?.simCard.provider}</p>
              </div>
            </TooltipProvider>
          )}
        </div>

        {/* APN */}
        <div className="flex items-center justify-between">
          <p>APN</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <p className="font-bold">{data?.connection.apn}</p>
          )}
        </div>

        <Separator className="my-1 w-full" />

        {/* Phone Number */}
        <div className="flex items-center justify-between">
          <p>Phone Number</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : hideSensitiveData ? (
            <div className="border-none bg-gray-600 rounded-md h-5 md:w-36 w-24" />
          ) : (
            <p className="font-bold">{data?.simCard.phoneNumber}</p>
          )}
        </div>

        {/* IMSI */}
        <div className="flex items-center justify-between">
          <p>IMSI</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : hideSensitiveData ? (
            <div className="border-none bg-gray-600 rounded-md h-5 md:w-36 w-24" />
          ) : (
            <p className="font-bold">{data?.simCard.imsi}</p>
          )}
        </div>

        {/* ICCID */}
        <div className="flex items-center justify-between">
          <p>ICCID</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : hideSensitiveData ? (
            <div className="border-none bg-gray-600 rounded-md h-5 md:w-36 w-24" />
          ) : (
            <p className="font-bold">{data?.simCard.iccid}</p>
          )}
        </div>

        {/* IMEI */}
        <div className="flex items-center justify-between">
          <p>IMEI</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : hideSensitiveData ? (
            <div className="border-none bg-gray-600 rounded-md h-5 md:w-36 w-24" />
          ) : (
            <p className="font-bold">{data?.simCard.imei}</p>
          )}
        </div>

        <Separator className="my-1 w-full" />

        {/* Carrier Aggregation */}
        <div className="flex items-center justify-between">
          <p>Carrier Aggregation</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : (
            <p className="font-bold">{data?.dataTransmission.carrierAggregation}</p>
          )}
        </div>

        {/* MIMO Layers */}
        <div className="flex items-center justify-between">
          <p>Active MIMO</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : (
            <p className="font-bold">{data?.dataTransmission.mimoLayers}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SummaryCardComponent;
