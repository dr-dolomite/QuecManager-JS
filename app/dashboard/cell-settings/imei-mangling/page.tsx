"use client";
import { useState, useEffect, useCallback } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Trash2, TriangleAlert, LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { atCommandSender } from "@/utils/at-command";

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

interface ProfileStatus {
  status: string;
  message: string;
  profile: string;
  progress: number;
  timestamp: number;
}

const IMEIManglingPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentIMEI, setCurrentIMEI] = useState("");
  const [newIMEI, setNewIMEI] = useState("");
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isProfileControlled, setIsProfileControlled] = useState(false);
  const { toast } = useToast();

  const fetchIMEI = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=3"
      );
      const rawData = await response.json();

      console.log(rawData);
      // Use the 6th index to get the IMEI
      const rawResult = rawData[6].response.split("\n")[1];
      console.log(rawResult);
      // Regex to match IMEI in a response format
      const imeiMatch = rawResult.match(/\d{15}/);
      const imei = imeiMatch ? imeiMatch[0] : null;

      if (imei) {
        setCurrentIMEI(imei);
        setNewIMEI(imei);
      } else {
        throw new Error("IMEI not found in response");
      }
    } catch (err) {
      toast({
        title: "Failed to fetch IMEI",
        description: "Failed to fetch IMEI from the device",
        variant: "destructive",
      });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to check if an active profile is managing the IMEI
  const checkActiveProfile = useCallback(async () => {
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
      const profileData = await profileResponse.json();

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
            if (active && active.imei) {
              setActiveProfile(active);
              setIsProfileControlled(true);

              // If profile has IMEI set, use it for display
              setNewIMEI(active.imei);

              console.log("Active Profile with IMEI:", active);
            } else {
              setActiveProfile(null);
              setIsProfileControlled(false);
            }
          }
        }
      } else {
        setActiveProfile(null);
        setIsProfileControlled(false);
      }
    } catch (err) {
      console.error("Error checking active profile:", err);
      setActiveProfile(null);
      setIsProfileControlled(false);
    }
  }, []);

  // Effect for fetching IMEI and checking profile
  useEffect(() => {
    const initialize = async () => {
      await fetchIMEI();
      await checkActiveProfile();
    };

    initialize();
  }, [fetchIMEI, checkActiveProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Don't allow submission if profile controlled
    if (isProfileControlled) {
      toast({
        title: "Profile Controlled",
        description: `IMEI is currently managed by profile "${activeProfile?.name}". Edit the profile to change IMEI.`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Add checker for the new IMEI if it's valid (must be 15 digits and numbers only)
    if (newIMEI.length !== 15 || isNaN(Number(newIMEI))) {
      toast({
        title: "Invalid IMEI",
        description: "IMEI must be 15 digits and numbers only",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Use atCommandSender instead of direct fetch
      const command = `AT+EGMR=1,7,"${newIMEI}"`;
      const result = await atCommandSender(command, true);

      if (result.status !== "success") {
        throw new Error(result.response || "Failed to update IMEI");
      }

      // If IMEI update successful, reboot the device
      const rebootResult = await atCommandSender("AT+QPOWD=1", true);

      if (rebootResult.status !== "success") {
        throw new Error(
          rebootResult.response || "Failed to reboot device"
        );
      }

      toast({
        title: "Success",
        description: "IMEI has been updated successfully. Rebooting...",
        duration: 90000,
      });

      // After 90 seconds, refresh the page to show the new IMEI
      setTimeout(() => {
        window.location.reload();
      }, 90000);
    } catch (err) {
      toast({
        title: "Failed to update IMEI",
        description: "Failed to update IMEI on the device",
        variant: "destructive",
      });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-8">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>IMEI Mangling</CardTitle>
            <CardDescription className="flex items-center justify-between">
              Change the IMEI of the device. Changing the IMEI may void your
              warranty and is illegal in some jurisdictions.
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <TriangleAlert className="size-4 text-orange-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Do at your own risk!</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isProfileControlled && activeProfile && (
              <Alert className="mb-6">
                <LockIcon className="h-4 w-4" color="orange" />
                <AlertTitle>Profile Controlled</AlertTitle>
                <AlertDescription>
                  IMEI is currently being managed by profile "
                  {activeProfile.name}".
                </AlertDescription>
              </Alert>
            )}

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="IMEI">
                Change Current IMEI
                {isProfileControlled && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (Profile Controlled)
                  </span>
                )}
              </Label>
              {isLoading ? (
                <Skeleton className="h-8" />
              ) : (
                <div className="grid gap-1.5">
                  <Input
                    type="text"
                    id="IMEI"
                    value={newIMEI}
                    onChange={(e) =>
                      !isProfileControlled && setNewIMEI(e.target.value)
                    }
                    placeholder={currentIMEI}
                    disabled={isProfileControlled}
                    className={
                      isProfileControlled ? "bg-muted cursor-not-allowed" : ""
                    }
                  />
                  <p className="text-xs text-muted-foreground font-medium">
                    This will reboot the device.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="grid border-t py-4">
            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading || newIMEI === currentIMEI || isProfileControlled
              }
            >
              {isLoading ? "Processing..." : "Change IMEI"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default IMEIManglingPage;
