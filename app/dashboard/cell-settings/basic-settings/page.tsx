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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

import useCellSettingsData from "@/hooks/cell-settings-data";
import APNProfilesCard from "@/components/pages/apn-profile-card";

interface FormData {
  currentAPN: string;
  apnPDPType: string;
  preferredNetworkType: string;
  nr5gMode: string;
  simSlot: string;
}

const BasicSettings = () => {
  const { toast } = useToast();
  const {
    data: initialData,
    isLoading,
    fetchCellSettingsData,
  } = useCellSettingsData();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [formData, setFormData] = useState<FormData>({
    currentAPN: "",
    apnPDPType: "",
    preferredNetworkType: "",
    nr5gMode: "",
    simSlot: "",
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
      };
      setFormData(sanitizedData);
      setIsDataLoaded(true);
      // toast({
      //   title: "Success",
      //   description: "The settings have been loaded successfully",
      // });
    }
  }, [initialData, isDataLoaded]);

  // Reset isDataLoaded when initialData changes
  useEffect(() => {
    if (!initialData) {
      setIsDataLoaded(false);
    }
  }, [initialData]);

  const constructATCommand = (changes: Partial<FormData>): string => {
    const commands: string[] = [];

    if (changes.currentAPN || changes.apnPDPType) {
      const pdpType = changes.apnPDPType || formData.apnPDPType;
      const apn = changes.currentAPN || formData.currentAPN;
      commands.push(`AT+CGDCONT=1,"${pdpType}","${apn}"`);
    }

    if (changes.preferredNetworkType) {
      const command = `+QNWPREFCFG="mode_pref",${changes.preferredNetworkType}`;
      commands.push(commands.length === 0 ? `AT${command}` : command);
    }

    if (changes.nr5gMode) {
      const command = `+QNWPREFCFG="nr5g_disable_mode",${changes.nr5gMode}`;
      commands.push(commands.length === 0 ? `AT${command}` : command);
    }

    if (changes.simSlot) {
      const command = `+QUIMSLOT=${changes.simSlot};+COPS=2;+COPS=0`;
      commands.push(commands.length === 0 ? `AT${command}` : command);
    }

    return commands.join(";");
  };

  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const forceRerunScripts = async () => {
    try {
      const response = await fetch("/cgi-bin/settings/force-rerun.sh");
      const data = await response.json();
      
      if (data.status === "success") {
        toast({
          title: "Scripts Restarted",
          description: "Scripts have been restarted successfully",
        });
      } else if (data.status === "info") {
        toast({
          title: "Info",
          description: "No scripts were found to restart",
        });
      }
      else {
        throw new Error("Failed to restart scripts");
      }
    } catch (error) {
      console.error("Error rerunning scripts:", error);
      toast({
        variant: "destructive",
        title: "Script Restart Failed",
        description: "Failed to restart the required scripts",
      });
    }
  };

  const handleSavedSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const changes: Partial<FormData> = {};
      Object.keys(formData).forEach((key) => {
        const k = key as keyof FormData;
        if (formData[k] !== initialData?.[k]) {
          changes[k] = formData[k];
        }
      });

      if (Object.keys(changes).length === 0) {
        toast({
          title: "No changes detected",
          description: "Try changing some settings before saving",
        });
        return;
      }

      const command = constructATCommand(changes);
      const encodedCommand = encodeURIComponent(command);
      const response = await fetch(`/cgi-bin/at_command?command=${encodedCommand}`, {
        method: "GET", // CGI scripts typically expect GET requests with query parameters
        headers: {
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      await fetchCellSettingsData();
      setIsDataLoaded(false); // Reset to allow re-initialization

      toast({
        title: "Settings saved!",
        description: "The settings have been saved successfully",
        duration: 3000,
      });

      // If SIM slot was changed, trigger the force-rerun script
      if (changes.simSlot) {
        // wait for 3.1 seconds before restarting scripts
        setTimeout(() => {
          forceRerunScripts();
        }, 3100);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: "Failed to save settings!",
        description: "An error occurred while saving the settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Map PDP type values to display labels
  const getPDPTypeLabel = (value: string) => {
    const pdpTypes: Record<string, string> = {
      "IPV4": "IPv4 Only",
      "IPV6": "IPv6 Only",
      "IPV4V6": "IPv4 and IPv6",
      "P2P": "P2P Protocol"
    };
    return pdpTypes[value] || value;
  };

  // Helper function to get network type label
  const getNetworkTypeLabel = (value: string) => {
    const networkTypes: Record<string, string> = {
      "AUTO": "Automatic",
      "LTE": "LTE Only",
      "LTE:NR5G": "NR5G-NSA",
      "NR5G": "NR5G-SA"
    };
    return networkTypes[value] || value;
  };

  // Helper function to get NR5G mode label
  const getNR5GModeLabel = (value: string) => {
    const nr5gModes: Record<string, string> = {
      "0": "NR5G-SA and NSA Enabled",
      "1": "NR5G-NSA Only",
      "2": "NR5G-SA Only"
    };
    return nr5gModes[value] || value;
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
            <div className="grid grid-cols-1 lg:grid-cols-2 grid-flow-row gap-6">
              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="APN">Current APN</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Input
                    type="text"
                    id="APN"
                    placeholder="Current APN"
                    value={formData.currentAPN}
                    onChange={(e) =>
                      handleFieldChange("currentAPN", e.target.value)
                    }
                  />
                )}
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="APN">APN PDP Type</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Select
                    key={`pdp-type-${formData.apnPDPType}`}
                    value={formData.apnPDPType}
                    onValueChange={(value) =>
                      handleFieldChange("apnPDPType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {formData.apnPDPType ? getPDPTypeLabel(formData.apnPDPType) : "Select PDP Type"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>PDP Type</SelectLabel>
                        <SelectItem value="IPV4">IPv4 Only</SelectItem>
                        <SelectItem value="IPV6">IPv6 Only</SelectItem>
                        <SelectItem value="IPV4V6">IPv4 and IPv6</SelectItem>
                        <SelectItem value="P2P">P2P Protocol</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                <Label>Preferred Network Type</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Select
                    key={`network-type-${formData.preferredNetworkType}`}
                    value={formData.preferredNetworkType}
                    onValueChange={(value) =>
                      handleFieldChange("preferredNetworkType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {formData.preferredNetworkType ? getNetworkTypeLabel(formData.preferredNetworkType) : "Select Network Type"}
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
                <Label>NR5G Mode Control</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Select
                    key={`nr5g-mode-${formData.nr5gMode}`}
                    value={formData.nr5gMode}
                    onValueChange={(value) =>
                      handleFieldChange("nr5gMode", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {formData.nr5gMode ? getNR5GModeLabel(formData.nr5gMode) : "Select NR5G Mode"}
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
                        {formData.simSlot ? `U-SIM Slot ${formData.simSlot}` : "Select U-SIM Slot"}
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
            </div>
          </CardContent>
          <CardFooter className="grid border-t py-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <APNProfilesCard />
    </div>
  );
};

export default BasicSettings;