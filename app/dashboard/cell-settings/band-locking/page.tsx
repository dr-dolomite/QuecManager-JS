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
  response: string;
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

  const parseResponse = (response: string, bandType: string): number[] => {
    const lines = response.split("\n");
    for (const line of lines) {
      if (line.includes(bandType)) {
        const match = line.match(/\"[^\"]+\",(.+)/);
        if (match && match[1]) {
          return match[1].split(":").map(Number);
        }
      }
    }
    return [];
  };

  const fetchBandsData = async () => {
    try {
      const response = await fetch("/cgi-bin/fetch_data.sh?set=7");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ATResponse[] = await response.json();
      
      // Parse supported bands from first response
      const supportedBandsResponse = data[0].response;
      const newBands: BandState = {
        lte: parseResponse(supportedBandsResponse, "lte_band"),
        nsa: parseResponse(supportedBandsResponse, "nsa_nr5g_band"),
        sa: parseResponse(supportedBandsResponse, "nr5g_band"),
      };
      setBands(newBands);

      // Parse checked bands from second response
      const checkedBandsResponse = data[1].response;
      const newCheckedBands: BandState = {
        lte: parseResponse(checkedBandsResponse, "lte_band"),
        nsa: parseResponse(checkedBandsResponse, "nsa_nr5g_band"),
        sa: parseResponse(checkedBandsResponse, "nr5g_band"),
      };
      setCheckedBands(newCheckedBands);
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching bands:", error);
      toast({
        title: "Error",
        description: "Failed to fetch bands data.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBandsData();
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
      await fetchBandsData();
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
      await fetchBandsData();
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