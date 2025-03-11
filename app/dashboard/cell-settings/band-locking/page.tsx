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
import { LockIcon, RefreshCw, AlertCircle } from "lucide-react";
import { atCommandSender } from "@/utils/at-command"; // Import from utils
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type BandType = "lte" | "nsa" | "sa";

interface BandState {
  lte: number[];
  nsa: number[];
  sa: number[];
}

interface ProfileControllState {
  lte: boolean;
  nsa: boolean;
  sa: boolean;
}

interface ATResponse {
  response: string;
}

interface ProfileStatus {
  status: string;
  message: string;
  profile: string;
  progress: number;
  timestamp: number;
}

interface Profile {
  name: string;
  iccid: string;
  imei?: string;
  apn: string;
  pdp_type: string;
  lte_bands: string;
  sa_nr5g_bands?: string;
  nsa_nr5g_bands?: string;
  network_type: string;
  ttl: string;
}

interface BandCardProps {
  title: string;
  description: string;
  bandType: BandType;
  prefix: string;
  isProfileControlled: boolean;
  profileName: string;
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
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [profileControlled, setProfileControlled] =
    useState<ProfileControllState>({
      lte: false,
      nsa: false,
      sa: false,
    });

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

  // Fetch active profile information
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Fetch active profile status
        const profileResponse = await fetch(
          "/cgi-bin/quecmanager/profiles/check_status.sh"
        );
        if (!profileResponse.ok) {
          throw new Error(
            `Failed to fetch profile status: ${profileResponse.statusText}`
          );
        }
        const profileData: ProfileStatus = await profileResponse.json();

        console.log("Profile Status:", profileData);

