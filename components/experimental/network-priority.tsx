"use client";
import React, { useState, useEffect } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GripHorizontalIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AiFillSignal } from "react-icons/ai";
import { atCommandSender } from "@/utils/at-command";
import { Spinner } from "../ui/spinner";

interface NetworkItem {
  id: string;
  name: string;
}

interface ATCommandResponse {
  command: string;
  response: string;
  status: string;
}

const NetworkPriorityComponent = () => {
  const [fetching, setFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // const [ratPriorityArray, setRatPriorityArray] = useState<string[]>([]);
  const [networks, setNetworks] = useState<NetworkItem[]>([
    { id: "nr5g", name: "NR5G" },
    { id: "lte", name: "LTE" },
    { id: "wcdma", name: "WCDMA" },
  ]);
  const { toast } = useToast();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === index) return;

    const newNetworks = [...networks];
    const draggedItem = newNetworks[draggedIndex];

    // Remove dragged item
    newNetworks.splice(draggedIndex, 1);
    // Insert at new position
    newNetworks.splice(index, 0, draggedItem);

    setNetworks(newNetworks);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const getNetworkColor = (networkId: string) => {
    switch (networkId) {
      case "nr5g":
        return "bg-[#1E86FF]";
      case "lte":
        return "bg-[#00C9A7]";
      case "wcdma":
        return "bg-[#FF3D71]";
      default:
        return "bg-gray-600";
    }
  };

  const executeATCommand = async (command: string): Promise<boolean> => {
    try {
      console.log("Executing AT command:", command);
      const response = await atCommandSender(command);

      if (response.status === "error" || response.status === "timeout") {
        throw new Error(
          response.response || "Command execution failed"
        );
      }

      return response.status === "success";
    } catch (error) {
      console.error("AT command execution error:", error);
      throw error;
    }
  };

  // Fetch the current RAT priority from the device using command set 10 from fetch_data.sh
  const fetchCurrentRATPriority = async () => {
    try {
      setFetching(true);
      const ratResponse = await fetch(
        "/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=10"
      );

      const ratData: ATCommandResponse[] = await ratResponse.json();

      if (ratData && ratData.length > 0 && ratData[0].status === "success") {
        const response = ratData[0].response;

        // Parse the response to extract RAT order
        // Expected format: +QNWPREFCFG: "rat_acq_order",NR5G:LTE:WCDMA
        const match = response.match(/"rat_acq_order"[,:]\s*([A-Z0-9:]+)/i);

        if (match && match[1]) {
          const ratOrder = match[1].split(":");

          // Map RAT names to network items and reorder
          const orderedNetworks: NetworkItem[] = [];
          const networkMap: { [key: string]: NetworkItem } = {
            NR5G: { id: "nr5g", name: "NR5G" },
            LTE: { id: "lte", name: "LTE" },
            WCDMA: { id: "wcdma", name: "WCDMA" },
          };

          // Build ordered list based on device response
          ratOrder.forEach((rat) => {
            const normalizedRat = rat.toUpperCase().trim();
            if (networkMap[normalizedRat]) {
              orderedNetworks.push(networkMap[normalizedRat]);
            }
          });

          // Add any missing networks at the end
          Object.values(networkMap).forEach((network) => {
            if (!orderedNetworks.find((n) => n.id === network.id)) {
              orderedNetworks.push(network);
            }
          });

          setNetworks(orderedNetworks);
        } else {
          console.error("Failed to parse RAT order from response:", response);
        }
      } else {
        console.error("Invalid or error response from device");
      }
    } catch (error) {
      console.error("Error fetching RAT priority:", error);
    } finally {
      setFetching(false);
    }
  };

  // Saving function
  // Get the current order from `networks` state and construct the AT command
  const saveRATPriority = async () => {
    if (isSaving) return; // Prevent multiple simultaneous saves
    setIsSaving(true);
    if (networks.length === 0) return;
    const ratOrder = networks
      .map((network) => {
        switch (network.id) {
          case "nr5g":
            return "NR5G";
          case "lte":
            return "LTE";
          case "wcdma":
            return "WCDMA";
          default:
            return "";
        }
      })
      .filter((rat) => rat !== "")
      .join(":");
    const atCommand = `AT+QNWPREFCFG="rat_acq_order",${ratOrder}`;
    try {
      const success = await executeATCommand(atCommand);
      if (success) {
        toast({
          title: "RAT priority saved",
          description: "The new network priority has been saved.",
        });
      }

      // Wait a moment before sending reboot command
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const rebootDevice = await executeATCommand("AT+CFUN=1,1");
      if (rebootDevice) {
        toast({
          title: "Device reboot command sent",
          description: "The device is rebooting to apply changes.",
        });
      } else {
        console.error("Failed to send device reboot command");
      }
    } catch (error) {
      console.error("Error saving RAT priority:", error);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchCurrentRATPriority();
  }, []);

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Network Priority</CardTitle>
          <CardDescription>
            Manage and prioritize network mode (RAT) for optimal performance.
            Requires a device reboot to apply changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetching ? (
            <div className="grid space-y-2 w-full">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              {networks.map((network, index) => (
                <Card
                  key={network.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center justify-between px-4 py-3 border-none bg-background rounded-xl cursor-move hover:bg-accent transition-all duration-200 drop-shadow-lg ${
                    draggedIndex === index ? "opacity-50 scale-95" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GripHorizontalIcon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex items-center gap-x-3 ml-2">
                      <div
                        className={`rounded-xl size-8 p-1 ${getNetworkColor(
                          network.id
                        )} flex justify-center items-center`}
                      >
                        <AiFillSignal className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-medium">{network.name}</span>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Priority {index + 1}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t py-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={fetching || isSaving || networks.length === 0}>
                {isSaving ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <SaveIcon className="h-4 w-4" />
                )}
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Do you want to continue?</AlertDialogTitle>
                <AlertDialogDescription>
                  Changes to network priority will take effect after the device
                  reboots. Do you want to reboot now?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={fetching || isSaving}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={saveRATPriority}
                  disabled={fetching || isSaving}
                >
                  <RotateCcwIcon className="h-4 w-4" />
                  Reboot Now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
};

export default NetworkPriorityComponent;
