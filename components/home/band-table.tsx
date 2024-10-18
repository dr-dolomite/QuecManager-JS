"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Band } from "@/types/types";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

import { useToast } from "@/hooks/use-toast";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import BandCard from "@/components/home/band-card";
import { CircleAlertIcon } from "lucide-react";

interface BandTableProps {
  isLoading: boolean;
  bands: Band[] | null;
  bandPrioState: boolean;
}


const BandTable = ({ bands, isLoading, bandPrioState }: BandTableProps) => {
  const { toast } = useToast();

  // Handler for when band priority changes - can be called from parent's handleDragEnd
  const updateBandPriority = async (newBands: Band[]) => {
    // Filter out NR5G bands and create priority string
    const lteBands = newBands
      .filter((band) => !band.bandNumber.includes("n"))
      .map((band) => band.bandNumber.replace("B", ""))
      .join(":");

    try {
      const command = `AT+QNWCFG="lte_band_priority",${lteBands}`;
      const response = await fetch("/api/at-handler", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        throw new Error("Failed to set band priority");
      }

      toast({
        title: "Band Priority Updated",
        description:
          "The LTE band priority has been successfully updated. Changes will apply after reboot.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update band priority. Please try again.",
      });
      // You might want to trigger a refresh or reset from the parent component
    }
  };

  if (isLoading) {
    return (
      <>
      <div className="hidden lg:block">
        <Card className="p-6 grid gap-4">
          {bands && (
            <SortableContext
              items={bands}
              strategy={verticalListSortingStrategy}
            >
              {bands.map((band) => (
                <BandCard key={band.id} {...band} />
              ))}
            </SortableContext>
          )}

          <CardFooter className="w-full p-6 flex flex-col gap-1 items-center justify-center">
            <CardTitle className="text-lg font-bold flex flex-row items-center">
              Band Priority -
              {bandPrioState ? (
                <Badge className="ml-2 bg-emerald-500 hover:bg-emerald-800">
                  Active
                </Badge>
              ) : (
                <Badge className="ml-2 bg-rose-500 hover:bg-rose-800">
                  Inactive
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-sm">
              Switch the order of LTE bands to prioritize them.
            </CardDescription>
            <CardDescription className="text-sm mt-2 italic flex flex-row items-center text-orange-500">
              <CircleAlertIcon className="w-4 h-4 mr-1" />
              Note that the priority will still highly depend on the network
              conditions. Applied next boot.
            </CardDescription>
          </CardFooter>
        </Card>
      </div>


        <div className="flex items-center justify-center mx-auto lg:hidden">
          <Carousel className="w-full max-w-xs">
            <CarouselContent>
              <CarouselItem>
                <div className="p-0.5">
                  <Card>
                    <CardContent className="grid gap-2 p-2">
                      <div className="flex justify-between">
                        <p>Band</p>
                        <p>
                          <Skeleton className="w-16 h-4" />
                        </p>
                      </div>

                      <div className="flex justify-between">
                        <p>E/ARFCN</p>
                        <p>
                          <Skeleton className="w-16 h-4" />
                        </p>
                      </div>

                      <div className="flex justify-between">
                        <p>Bandwidth</p>
                        <p>
                          <Skeleton className="w-16 h-4" />
                        </p>
                      </div>

                      <div className="flex justify-between">
                        <p>PCI</p>
                        <p>
                          <Skeleton className="w-16 h-4" />
                        </p>
                      </div>

                      <div className="flex justify-between">
                        <p>RSRP</p>
                        <p>
                          <Skeleton className="w-32 h-4" />
                        </p>
                      </div>

                      <div className="flex justify-between">
                        <p>RSRQ</p>
                        <p>
                          <Skeleton className="w-32 h-4" />
                        </p>
                      </div>

                      <div className="flex justify-between">
                        <p>SINR</p>
                        <p>
                          <Skeleton className="w-32 h-4" />
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="hidden lg:block">
        <Card className="p-6 grid gap-4">
          {bands && (
            <SortableContext
              items={bands}
              strategy={verticalListSortingStrategy}
            >
              {bands.map((band: Band) => (
                <BandCard key={band.id} {...band} />
              ))}
            </SortableContext>
          )}
          <CardFooter className="w-full p-6 flex flex-col gap-1 items-center justify-center">
            <CardTitle className="text-lg font-bold flex flex-row items-center">
              Band Priority -
              {bandPrioState ? (
                <Badge className="ml-2 bg-emerald-500 hover:bg-emerald-800">
                  Active
                </Badge>
              ) : (
                <Badge className="ml-2 bg-rose-500 hover:bg-rose-800">
                  Inactive
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-sm">
              Switch the order of LTE bands to prioritize them.
            </CardDescription>
            <CardDescription className="text-sm mt-2 italic flex flex-row items-center text-orange-500">
              <CircleAlertIcon className="w-4 h-4 mr-1" />
              Note that the priority will still highly depend on the network
              conditions. Applied next boot.
            </CardDescription>
          </CardFooter>
        </Card>
      </div>

      <div className="flex items-center justify-center mx-auto lg:hidden">
        <Carousel className="w-full max-w-xs">
          <CarouselContent>
            {bands?.map((band) => (
              <CarouselItem key={band.id}>
                <div className="p-0.5">
                  <Card>
                    <CardContent className="grid gap-2 p-6 aspect-square">
                      <div className="flex justify-between">
                        <p>Band</p>
                        <p>{band.bandNumber}</p>
                      </div>

                      <div className="flex justify-between">
                        <p>E/ARFCN</p>
                        <p>{band.earfcn}</p>
                      </div>

                      <div className="flex justify-between">
                        <p>Bandwidth</p>
                        <p>{band.bandwidth}</p>
                      </div>

                      <div className="flex justify-between">
                        <p>PCI</p>
                        <p>{band.pci}</p>
                      </div>

                      <div className="flex justify-between">
                        <p>RSRP</p>
                        <Badge
                          className={
                            parseInt(band.rsrp) >= -80
                              ? "bg-emerald-500 hover:bg-emerald-800"
                              : parseInt(band.rsrp) >= -100
                              ? "bg-orange-500 hover:bg-orange-800"
                              : "bg-rose-500 hover:bg-rose-800"
                          }
                        >
                          {band.rsrp} dBm
                        </Badge>
                      </div>

                      <div className="flex justify-between">
                        <p>RSRQ</p>
                        <Badge
                          className={
                            parseInt(band.rsrq) <= 10
                              ? "bg-emerald-500 hover:bg-emerald-800"
                              : parseInt(band.rsrq) <= 20
                              ? "bg-orange-500 hover:bg-orange-800"
                              : "bg-rose-500 hover:bg-rose-800"
                          }
                        >
                          {band.rsrq} dB
                        </Badge>
                      </div>

                      <div className="flex justify-between">
                        <p>SINR</p>
                        <Badge
                          className={
                            parseInt(band.sinr) >= 20
                              ? "bg-emerald-500 hover:bg-emerald-800"
                              : parseInt(band.sinr) >= 0
                              ? "bg-orange-500 hover:bg-orange-800"
                              : "bg-rose-500 hover:bg-rose-800"
                          }
                        >
                          {band.sinr} dB
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </>
  );
};

export default BandTable;
