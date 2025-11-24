"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LockIcon } from "lucide-react";

// Define interfaces for the API responses
interface TTLData {
  currentValue: number;
  isEnabled: boolean;
  success?: boolean;
  error?: string;
}

interface Profile {
  name: string;
  iccid: string;
  imei: string;
  apn: string;
  pdp_type: string;
  lte_bands: string;
  sa_nr5g_bands: string;
  nsa_nr5g_bands: string;
  network_type: string;
  ttl: string;
}

interface ProfileStatus {
  status: string;
  message: string;
  profile: string;
  progress?: number;
  timestamp?: number;
}

interface ProfilesResponse {
  status: string;
  profiles: Profile[];
}

const TTLSettingsPage = () => {
  const [ttlValue, setTtlValue] = useState<string>("0");
  const [ttlState, setTtlState] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isProfileControlled, setIsProfileControlled] =
    useState<boolean>(false);
  const { toast } = useToast();

  // Fetch current TTL state and active profile
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch TTL settings
        const ttlResponse = await fetch("/cgi-bin/quecmanager/advance/ttl.sh");
        console.log("TTL Response:", ttlResponse);
        if (!ttlResponse.ok) {
          throw new Error(
            `Failed to fetch TTL settings: ${ttlResponse.statusText}`
          );
        }
        const ttlData = (await ttlResponse.json()) as TTLData;

        // Fetch active profile status
        const profileResponse = await fetch(
          "/cgi-bin/quecmanager/profiles/check_status.sh"
        );
        console.log("Profile Response:", profileResponse);
        if (!profileResponse.ok) {
          throw new Error(
            `Failed to fetch profile status: ${profileResponse.statusText}`
          );
        }
        const profileData = (await profileResponse.json()) as ProfileStatus;

        console.log("TTL Data:", ttlData);
        console.log("Profile Status:", profileData);

        // Handle active profile with TTL
        let isControlled = false;
        let finalTtlValue = ttlData.currentValue.toString();
        let finalTtlState = ttlData.isEnabled;

        // Check if there's an active profile with TTL settings
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
            const profilesData =
              (await profilesResponse.json()) as ProfilesResponse;
            if (
              profilesData.status === "success" &&
              Array.isArray(profilesData.profiles)
            ) {
              // Find the active profile
              const active = profilesData.profiles.find(
                (p) => p.name === profileData.profile
              );
              if (active && active.ttl && parseInt(active.ttl) > 0) {
                // Profile has active TTL setting
                setActiveProfile(active);
                isControlled = true;
                finalTtlValue = active.ttl;
                finalTtlState = true;
              }
            }
          }
        }

        setTtlValue(finalTtlValue);
        setTtlState(finalTtlState);
        setIsProfileControlled(isControlled);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch TTL settings"
        );
        toast({
          variant: "destructive",
          title: "Error fetching settings",
          description:
            err instanceof Error ? err.message : "Failed to fetch TTL settings",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Only send TTL value if state is enabled
    const valueToSend = ttlState ? ttlValue : "0";

    try {
      const response = await fetch("/cgi-bin/quecmanager/advance/ttl.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `ttl=${valueToSend}`,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = (await response.json()) as TTLData;

      if (data.success === true) {
        setSuccess("Settings saved successfully");
        toast({
          title: "Success",
          description: "TTL settings saved successfully",
        });
      } else {
        throw new Error(data.error || "Failed to save settings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      toast({
        variant: "destructive",
        title: "Error saving settings",
        description:
          err instanceof Error ? err.message : "Failed to save TTL settings",
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Device TTL Settings</h1>
        <p className="text-muted-foreground">
          Configure the Time To Live (TTL) settings for your device's network
          packets.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>TTL Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {isProfileControlled && activeProfile && (
            <Alert className="mb-6">
              <LockIcon className="h-4 w-4" color="orange" />
              <AlertTitle>Profile Controlled</AlertTitle>
              <AlertDescription>
                TTL is currently being managed by profile "{activeProfile.name}
                ".
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium">TTL Value</label>
                <Input
                  type="number"
                  min="0"
                  max="255"
                  value={ttlValue}
                  onChange={(e) => setTtlValue(e.target.value)}
                  disabled={!ttlState || isProfileControlled || loading}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Set the TTL value for your connection (0-255).
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <label className="text-base font-medium">TTL State</label>
                  <p className="text-sm text-gray-500">
                    Toggle to enable or disable TTL mangling
                  </p>
                </div>
                <Switch
                  checked={ttlState}
                  onCheckedChange={setTtlState}
                  disabled={isProfileControlled || loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || isProfileControlled}
            >
              Save Configuration
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TTLSettingsPage;
