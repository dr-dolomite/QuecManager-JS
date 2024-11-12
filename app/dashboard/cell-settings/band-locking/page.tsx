"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LockIcon, RefreshCw } from "lucide-react";

type BandType = "lte" | "nsa" | "sa";

interface BandState {
  lte: number[];
  nsa: number[];
  sa: number[];
}

interface ATResponse {
  command: string;
  output: string;
  error?: string;
}

interface BandCardProps {
  title: string;
  description: string;
  bandType: BandType;
  prefix: string;
}

const commandMap: Record<BandType, string> = {
  lte: "lte_band",
  nsa: "nsa_nr5g_band",
  sa: "nr5g_band",
};

const BandLocking = () => {
  const { toast } = useToast();

  const [bands, setBands] = useState<BandState>({
    lte: [],
    nsa: [],
    sa: [],
  });

  const [checkedBands, setCheckedBands] = useState<BandState>({
    lte: [],
    nsa: [],
    sa: [],
  });

  const [loading, setLoading] = useState(true);

  const atCommandSender = async (command: string): Promise<ATResponse> => {
    try {
      const encodedCommand = encodeURIComponent(command);
      const response = await fetch("/cgi-bin/atinout_handler.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // body: JSON.stringify({ command }),
        body: `command=${encodedCommand}`,
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      return data;
    } catch (error) {
      console.error("AT Command error:", error);
      throw error;
    }
  };

  const parseATResponse = (
    response: ATResponse,
    bandType: string
  ): number[] => {
    const lines = response.output.split("\n");
    for (const line of lines) {
      if (line.includes(bandType)) {
        const match = line.match(/"([^"]+)",(.+)/);
        if (match && match[2]) {
          return match[2].split(":").map(Number);
        }
      }
    }
    return [];
  };

  const fetchAllBands = async () => {
    try {
      const response = await atCommandSender('AT+QNWPREFCFG="policy_band"');
      const lines = response.output.split("\n");
      const newBands: BandState = {
        lte: [],
        nsa: [],
        sa: [],
      };

      lines.forEach((line) => {
        if (line.includes('"lte_band"')) {
          newBands.lte = line.split(",")[1]?.split(":").map(Number) || [];
        } else if (line.includes('"nsa_nr5g_band"')) {
          newBands.nsa = line.split(",")[1]?.split(":").map(Number) || [];
        } else if (line.includes('"nrdc_nr5g_band"')) {
          newBands.sa = line.split(",")[1]?.split(":").map(Number) || [];
        }
      });

      setBands(newBands);

      toast({
        title: "Success",
        description: "Fetched available bands successfully.",
      });
    } catch (error) {
      console.error("Error fetching bands:", error);
      toast({
        title: "Error",
        description: "Failed to fetch available bands.",
        variant: "destructive",
      });
    }
  };

  const fetchCheckedBands = async () => {
    // Add a timeout that if the response is not received within 5 seconds, it will throw an error
    // This is to prevent the app from hanging indefinitely

    try {
      const response = await atCommandSender(
        'AT+QNWPREFCFG="lte_band";+QNWPREFCFG="nsa_nr5g_band";+QNWPREFCFG="nr5g_band"'
      );

      const newCheckedBands: BandState = {
        lte: parseATResponse(response, "lte_band"),
        nsa: parseATResponse(response, '+QNWPREFCFG: "nsa_nr5g_band"'),
        sa: parseATResponse(response, '+QNWPREFCFG: "nr5g_band"'),
      };

      console.log("New Checked Bands: ", newCheckedBands);
      setCheckedBands(newCheckedBands);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching checked bands:", error);
      toast({
        title: "Error",
        description: "Failed to fetch checked bands.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeBands = async () => {
      await fetchAllBands();
      await fetchCheckedBands();
    };

    initializeBands();
  }, []);

  const handleCheckboxChange = (bandType: BandType, band: number) => {
    setCheckedBands((prev) => ({
      ...prev,
      [bandType]: prev[bandType].includes(band)
        ? prev[bandType].filter((b) => b !== band)
        : [...prev[bandType], band].sort((a, b) => a - b),
    }));
  };

  const handleLockBands = async (bandType: BandType) => {
    try {
      const selectedBands = checkedBands[bandType].join(":");
      await atCommandSender(
        `AT+QNWPREFCFG="${commandMap[bandType]}",${selectedBands}`
      );
      toast({
        title: "Band Locking",
        description: "Bands locked successfully.",
      });
      await fetchCheckedBands();
    } catch (error) {
      console.error(`Error locking ${bandType} bands:`, error);
      toast({
        title: "Error",
        description: `Failed to lock ${bandType.toUpperCase()} bands.`,
        variant: "destructive",
      });
    }
  };

  const handleUncheckAll = (bandType: BandType) => {
    setCheckedBands((prev) => ({
      ...prev,
      [bandType]: [],
    }));
  };

  const handleResetToDefault = async (bandType: BandType) => {
    try {
      const defaultBands = bands[bandType].join(":");
      await atCommandSender(
        `AT+QNWPREFCFG="${commandMap[bandType]}",${defaultBands}`
      );
      toast({
        title: "Reset Successful",
        description: `${bandType.toUpperCase()} bands reset to default.`,
      });
      await fetchCheckedBands();
    } catch (error) {
      console.error(`Error resetting ${bandType} bands:`, error);
      toast({
        title: "Error",
        description: `Failed to reset ${bandType.toUpperCase()} bands.`,
        variant: "destructive",
      });
    }
  };

  const BandCard = ({
    title,
    description,
    bandType,
    prefix,
  }: BandCardProps) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid lg:grid-cols-8 md:grid-cols-6 sm:grid-cols-4 grid-cols-3 grid-flow-row gap-4">
        {loading ? (
          <div className="col-span-8">Fetching bands...</div>
        ) : (
          bands[bandType].map((band) => (
            <div className="flex items-center space-x-2" key={band}>
              <Checkbox
                id={`${bandType}-${band}`}
                checked={checkedBands[bandType].includes(band)}
                onCheckedChange={() => handleCheckboxChange(bandType, band)}
              />
              <label
                htmlFor={`${bandType}-${band}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {prefix}
                {band}
              </label>
            </div>
          ))
        )}
      </CardContent>
      <CardFooter className="border-t py-4 grid grid-flow-row md:grid-cols-3 grid-cols-1 gap-3">
        <Button onClick={() => handleLockBands(bandType)}>
          <LockIcon className="h-4 w-4" />
          Lock Selected Bands
        </Button>
        <Button variant="secondary" onClick={() => handleUncheckAll(bandType)}>
          Uncheck All
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleResetToDefault(bandType)}
        >
          <RefreshCw className="h-4 w-4" />
          Reset to Default
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <div className="grid gap-6">
      <BandCard
        title="4G LTE Band Locking"
        description="Lock the device to specific LTE bands."
        bandType="lte"
        prefix="B"
      />
      <BandCard
        title="NR5G-NSA Band Locking"
        description="Lock the device to specific NR5G-NSA bands."
        bandType="nsa"
        prefix="N"
      />
      <BandCard
        title="NR5G-SA Band Locking"
        description="Lock the device to specific NR5G-SA bands."
        bandType="sa"
        prefix="N"
      />
    </div>
  );
};

export default BandLocking;
