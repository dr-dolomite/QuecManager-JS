import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Types for Cell Information
interface BaseCellInfo {
  type: "LTE" | "NR5G";
  mcc: string;
  mnc: string;
  freq: number;
  pci: number;
  rsrp: number;
  rsrq: number;
  srxlev: number;
  cellId: string;
  tac: string;
  band: number;
}

interface LTECellInfo extends BaseCellInfo {
  type: "LTE";
  squal: number;
  bandwidth: number;
  bandwidthMHz?: string;
}

interface NR5GCellInfo extends BaseCellInfo {
  type: "NR5G";
  scs: number;
  carrierBandwidth: number;
  offsetToPointA: number;
  ssbSubcarrierOffset: number;
  ssbScs: number;
}

interface LTEFrequencyInfo {
  band: number;
  bandName: string;
  earfcn: number;
  dlFrequency: string;
  ulFrequency: string;
  ulEarfcn?: number;
  duplexType: "FDD" | "TDD";
  bandwidth?: string;
  channelNumber?: number;
}

interface NRFrequencyInfo {
  band: number;
  bandName: string;
  nrarfcn: number;
  dlFrequency: string;
  ulFrequency: string;
  duplexType: "FDD" | "TDD";
  scs?: number;
  channelBandwidth?: string;
}

interface MccMncInfo {
  type: string;
  countryName: string;
  countryCode: string;
  mcc: string;
  mnc: string;
  brand: string;
  operator: string;
  status: string;
  bands: string;
  notes?: string;
}

// Cell frequency detail card component
const FrequencyDetailCard = ({
  cell,
  operatorInfo,
}: {
  cell:
    | (LTECellInfo & { frequencyInfo?: LTEFrequencyInfo })
    | (NR5GCellInfo & { frequencyInfo?: NRFrequencyInfo });
  operatorInfo?: MccMncInfo | null;
}) => {
  const isLTE = cell.type === "LTE";

  // Format network name display
  const getNetworkName = () => {
    if (operatorInfo?.brand && operatorInfo.operator) {
      return `${operatorInfo.brand}`;
    } else if (operatorInfo?.operator) {
      return operatorInfo.operator;
    } else {
      return `${cell.mcc}${cell.mnc}`;
    }
  };

  return (
    <Card className="overflow-hidden border shadow-sm">
      <CardHeader className="bg-muted/30 pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Badge
              variant={isLTE ? "outline" : "default"}
              className={isLTE ? "bg-orange-600" : ""}
            >
              {isLTE ? "LTE" : "5G NR"} - {getNetworkName()}
            </Badge>
            <CardTitle className="text-base">
              {isLTE
                ? `Band ${cell.band} (${
                    cell.frequencyInfo?.bandName || "Unknown"
                  })`
                : `n${cell.band} (${
                    cell.frequencyInfo?.bandName || "Unknown"
                  })`}
            </CardTitle>
          </div>
        </div>
        <CardDescription className="mt-1 flex items-center space-x-2">
          <span>Cell ID: {cell.cellId}</span>
          <span>•</span>
          <span>
            PCI: {cell.pci}
          </span>
          <span>•</span>
          <span>
            {isLTE ? `EARFCN: ${cell.freq}` : `NR-ARFCN: ${cell.freq}`}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold mb-1">
                Frequency Information
              </h4>
              <div className="grid grid-cols-2 gap-y-1 text-sm">
                <div className="text-muted-foreground">Downlink Frequency:</div>
                <div className="font-medium">
                  {cell.frequencyInfo?.dlFrequency || "Unknown"} MHz
                </div>
                <div className="text-muted-foreground">Uplink Frequency:</div>
                <div className="font-medium">
                  {cell.frequencyInfo?.ulFrequency || "Unknown"} MHz
                </div>
                <div className="text-muted-foreground">Duplex Mode:</div>
                <div className="font-medium">
                  {cell.frequencyInfo?.duplexType || "Unknown"}
                </div>
                {isLTE && cell.frequencyInfo?.ulEarfcn && (
                  <>
                    <div className="text-muted-foreground">Uplink EARFCN:</div>
                    <div className="font-medium">
                      {cell.frequencyInfo.ulEarfcn}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold mb-1">Signal Parameters</h4>
              <div className="grid grid-cols-2 gap-y-1 text-sm">
                <div className="text-muted-foreground">RSRP:</div>
                <div className="font-medium">{cell.rsrp || "-"} dBm</div>
                <div className="text-muted-foreground">RSRQ:</div>
                <div className="font-medium">{cell.rsrq || "-"} dB</div>
                {isLTE ? (
                  <>
                    <div className="text-muted-foreground">SQUAL:</div>
                    <div className="font-medium">
                      {(cell as LTECellInfo).squal}
                    </div>
                    <div className="text-muted-foreground">Bandwidth:</div>
                    <div className="font-medium">
                      {(cell as LTECellInfo).bandwidthMHz ||
                        `${(cell as LTECellInfo).bandwidth} RB`}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-muted-foreground">
                      Subcarrier Spacing:
                    </div>
                    <div className="font-medium">
                      {(cell as NR5GCellInfo).scs || "-"} kHz
                    </div>
                    <div className="text-muted-foreground">
                      Carrier Bandwidth:
                    </div>
                    <div className="font-medium">
                      {(cell as NR5GCellInfo).carrierBandwidth ||"-"} RB
                    </div>
                    <div className="text-muted-foreground">SSB SCS:</div>
                    <div className="font-medium">
                      {(cell as NR5GCellInfo).ssbScs || "-"} kHz
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <Accordion type="single" collapsible className="mt-4">
          <AccordionItem value="advanced">
            <AccordionTrigger className="text-sm py-2">
              Advanced Details
            </AccordionTrigger>
            <AccordionContent>
              {operatorInfo && (
                <div>
                  <div className="grid grid-cols-2 gap-y-1 text-sm">
                    <div className="text-muted-foreground">Operator:</div>
                    <div className="font-medium">{operatorInfo.operator}</div>
                    <div className="text-muted-foreground">Brand:</div>
                    <div className="font-medium">{operatorInfo.brand}</div>
                    <div className="text-muted-foreground">Country:</div>
                    <div className="font-medium">
                      {operatorInfo.countryName}
                    </div>
                    <div className="text-muted-foreground">MCC-MNC:</div>
                    <div className="font-medium">
                      {operatorInfo.mcc}-{operatorInfo.mnc}
                    </div>
                    <div className="text-muted-foreground">SRXLEV:</div>
                    <div className="font-medium">{cell.srxlev}</div>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default FrequencyDetailCard;