        // Only proceed if there's an active profile
        if (
          profileData.status === "success" &&
          profileData.profile &&
          profileData.profile !== "unknown" &&
          profileData.profile !== "none"
        ) {
          // Fetch all profiles to find the active one
          const profilesResponse = await fetch(
            "/cgi-bin/quecmanager/profiles/list_profiles.sh"
          );
          if (profilesResponse.ok) {
            const profilesData = await profilesResponse.json();
            if (
              profilesData.status === "success" &&
              Array.isArray(profilesData.profiles)
            ) {
              // Find the active profile
              const active = profilesData.profiles.find(
                (p: Profile) => p.name === profileData.profile
              );
              if (active) {
                setActiveProfile(active);

                // Determine which band types are controlled by the profile
                const controlled = {
                  lte: Boolean(active.lte_bands),
                  nsa: Boolean(active.nsa_nr5g_bands),
                  sa: Boolean(active.sa_nr5g_bands),
                };

                setProfileControlled(controlled);

                console.log("Active Profile:", active);
                console.log("Controlled Bands:", controlled);
              }
            }
          }
        } else {
          setActiveProfile(null);
          setProfileControlled({
            lte: false,
            nsa: false,
            sa: false,
          });
        }
      } catch (err) {
        console.error("Error fetching profile data:", err);
      }
    };

    fetchProfileData();
  }, []);

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

  // Updates checked bands from profile if controlled by profile
  useEffect(() => {
    if (activeProfile) {
      let newCheckedBands = { ...checkedBands };
      let changed = false;

      if (profileControlled.lte && activeProfile.lte_bands) {
        // Parse the bands from the profile
        const lteBands = activeProfile.lte_bands
          .split(",")
          .map(Number)
          .filter((n) => !isNaN(n));

        newCheckedBands.lte = lteBands;
        changed = true;
      }

      if (profileControlled.nsa && activeProfile.nsa_nr5g_bands) {
        const nsaBands = activeProfile.nsa_nr5g_bands
          .split(",")
          .map(Number)
          .filter((n) => !isNaN(n));

        newCheckedBands.nsa = nsaBands;
        changed = true;
      }

      if (profileControlled.sa && activeProfile.sa_nr5g_bands) {
        const saBands = activeProfile.sa_nr5g_bands
          .split(",")
          .map(Number)
          .filter((n) => !isNaN(n));

        newCheckedBands.sa = saBands;
        changed = true;
      }

      if (changed) {
        setCheckedBands(newCheckedBands);
      }
    }
  }, [activeProfile, profileControlled]);

  const handleCheckboxChange = (bandType: BandType, band: number) => {
    // Don't allow changes if controlled by profile
    if (profileControlled[bandType]) return;

    setCheckedBands((prev) => ({
      ...prev,
      [bandType]: prev[bandType].includes(band)
        ? prev[bandType].filter((b) => b !== band)
        : [...prev[bandType], band].sort((a, b) => a - b),
    }));
  };

  const handleLockBands = async (bandType: BandType) => {
    // Don't allow locking if controlled by profile
    if (profileControlled[bandType]) {
      toast({
        title: "Profile Controlled",
        description: `${bandType.toUpperCase()} bands are currently managed by profile "${
          activeProfile?.name
        }"`,
        variant: "destructive",
      });
      return;
    }

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
          throw new Error(
            nsaResult.response?.raw_output || "Failed to lock NSA bands"
          );
        }

        // Immediately restore SA bands configuration to preserve it
        if (currentSABands) {
          const saResult = await atCommandSender(
            `AT+QNWPREFCFG="${activeCommandMap.sa}",${currentSABands}`,
            true
          );

          if (saResult.response?.status !== "success") {
            throw new Error(
              saResult.response?.raw_output || "Failed to restore SA bands"
            );
          }
        } else {
          // If no SA bands were selected, reset to default SA bands
          const defaultSABands = bands.sa.join(":");
          const saResult = await atCommandSender(
            `AT+QNWPREFCFG="${activeCommandMap.sa}",${defaultSABands}`,
            true
          );

          if (saResult.response?.status !== "success") {
            throw new Error(
              saResult.response?.raw_output || "Failed to set default SA bands"
            );
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
          throw new Error(
            result.response?.raw_output ||
              `Failed to lock ${bandType.toUpperCase()} bands`
          );
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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Error locking ${bandType} bands:`, error);
      toast({
        title: "Error",
        description: `Failed to lock ${bandType.toUpperCase()} bands: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  const handleUncheckAll = (bandType: BandType) => {
    // Don't allow unchecking if controlled by profile
    if (profileControlled[bandType]) return;

    setCheckedBands((prev) => ({
      ...prev,
      [bandType]: [],
    }));
  };

  const handleResetToDefault = async (bandType: BandType) => {
    // Don't allow reset if controlled by profile
    if (profileControlled[bandType]) {
      toast({
        title: "Profile Controlled",
        description: `${bandType.toUpperCase()} bands are currently managed by profile "${
          activeProfile?.name
        }"`,
        variant: "destructive",
      });
      return;
    }

    try {
      const defaultBands = bands[bandType].join(":");

      if (bandType === "nsa") {
        // Reset NSA bands
        const nsaResult = await atCommandSender(
          `AT+QNWPREFCFG="${activeCommandMap.nsa}",${defaultBands}`,
          true
        );

        if (nsaResult.response?.status !== "success") {
          throw new Error(
            nsaResult.response?.raw_output || "Failed to reset NSA bands"
          );
        }

        // Preserve current SA bands configuration
        const currentSABands = checkedBands.sa.join(":");
        if (currentSABands) {
          const saResult = await atCommandSender(
            `AT+QNWPREFCFG="${activeCommandMap.sa}",${currentSABands}`,
            true
          );

          if (saResult.response?.status !== "success") {
            throw new Error(
              saResult.response?.raw_output || "Failed to preserve SA bands"
            );
          }
        }
      } else {
        const result = await atCommandSender(
          `AT+QNWPREFCFG="${activeCommandMap[bandType]}",${defaultBands}`,
          true
        );

        if (result.response?.status !== "success") {
          throw new Error(
            result.response?.raw_output ||
              `Failed to reset ${bandType.toUpperCase()} bands`
          );
        }
      }

      toast({
        title: "Reset Successful",
        description: `${bandType.toUpperCase()} bands reset to default.`,
      });
      await fetchBandsData();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Error resetting ${bandType} bands:`, error);
      toast({
        title: "Error",
        description: `Failed to reset ${bandType.toUpperCase()} bands: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  // Check if any band type is profile controlled
  const hasProfileControlledBands = () => {
    return (
      profileControlled.lte || profileControlled.nsa || profileControlled.sa
    );
  };

  const BandCard = ({
    title,
    description,
    bandType,
    prefix,
    isProfileControlled,
    profileName,
  }: BandCardProps) => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {isProfileControlled && (
            <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
              <LockIcon className="h-3 w-3" color="orange" />
              <span>Profile Controlled by {profileName}</span>
            </div>
          )}
        </div>
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
                disabled={isProfileControlled}
                className={
                  isProfileControlled ? "cursor-not-allowed opacity-60" : ""
                }
              />
              <label
                htmlFor={`${bandType}-${band}`}
                className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                  isProfileControlled ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                {prefix}
                {band}
              </label>
            </div>
          ))
        )}
      </CardContent>
      <CardFooter className="border-t py-4 grid grid-flow-row md:grid-cols-3 grid-cols-1 gap-3">
        <Button
          onClick={() => handleLockBands(bandType)}
          disabled={isProfileControlled}
        >
          <LockIcon className="h-4 w-4" />
          Lock Selected Bands
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleUncheckAll(bandType)}
          disabled={isProfileControlled}
        >
          Uncheck All
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleResetToDefault(bandType)}
          disabled={isProfileControlled}
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
        isProfileControlled={profileControlled.lte}
        profileName={activeProfile?.name || ""}
      />
      <BandCard
        title="NR5G-NSA Band Locking"
        description="Lock the device to specific NR5G-NSA bands."
        bandType="nsa"
        prefix="N"
        isProfileControlled={profileControlled.nsa}
        profileName={activeProfile?.name || ""}
      />
      <BandCard
        title="NR5G-SA Band Locking"
        description="Lock the device to specific NR5G-SA bands."
        bandType="sa"
        prefix="N"
        isProfileControlled={profileControlled.sa}
        profileName={activeProfile?.name || ""}
      />
    </div>
  );
};

export default BandLocking;
