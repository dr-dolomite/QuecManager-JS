import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { Band } from "@/types/types";
import { calculateSignalPercentage } from "@/utils/signalMetrics";

interface BandsAccordionProps {
  bands: Band[] | null;
  isLoading: boolean;
}

const BandsAccordionComponent = ({ bands, isLoading }: BandsAccordionProps) => {
  // Helper function to get signal color based on percentage
  const getSignalColor = (percentage: number): string => {
    if (percentage >= 60) return "bg-green-600";
    if (percentage >= 30) return "bg-orange-600";
    return "bg-red-600";
  };

  // Helper function to format band name for display
  //   const formatBandName = (bandNumber: string): string => {
  //     return bandNumber
  //       .replace("LTE BAND ", "LTE B")
  //       .replace("NR5G BAND ", "NR N");
  //   };

  // Helper function to check if band is 5G
  const isNR5G = (bandNumber: string): boolean => {
    return bandNumber.includes("NR5G");
  };

  // Sort bands: LTE first, then NR5G
  const sortedBands = React.useMemo(() => {
    if (!bands) return [];

    const lteBands = bands.filter((band) => !isNR5G(band.bandNumber));
    const nrBands = bands.filter((band) => isNR5G(band.bandNumber));

    return [...lteBands, ...nrBands];
  }, [bands]);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Active Bands</CardTitle>
        <CardDescription>
          Detailed information about the currently active network bands
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !sortedBands || sortedBands.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active bands detected
          </div>
        ) : (
          <Accordion
            type="single"
            collapsible
            className="w-full"
            defaultValue={`item-${sortedBands[0]?.id}`}
          >
            {sortedBands.map((band, index) => {
              const rsrpValue = parseInt(band.rsrp);
              const rsrqValue = parseInt(band.rsrq);
              const sinrValue = parseInt(band.sinr);

              const rsrpPercentage = calculateSignalPercentage(
                "rsrp",
                rsrpValue
              );
              const rsrqPercentage = calculateSignalPercentage(
                "rsrq",
                rsrqValue
              );
              const sinrPercentage = calculateSignalPercentage(
                "sinr",
                sinrValue
              );

              return (
                <AccordionItem key={band.id} value={`item-${band.id}`}>
                  <AccordionTrigger className="font-bold">
                    <div className="flex items-center gap-2">
                      {/* {formatBandName(band.bandNumber)} */}
                      <Badge className={`text-xs rounded-full ${
                        isNR5G(band.bandNumber)
                          ? "bg-blue-600 hover:bg-blue-800"
                          : "bg-orange-600 hover:bg-orange-800"
                      }`}>
                        {isNR5G(band.bandNumber) ? "NR" : "LTE"}
                      </Badge>
                      <p className="font-bold">{band.bandNumber}</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="grid gap-2 text-balance">
                    {/* RSRP */}
                    <div className="flex items-center justify-between">
                      <p className="semibold">RSRP</p>
                      <div className="flex items-center">
                        <Progress
                          value={rsrpPercentage}
                          className={`w-24 mr-2 [&>div]:${getSignalColor(
                            rsrpPercentage
                          )}`}
                        />
                        <p className="ml-2 font-bold w-20 text-right">
                          {band.rsrp} dBm
                        </p>
                      </div>
                    </div>

                    {/* RSRQ */}
                    <div className="flex items-center justify-between">
                      <p className="semibold">RSRQ</p>
                      <div className="flex items-center">
                        <Progress
                          value={rsrqPercentage}
                          className={`w-24 mr-2 [&>div]:${getSignalColor(
                            rsrqPercentage
                          )}`}
                        />
                        <p className="ml-2 font-bold w-20 text-right">
                          {band.rsrq} dB
                        </p>
                      </div>
                    </div>

                    {/* SINR / NR-SNR */}
                    <div className="flex items-center justify-between">
                      <p className="semibold">
                        {isNR5G(band.bandNumber) ? "NR-SNR" : "SINR"}
                      </p>
                      <div className="flex items-center">
                        <Progress
                          value={sinrPercentage}
                          className={`w-24 mr-2 [&>div]:${getSignalColor(
                            sinrPercentage
                          )}`}
                        />
                        <p className="ml-2 font-bold w-20 text-right">
                          {band.sinr} dB
                        </p>
                      </div>
                    </div>

                    {/* Bandwidth */}
                    <div className="flex items-center justify-between">
                      <p className="semibold">Bandwidth</p>
                      <p className="font-bold">{band.bandwidth}</p>
                    </div>

                    {/* EARFCN */}
                    <div className="flex items-center justify-between">
                      <p className="semibold">EARFCN</p>
                      <p className="font-bold">{band.earfcn}</p>
                    </div>

                    {/* PCI */}
                    <div className="flex items-center justify-between">
                      <p className="semibold">PCI</p>
                      <p className="font-bold">{band.pci}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default BandsAccordionComponent;
