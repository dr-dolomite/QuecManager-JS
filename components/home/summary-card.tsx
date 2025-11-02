"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeftRightIcon,
  CircleArrowDownIcon,
  CircleArrowUpIcon,
  Info,
  Loader2,
  Repeat2Icon,
} from "lucide-react";
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
import { HomeData, Band } from "@/types/types";
import { getAccessTech } from "@/constants/home/index";
import { atCommandSender } from "@/utils/at-command";
import { useToast } from "@/hooks/use-toast";
import { useDistanceCalculation } from "@/hooks/use-distance-calculation";

// Import and use the WebSocket data context, setup the type inteface for the prop
import { useWebSocketData } from "@/components/hoc/protected-route";

interface SummaryCardProps {
  data: HomeData | null;
  isLoading: boolean;
  websocketData?: any;
  dataConnectionState: string;
  connectionStateLoading: boolean;
  bytesSent: string;
  bytesReceived: string;
  hideSensitiveData: boolean;
  bands: Band[] | null;
  onDataRefresh?: () => void;
}

const SummaryCardComponent = ({
  data,
  isLoading,
  websocketData: propWebsocketData,
  dataConnectionState,
  connectionStateLoading,
  bytesSent,
  bytesReceived,
  hideSensitiveData,
  bands,
  onDataRefresh,
}: SummaryCardProps) => {
  const { toast } = useToast();
  const [isSwappingDialog, setIsSwappingDialog] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  
  // State to persist last known uptime data
  const [lastUptimeData, setLastUptimeData] = useState<any>(null);
  const [lastDeviceUptimeData, setLastDeviceUptimeData] = useState<any>(null);
  
  // Use prop if provided, otherwise fall back to context

  const contextWebsocketData = useWebSocketData();
  const websocketData = propWebsocketData || contextWebsocketData;
  
  // Use distance calculation hook
  const { lteDistance, nrDistance, isUnitLoading } = useDistanceCalculation(
    data?.timeAdvance.lteTimeAdvance,
    data?.timeAdvance.nrTimeAdvance
  );

  // Update last known uptime data when new data arrives
  useEffect(() => {
    // Should probably consider changing "type" to "channel" or vice versa on the other items for standardization
    if (websocketData?.type === 'uptime') {
      setLastUptimeData(websocketData);
    }
    // Should probably consider changing "type" to "channel" or vice versa on the other items for standardization
    if (websocketData?.type === 'device_uptime') {
      setLastDeviceUptimeData(websocketData);
    }
  }, [websocketData]);

  // Use last known data to prevent flickering
  const uptimeData = lastUptimeData;
  const deviceUptimeData = lastDeviceUptimeData;

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

  // Calculate total bandwidth from all active bands
  const calculateTotalBandwidth = (): string => {
    if (!bands || bands.length === 0) return "N/A";

    let totalMHz = 0;
    bands.forEach((band) => {
      const bandwidthStr = band.bandwidth;
      // Extract numeric value from bandwidth string (e.g., "20 MHz" -> 20)
      const match = bandwidthStr.match(/(\d+(\.\d+)?)/);
      if (match) {
        totalMHz += parseFloat(match[1]);
      }
    });

    return `${totalMHz} MHz`;
  };

  // Handle SIM slot switching
  const handleSimSwap = async () => {
    setIsSwapping(true);

    try {
      // Step 1: Get current SIM slot
      const currentSlotResponse = await atCommandSender("AT+QUIMSLOT?");

      if (currentSlotResponse.status !== "success") {
        throw new Error("Failed to get current SIM slot");
      }

      // Extract slot number from response
      // Response format: +QUIMSLOT: 1 or +QUIMSLOT: 2
      const slotMatch =
        currentSlotResponse.response.match(/\+QUIMSLOT:\s*(\d+)/);

      if (!slotMatch) {
        throw new Error("Could not determine current SIM slot");
      }

      const currentSlot = parseInt(slotMatch[1]);
      const newSlot = currentSlot === 1 ? 2 : 1;

      toast({
        title: "Switching SIM Slot",
        description: `Switching from SIM ${currentSlot} to SIM ${newSlot}...`,
      });

      // Step 2: Switch to the other slot
      const switchCommand = `AT+QUIMSLOT=${newSlot}`;
      const switchResponse = await atCommandSender(switchCommand);

      if (switchResponse.status !== "success") {
        throw new Error("Failed to switch SIM slot");
      }

      toast({
        title: "SIM Slot Switched",
        description: `Successfully switched to SIM ${newSlot}. Reconnecting to network...`,
      });

      // Step 3: Wait 3 seconds then disconnect from network
      await new Promise((resolve) => setTimeout(resolve, 3000));

      await atCommandSender("AT+COPS=2");

      // Step 4: Wait 2 seconds then reconnect to network
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await atCommandSender("AT+COPS=0");

      toast({
        title: "Network Reconnected",
        description: "The device has been reconnected to the network",
      });

      // Step 5: Refresh data after 3 seconds
      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (onDataRefresh) {
        onDataRefresh();
      }

      setIsSwappingDialog(false);
    } catch (error) {
      console.error("Error swapping SIM slot:", error);
      toast({
        variant: "destructive",
        title: "SIM Swap Failed",
        description:
          error instanceof Error ? error.message : "Failed to swap SIM slot",
      });
    } finally {
      setIsSwapping(false);
    }
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
                  <Info className="w-4 h-4 mr-0.5" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{data?.connection.functionalityState}</p>
                </TooltipContent>
              </Tooltip>
              <p className="font-bold">{dataConnectionState || "Unknown"}</p>
            </div>
          )}
        </div>

        {/* Device Internet Connection Uptime */}
        <div className="flex items-center justify-between">
          <p>Connection Uptime</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <div className="flex items-center gap-x-1">
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 mr-0.5" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-bold">
                    {uptimeData?.is_connected ? "Connected" : "Disconnected"}
                  </p>
                </TooltipContent>
              </Tooltip>
              <p className="font-bold">
                {uptimeData?.uptime_formatted || "N/A"}
              </p>
            </div>
          )}
        </div>

        {/* Device Uptime */}
        <div className="flex items-center justify-between">
          <p>Device Uptime</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <p className="font-bold">
              {deviceUptimeData?.uptime_formatted || "N/A"}
            </p>
          )}
        </div>

        <Separator className="my-1 w-full" />

        {/* SIM Slot */}
        <div className="flex items-center justify-between">
          <p>SIM Slot</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[50px]" />
          ) : (
            <div className="flex items-center gap-x-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-0"
                      onClick={() => setIsSwappingDialog(true)}
                      disabled={isSwapping}
                    >
                      <ArrowLeftRightIcon className="w-4 h-4 text-blue-500 hover:text-blue-700 cursor-pointer" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Switch SIM Slot</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

        {/* Total Current Bandwidth */}
        <div className="flex items-center justify-between">
          <p>Total Current Bandwidth</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : (
            <p className="font-bold">{calculateTotalBandwidth()}</p>
          )}
        </div>

        {/* Carrier Aggregation */}
        <div className="flex items-center justify-between">
          <p>Carrier Aggregation</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : (
            <p className="font-bold">
              {data?.dataTransmission.carrierAggregation}
            </p>
          )}
        </div>

        {/* MIMO Layers */}
        <div className="flex items-center justify-between">
          <p>Active MIMO Layers</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[140px]" />
          ) : (
            <p className="font-bold">{data?.dataTransmission.mimoLayers}</p>
          )}
        </div>

        {/* LTE Cell Distance (Time Advance) */}
        <div className="flex items-center justify-between">
          <p>LTE Cell Distance</p>
          {isLoading || isUnitLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <TooltipProvider>
              <div className="flex items-center gap-x-1">
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 mr-0.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>LTE TA: {lteDistance.ta}</p>
                  </TooltipContent>
                </Tooltip>
                <p className="font-bold">{lteDistance.formatted}</p>
              </div>
            </TooltipProvider>
          )}
        </div>

        {/* NR5G Cell Distance (Time Advance) */}
        <div className="flex items-center justify-between">
          <p>NR5G Cell Distance</p>
          {isLoading || isUnitLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <TooltipProvider>
              <div className="flex items-center gap-x-1">
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 mr-0.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>NTA: {nrDistance.ta}</p>
                  </TooltipContent>
                </Tooltip>
                <p className="font-bold">{nrDistance.formatted}</p>
              </div>
            </TooltipProvider>
          )}
        </div>
      </CardContent>

      {/* SIM Swap Confirmation Dialog */}
      <Dialog open={isSwappingDialog} onOpenChange={setIsSwappingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch SIM Slot</DialogTitle>
            <DialogDescription>
              Are you sure you want to switch to{" "}
              {data?.simCard.slot === "1" ? "SIM 2" : "SIM 1"}?
            </DialogDescription>
          </DialogHeader>
          {/* <div className="space-y-4 py-4"> */}
          {/* <div className="rounded-lg bg-muted p-4">
              <p className="text-sm">
                <strong>Current SIM:</strong> SIM {data?.simCard.slot}
              </p>
              <p className="text-sm mt-2">
                <strong>Switch to:</strong> SIM{" "}
                {data?.simCard.slot === "1" ? "2" : "1"}
              </p>
            </div> */}
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-500 text-pretty text-center">
              The device will disconnect and reconnect to the network. This
              process may take up to 10 seconds.
            </p>
            {/* </div> */}
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <Button
              variant="secondary"
              onClick={() => setIsSwappingDialog(false)}
              disabled={isSwapping}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSimSwap}
              disabled={isSwapping}
              className="gap-2"
            >
              {isSwapping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Repeat2Icon className="w-4 h-4" />
              )}
              {isSwapping ? "Switching..." : "Confirm Switch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SummaryCardComponent;
