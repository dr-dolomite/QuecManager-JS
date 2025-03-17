"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LockIcon } from "lucide-react";

import useCellSettingsData from "@/hooks/cell-settings-data";

interface FormData {
  currentAPN: string;
  apnPDPType: string;
  preferredNetworkType: string;
  nr5gMode: string;
  simSlot: string;
  cfunState: string;
  autoSelState: string;
  selectedMbnProfile?: string;
  mbnProfilesList?: string[];
}

// interface QueueResponse {
//   command: {
//     id: string;
//     text: string;
//     timestamp: string;
//   };
//   response: {
//     status: string;
//     raw_output: string;
//     completion_time: string;
//     duration_ms: number;
//   };
// }

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

import { atCommandSender } from "@/utils/at-command";
import { Separator } from "@/components/ui/separator";

const BasicSettings = () => {
  const { toast } = useToast();
  const {
    data: initialData,
    isLoading,
    fetchCellSettingsData,
  } = useCellSettingsData();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(
    null
  );
  const [profileControlledFields, setProfileControlledFields] = useState<{
    [key: string]: boolean;
  }>({
    currentAPN: false,
    apnPDPType: false,
    preferredNetworkType: false,
    nr5gMode: false,
  });

  const [formData, setFormData] = useState<FormData>({
    currentAPN: "",
    apnPDPType: "",
    preferredNetworkType: "",
    nr5gMode: "",
    simSlot: "",
    cfunState: "",
    autoSelState: "",
    selectedMbnProfile: "",
    mbnProfilesList: [],
  });

  // Initialize form data when initial data loads
  useEffect(() => {
    if (initialData && !isDataLoaded) {
      const sanitizedData: FormData = {
        currentAPN: String(initialData.currentAPN || ""),
        apnPDPType: String(initialData.apnPDPType || ""),
        preferredNetworkType: String(initialData.preferredNetworkType || ""),
        nr5gMode: String(initialData.nr5gMode || ""),
        simSlot: String(initialData.simSlot || ""),
        cfunState: String(initialData.cfunState || ""),
        autoSelState: String(initialData.autoSelState || ""),
        selectedMbnProfile: initialData.selectedMbnProfile || "",
        mbnProfilesList: (initialData.mbnProfilesList || []) as string[],
      };
      setFormData(sanitizedData);
      setIsDataLoaded(true);
    }
  }, [initialData, isDataLoaded]);

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
        const profileData = await profileResponse.json();
        setProfileStatus(profileData);

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

                // Determine which fields are controlled by the profile
                const controlledFields = {
                  currentAPN: Boolean(active.apn),
                  apnPDPType: Boolean(active.pdp_type),
                  preferredNetworkType: Boolean(active.network_type),
                  nr5gMode: Boolean(
                    active.sa_nr5g_bands || active.nsa_nr5g_bands
                  ),
                };

                setProfileControlledFields(controlledFields);

                console.log("Active Profile:", active);
                console.log("Controlled Fields:", controlledFields);
              }
            }
          }
        } else {
          setActiveProfile(null);
          setProfileControlledFields({
            currentAPN: false,
            apnPDPType: false,
            preferredNetworkType: false,
            nr5gMode: false,
          });
        }
      } catch (err) {
        console.error("Error fetching profile data:", err);
      }
    };

    fetchProfileData();
  }, []);

  // Reset isDataLoaded when initialData changes
  useEffect(() => {
    if (!initialData) {
      setIsDataLoaded(false);
    }
  }, [initialData]);

  const constructATCommand = (changes: Partial<FormData>): string => {
    const commands: string[] = [];

    if (
      (changes.currentAPN || changes.apnPDPType) &&
      !profileControlledFields.currentAPN &&
      !profileControlledFields.apnPDPType
    ) {
      const pdpType = changes.apnPDPType || formData.apnPDPType;
      const apn = changes.currentAPN || formData.currentAPN;
      commands.push(`AT+CGDCONT=1,"${pdpType}","${apn}"`);
    }

    if (
      changes.preferredNetworkType &&
      !profileControlledFields.preferredNetworkType
    ) {
      const command = `+QNWPREFCFG="mode_pref",${changes.preferredNetworkType}`;
      commands.push(commands.length === 0 ? `AT${command}` : command);
    }

    if (changes.nr5gMode && !profileControlledFields.nr5gMode) {
      const command = `+QNWPREFCFG="nr5g_disable_mode",${changes.nr5gMode}`;
      commands.push(commands.length === 0 ? `AT${command}` : command);
    }

    if (changes.simSlot) {
      const command = `+QUIMSLOT=${changes.simSlot};+COPS=2;+COPS=0`;
      commands.push(commands.length === 0 ? `AT${command}` : command);
    }

    if (changes.cfunState) {
      const command = `+CFUN=${changes.cfunState}`;
      commands.push(commands.length === 0 ? `AT${command}` : command);
    }

    // Handle AutoSel changes
    if (changes.autoSelState) {
      const command = `+QMBNCFG="AutoSel",${changes.autoSelState}`;
      commands.push(commands.length === 0 ? `AT${command}` : command);
    }

    // Handle MBN profile selection - only when autosel is disabled
    if (
      changes.selectedMbnProfile &&
      (changes.autoSelState === "0" || formData.autoSelState === "0")
    ) {
      // Get the profile name from the index
      const profileIndex = parseInt(changes.selectedMbnProfile);
      const profileName = formData.mbnProfilesList?.[profileIndex];

      if (profileName) {
        // First deactivate, then select by name
        const command = `+QMBNCFG="deactivate";+QMBNCFG="select","${profileName}"`;
        commands.push(commands.length === 0 ? `AT${command}` : command);

        // Add a message about reboot required
        toast({
          title: "MBN Profile Changed",
          description:
            "A full device reboot is required for this change to take effect.",
          duration: 5000,
        });
      }
    }

    return commands.join(";");
  };

  const handleFieldChange = (field: keyof FormData, value: string) => {
    // Only allow changes to fields not controlled by profile
    if (!profileControlledFields[field]) {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  // const forceRerunScripts = async () => {
  //   try {
  //     const response = await fetch("/cgi-bin/quecmanager/settings/force-rerun.sh");
  //     const data = await response.json();

  //     if (data.status === "success") {
  //       toast({
  //         title: "Scripts Restarted",
  //         description: "Scripts have been restarted successfully",
  //       });
  //     } else if (data.status === "info") {
  //       toast({
  //         title: "Info",
  //         description: "No scripts were found to restart",
  //       });
  //     }
  //     else {
  //       throw new Error("Failed to restart scripts");
  //     }
  //   } catch (error) {
  //     console.error("Error rerunning scripts:", error);
  //     toast({
  //       variant: "destructive",
  //       title: "Script Restart Failed",
  //       description: "Failed to restart the required scripts",
  //     });
  //   }
  // };

  const executeATCommand = async (command: string): Promise<boolean> => {
    try {
      console.log("Executing AT command:", command);
      const response = await atCommandSender(command);

      if (response.status === "error") {
        throw new Error(response.status || "Command execution failed");
      }

      if (
        response.response?.status === "error" ||
        response.response?.status === "timeout"
      ) {
        throw new Error(
          response.response.raw_output ||
            `Command execution ${response.response.status}`
        );
      }

      return response.response?.status === "success";
    } catch (error) {
      console.error("AT command execution error:", error);
      throw error;
    }
  };

  const handleSavedSettings = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const changes: Partial<FormData> = {};

      // Special handling for each field type to avoid TypeScript errors
      const fieldKeys = Object.keys(formData) as Array<keyof FormData>;

      fieldKeys.forEach((key) => {
        // Skip profile controlled fields
        if (profileControlledFields[key]) return;

        // Handle array types like mbnProfilesList specially
        if (key === "mbnProfilesList") return; // Skip arrays in change detection

        // Special handling for selectedMbnProfile - include it if changed and autosel is 0
        if (
          key === "selectedMbnProfile" &&
          formData.selectedMbnProfile !== initialData?.selectedMbnProfile &&
          formData.autoSelState === "0"
        ) {
          changes.selectedMbnProfile = formData.selectedMbnProfile;
          return;
        }

        // For all other string fields, do direct comparison
        if (typeof formData[key] === "string") {
          const formValue = formData[key] as string;
          const initialValue = initialData?.[
            key as keyof typeof initialData
          ] as string | undefined;

          if (formValue !== initialValue) {
            changes[key] = formValue;
          }
        }
      });

      if (Object.keys(changes).length === 0) {
        toast({
          title: "No changes detected",
          description: "Try changing some settings before saving",
        });
        setIsSaving(false);
        return;
      }

      // Log the detected changes
      console.log("Detected changes:", changes);

      const command = constructATCommand(changes);

      // Only execute if we have commands to run
      if (command) {
        console.log("Executing command:", command);
        await executeATCommand(command);
      }

      // Add a delay to allow the settings to take effect
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await fetchCellSettingsData();
      setIsDataLoaded(false);

      toast({
        title: "Settings saved!",
        description: "The settings have been saved successfully",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: "Failed to save settings!",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while saving the settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Map PDP type values to display labels
  const getPDPTypeLabel = (value: string) => {
    const pdpTypes: Record<string, string> = {
      IP: "IPv4 Only",
      IPV6: "IPv6 Only",
      IPV4V6: "IPv4 and IPv6",
      P2P: "P2P Protocol",
    };
    return pdpTypes[value] || value;
  };

  // Helper function to get network type label
  const getNetworkTypeLabel = (value: string) => {
    const networkTypes: Record<string, string> = {
      AUTO: "Automatic",
      LTE: "LTE Only",
      "LTE:NR5G": "NR5G-NSA",
      NR5G: "NR5G-SA",
    };
    return networkTypes[value] || value;
  };

  // Helper function to get NR5G mode label
  const getNR5GModeLabel = (value: string) => {
    const nr5gModes: Record<string, string> = {
      "0": "NR5G-SA and NSA Enabled",
      "1": "NR5G-NSA Only",
      "2": "NR5G-SA Only",
    };
    return nr5gModes[value] || value;
  };

  const getCFUNStateLabel = (value: string) => {
    const cfunStates: Record<string, string> = {
      "0": "Minimum Functionality",
      "1": "Full Functionality",
      "4": "Disabled RX/TX",
    };
    return cfunStates[value] || value;
  };

  // Helper function to get Auto Selection state label
  const getAutoSelStateLabel = (value: string) => {
    const autoSelStates: Record<string, string> = {
      "0": "Disabled",
      "1": "Enabled",
    };
    return autoSelStates[value] || value;
  };

  // Helper function to check if any settings are controlled by profile
  const hasProfileControlledSettings = () => {
    return Object.values(profileControlledFields).some((value) => value);
  };

  return (
    <div className="grid grid-cols-1 grid-flow-row gap-8">
      <Card>
        <form onSubmit={handleSavedSettings}>
          <CardHeader>
            <CardTitle>Network Settings</CardTitle>
            <CardDescription>
              Change the network settings of the device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeProfile && hasProfileControlledSettings() && (
              <Alert className="mb-6">
                <LockIcon className="h-4 w-4" color="orange" />
                <AlertTitle>Profile Controlled Settings</AlertTitle>
                <AlertDescription>
                  Some settings are currently being managed by profile "
                  {activeProfile.name}".
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 grid-flow-row gap-6">
              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="APN">
                  Current APN
                  {profileControlledFields.currentAPN && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Profile Controlled)
                    </span>
                  )}
                </Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Input
                    type="text"
                    id="APN"
                    placeholder="Current APN"
                    value={
                      profileControlledFields.currentAPN && activeProfile
                        ? activeProfile.apn
                        : formData.currentAPN
                    }
                    onChange={(e) =>
                      handleFieldChange("currentAPN", e.target.value)
                    }
                    disabled={profileControlledFields.currentAPN || isLoading}
                    className={
                      profileControlledFields.currentAPN
                        ? "bg-muted cursor-not-allowed"
                        : ""
                    }
                  />
                )}
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="APN">
                  APN PDP Type
                  {profileControlledFields.apnPDPType && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Profile Controlled)
                    </span>
                  )}
                </Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Select
                    key={`pdp-type-${
                      profileControlledFields.apnPDPType && activeProfile
                        ? activeProfile.pdp_type
                        : formData.apnPDPType
                    }`}
                    value={
                      profileControlledFields.apnPDPType && activeProfile
                        ? activeProfile.pdp_type
                        : formData.apnPDPType
                    }
                    onValueChange={(value) =>
                      handleFieldChange("apnPDPType", value)
                    }
                    disabled={profileControlledFields.apnPDPType || isLoading}
                  >
                    <SelectTrigger
                      className={
                        profileControlledFields.apnPDPType
                          ? "bg-muted cursor-not-allowed"
                          : ""
                      }
                    >
                      <SelectValue>
                        {(
                          profileControlledFields.apnPDPType && activeProfile
                            ? activeProfile.pdp_type
                            : formData.apnPDPType
                        )
                          ? getPDPTypeLabel(
                              profileControlledFields.apnPDPType &&
                                activeProfile
                                ? activeProfile.pdp_type
                                : formData.apnPDPType
                            )
                          : "Select PDP Type"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>PDP Type</SelectLabel>
                        <SelectItem value="IP">IPv4 Only</SelectItem>
                        <SelectItem value="IPV6">IPv6 Only</SelectItem>
                        <SelectItem value="IPV4V6">IPv4 and IPv6</SelectItem>
                        <SelectItem value="P2P">P2P Protocol</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="MBNAutoSel">MBN Profile Auto Selection</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Select
                    key={`auto-sel-${formData.autoSelState}`}
                    value={formData.autoSelState}
                    onValueChange={(value) =>
                      handleFieldChange("autoSelState", value)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {formData.autoSelState
                          ? getAutoSelStateLabel(formData.autoSelState)
                          : "Select Auto Selection State"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Auto Selection State</SelectLabel>
                        <SelectItem value="1">Enabled</SelectItem>
                        <SelectItem value="0">Disabled</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="MBNProfile">MBN Profile Selection</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Select
                          value={formData.selectedMbnProfile || ""}
                          onValueChange={(value) =>
                            handleFieldChange("selectedMbnProfile", value)
                          }
                          disabled={isLoading || formData.autoSelState === "1"}
                        >
                          <SelectTrigger
                            className={
                              formData.autoSelState === "1"
                                ? "bg-muted cursor-not-allowed"
                                : ""
                            }
                          >
                            <SelectValue placeholder="Select MBN Profile" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Available MBN Profiles</SelectLabel>
                              {formData.mbnProfilesList?.map(
                                (profile, index) => (
                                  <SelectItem
                                    key={`profile-${index}`}
                                    value={String(index)}
                                  >
                                    {profile}
                                  </SelectItem>
                                )
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {formData.autoSelState === "1" &&
                            "Disable Auto Selection to manually select a profile"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              <Separator className="col-span-2 my-2" />

              <div className="grid w-full max-w-sm items-center gap-2">
                <Label>
                  Preferred Network Type
                  {profileControlledFields.preferredNetworkType && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Profile Controlled)
                    </span>
                  )}
                </Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Select
                    key={`network-type-${
                      profileControlledFields.preferredNetworkType &&
                      activeProfile
                        ? activeProfile.network_type
                        : formData.preferredNetworkType
                    }`}
                    value={
                      profileControlledFields.preferredNetworkType &&
                      activeProfile
                        ? activeProfile.network_type
                        : formData.preferredNetworkType
                    }
                    onValueChange={(value) =>
                      handleFieldChange("preferredNetworkType", value)
                    }
                    disabled={
                      profileControlledFields.preferredNetworkType || isLoading
                    }
                  >
                    <SelectTrigger
                      className={
                        profileControlledFields.preferredNetworkType
                          ? "bg-muted cursor-not-allowed"
                          : ""
                      }
                    >
                      <SelectValue>
                        {(
                          profileControlledFields.preferredNetworkType &&
                          activeProfile
                            ? activeProfile.network_type
                            : formData.preferredNetworkType
                        )
                          ? getNetworkTypeLabel(
                              profileControlledFields.preferredNetworkType &&
                                activeProfile
                                ? activeProfile.network_type
                                : formData.preferredNetworkType
                            )
                          : "Select Network Type"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Preferred Network Type</SelectLabel>
                        <SelectItem value="AUTO">Automatic</SelectItem>
                        <SelectItem value="LTE">LTE Only</SelectItem>
                        <SelectItem value="LTE:NR5G">NR5G-NSA</SelectItem>
                        <SelectItem value="NR5G">NR5G-SA</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                <Label>
                  NR5G Mode Control
                  {profileControlledFields.nr5gMode && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Profile Controlled)
                    </span>
                  )}
                </Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Select
                    key={`nr5g-mode-${formData.nr5gMode}`}
                    value={formData.nr5gMode}
                    onValueChange={(value) =>
                      handleFieldChange("nr5gMode", value)
                    }
                    disabled={profileControlledFields.nr5gMode || isLoading}
                  >
                    <SelectTrigger
                      className={
                        profileControlledFields.nr5gMode
                          ? "bg-muted cursor-not-allowed"
                          : ""
                      }
                    >
                      <SelectValue>
                        {formData.nr5gMode
                          ? getNR5GModeLabel(formData.nr5gMode)
                          : "Select NR5G Mode"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>NR5G Mode</SelectLabel>
                        <SelectItem value="0">
                          NR5G-SA and NSA Enabled
                        </SelectItem>
                        <SelectItem value="1">NR5G-NSA Only</SelectItem>
                        <SelectItem value="2">NR5G-SA Only</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                <Label>U-SIM Slot Configuration</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Select
                    key={`sim-slot-${formData.simSlot}`}
                    value={formData.simSlot}
                    onValueChange={(value) =>
                      handleFieldChange("simSlot", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {formData.simSlot
                          ? `U-SIM Slot ${formData.simSlot}`
                          : "Select U-SIM Slot"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>U-SIM Slot</SelectLabel>
                        <SelectItem value="1">U-SIM Slot 1</SelectItem>
                        <SelectItem value="2">U-SIM Slot 2</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                <Label>Cellular Functionality</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Select
                    key={`sim-slot-${formData.cfunState}`}
                    value={formData.cfunState}
                    onValueChange={(value) =>
                      handleFieldChange("cfunState", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {formData.cfunState
                          ? getCFUNStateLabel(formData.cfunState)
                          : "Select CFUN State"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>U-SIM Slot</SelectLabel>
                        <SelectItem value="0">Minimum Functionality</SelectItem>
                        <SelectItem value="1">Full Functionality</SelectItem>
                        <SelectItem value="4">Disabled RX/TX</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="grid border-t py-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default BasicSettings;
