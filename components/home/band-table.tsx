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

import BandCard from "@/components/home/band-card";

interface BandTableProps {
  isLoading: boolean;
  bands: Band[] | null;
}

const BandTable = ({ bands, isLoading }: BandTableProps) => {

  if (isLoading) {
    return (
      <>
        <div className="hidden lg:block">
          <Card className="p-6 grid gap-4">
            {bands && bands.map((band) => <BandCard key={band.id} {...band} />)}

            <CardFooter className="w-full p-6 flex items-center justify-center">
              <CardDescription className="text-md">
                Currently bands connected.
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
              {bands && bands.map((band: Band) => (
                <BandCard key={band.id} {...band} />
              ))}
          <CardFooter className="w-full p-6 flex items-center justify-center">
         
            <CardDescription className="text-md">
              Current bands connected.
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
