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
      <div className="flex items-center justify-center">
        <div className="hidden lg:block w-full">
          <Card className="p-6 grid gap-4">
            {bands && bands.map((band) => <BandCard key={band.id} {...band} />)}
            <CardFooter className="w-full p-6 flex items-center justify-center">
              <CardDescription className="text-md">
                Currently bands connected.
              </CardDescription>
            </CardFooter>
          </Card>
        </div>

          <Carousel className="lg:hidden w-full max-w-xs">
            <CarouselContent>
              <CarouselItem>
                <div className="p-1">
                  <Card>
                    <CardContent className="aspect-square p-4 gap-4 flex flex-col items-center justify-center flex-grow">
                      <div className="flex justify-between w-full">
                        <p>Band</p>
                        <div>
                          <Skeleton className="w-16 h-4" />
                        </div>
                      </div>
                      <div className="flex justify-between w-full">
                        <p>E/ARFCN</p>
                        <div>
                          <Skeleton className="w-16 h-4" />
                        </div>
                      </div>

                      <div className="flex justify-between w-full">
                        <p>Bandwidth</p>
                        <div>
                          <Skeleton className="w-16 h-4" />
                        </div>
                      </div>

                      <div className="flex justify-between w-full">
                        <p>PCI</p>
                        <div>
                          <Skeleton className="w-16 h-4" />
                        </div>
                      </div>

                      <div className="flex justify-between w-full">
                        <p>RSRP</p>
                        <div>
                          <Skeleton className="w-32 h-4" />
                        </div>
                      </div>

                      <div className="flex justify-between w-full">
                        <p>RSRQ</p>
                        <div>
                          <Skeleton className="w-32 h-4" />
                        </div>
                      </div>

                      <div className="flex justify-between w-full">
                        <p>SINR</p>
                        <div>
                          <Skeleton className="w-32 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            </CarouselContent>
          </Carousel>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <div className="hidden lg:block w-full">
        <Card className="p-6 grid gap-4">
          {bands &&
            bands.map((band: Band) => <BandCard key={band.id} {...band} />)}
          <CardFooter className="w-full p-6 flex items-center justify-center">
            <CardDescription className="text-md">
              Current bands connected.
            </CardDescription>
          </CardFooter>
        </Card>
      </div>

      <Carousel className="lg:hidden w-full max-w-xs">
          <CarouselContent>
            {bands?.map((band) => (
              <CarouselItem key={band.id} className="md:basis-1/2 lg:basis-1/3">
                <div className="p-1">
                  <Card>
                    <CardContent className="aspect-square p-4 gap-4 flex flex-col items-center justify-center flex-grow">
                      <div className="flex justify-between w-full">
                        <p>Band</p>
                        <p>{band.bandNumber}</p>
                      </div>

                      <div className="flex justify-between w-full">
                        <p>E/ARFCN</p>
                        <p>{band.earfcn}</p>
                      </div>

                      <div className="flex justify-between w-full">
                        <p>Bandwidth</p>
                        <p>{band.bandwidth}</p>
                      </div>

                      <div className="flex justify-between w-full">
                        <p>PCI</p>
                        <p>{band.pci}</p>
                      </div>

                      <div className="flex justify-between w-full">
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

                      <div className="flex justify-between w-full">
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

                      <div className="flex justify-between w-full">
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
        </Carousel>
    </div>
  );
};

export default BandTable;
