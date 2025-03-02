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
import { atCommandSender } from "@/utils/at-command"; // Import from utils

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

// Separate command maps for supported and active bands
const supportedCommandMap: Record<BandType, string> = {
  lte: "lte_band",
  nsa: "nsa_nr5g_band",
  sa: "nrdc_nr5g_band", // Use nrdc_nr5g_band for supported SA bands
};

const activeCommandMap: Record<BandType, string> = {
  lte: "lte_band",
  nsa: "nsa_nr5g_band",
  sa: "nr5g_band", // Keep nr5g_band for active SA bands
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

  const parseResponse = (
    response: string,
    bandType: string,
    isSupported: boolean
  ): number[] => {
    const lines = response.split("\n");
    const commandType = isSupported
      ? supportedCommandMap[bandType as BandType]
      : activeCommandMap[bandType as BandType];

    for (const line of lines) {
      const searchString = `"${commandType}"`;
      if (line.includes(searchString)) {
        const match = line.match(/\"[^\"]+\",(.+)/);
        if (match && match[1]) {
          return match[1]
            .trim()
            .split(":")
            .map(Number)
            .filter((n) => !isNaN(n));
        }
      }
    }
    return [];
  };

  const fetchBandsData = async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=7"
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ATResponse[] = await response.json();

      // Parse supported bands from first response
      const supportedBandsResponse = data[0].response;
      const newBands: BandState = {
        lte: parseResponse(supportedBandsResponse, "lte", true),
        nsa: parseResponse(supportedBandsResponse, "nsa", true),
        sa: parseResponse(supportedBandsResponse, "sa", true), // Will use nrdc_nr5g_band
      };
      setBands(newBands);

      // Parse checked bands from second response
      const checkedBandsResponse = data[1].response;
      const newCheckedBands: BandState = {
        lte: parseResponse(checkedBandsResponse, "lte", false),
        nsa: parseResponse(checkedBandsResponse, "nsa", false),
        sa: parseResponse(checkedBandsResponse, "sa", false), // Will use nr5g_band
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

      if (bandType === "nsa") {
        // Store the current SA bands configuration
        const currentSABands = checkedBands.sa.join(":");

        // Lock NSA bands using the imported atCommandSender
        const nsaResult = await atCommandSender(
          `AT+QNWPREFCFG="${activeCommandMap.nsa}",${selectedBands}`,
          true
        );
        
        if (nsaResult.response?.status !== "success") {
          throw new Error(nsaResult.response?.raw_output || "Failed to lock NSA bands");
        }

        // Immediately restore SA bands configuration to preserve it
        if (currentSABands) {
          const saResult = await atCommandSender(
            `AT+QNWPREFCFG="${activeCommandMap.sa}",${currentSABands}`,
            true
          );
          
          if (saResult.response?.status !== "success") {
            throw new Error(saResult.response?.raw_output || "Failed to restore SA bands");
          }
        } else {
          // If no SA bands were selected, reset to default SA bands
          const defaultSABands = bands.sa.join(":");
          const saResult = await atCommandSender(
            `AT+QNWPREFCFG="${activeCommandMap.sa}",${defaultSABands}`,
            true
          );
          
          if (saResult.response?.status !== "success") {
            throw new Error(saResult.response?.raw_output || "Failed to set default SA bands");
          }
        }

        // Update local state to reflect the changes
        setCheckedBands((prev) => ({
          ...prev,
          nsa: checkedBands.nsa,
          sa: currentSABands ? checkedBands.sa : bands.sa,
        }));
      } else {
        // For LTE and SA bands, proceed as normal
        const result = await atCommandSender(
          `AT+QNWPREFCFG="${activeCommandMap[bandType]}",${selectedBands}`,
          true
        );
        
        if (result.response?.status !== "success") {
          throw new Error(result.response?.raw_output || `Failed to lock ${bandType.toUpperCase()} bands`);
        }

        // Update local state to reflect the changes
        setCheckedBands((prev) => ({
          ...prev,
          [bandType]: checkedBands[bandType],
        }));
      }

      toast({
        title: "Band Locking",
        description: "Bands locked successfully.",
      });

      // Fetch the latest data after a short delay to ensure the modem has processed the changes
      setTimeout(fetchBandsData, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error locking ${bandType} bands:`, error);
      toast({
        title: "Error",
        description: `Failed to lock ${bandType.toUpperCase()} bands: ${errorMessage}`,
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

      if (bandType === "nsa") {
        // Reset NSA bands
        const nsaResult = await atCommandSender(
          `AT+QNWPREFCFG="${activeCommandMap.nsa}",${defaultBands}`,
          true
        );
        
        if (nsaResult.response?.status !== "success") {
          throw new Error(nsaResult.response?.raw_output || "Failed to reset NSA bands");
        }

        // Preserve current SA bands configuration
        const currentSABands = checkedBands.sa.join(":");
        if (currentSABands) {
          const saResult = await atCommandSender(
            `AT+QNWPREFCFG="${activeCommandMap.sa}",${currentSABands}`,
            true
          );
          
          if (saResult.response?.status !== "success") {
            throw new Error(saResult.response?.raw_output || "Failed to preserve SA bands");
          }
        }
      } else {
        const result = await atCommandSender(
          `AT+QNWPREFCFG="${activeCommandMap[bandType]}",${defaultBands}`,
          true
        );
        
        if (result.response?.status !== "success") {
          throw new Error(result.response?.raw_output || `Failed to reset ${bandType.toUpperCase()} bands`);
        }
      }

      toast({
        title: "Reset Successful",
        description: `${bandType.toUpperCase()} bands reset to default.`,
      });
      await fetchBandsData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error resetting ${bandType} bands:`, error);
      toast({
        title: "Error",
        description: `Failed to reset ${bandType.toUpperCase()} bands: ${errorMessage}`,
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