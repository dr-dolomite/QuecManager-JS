"use client";

import { useCallback, useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import useCellSettingsData from "@/hooks/cell-settings-data";

interface FormData {
  currentAPN?: string;
  apnPDPType?: string;
  preferredNetworkType?: string;
  nr5gMode?: string;
  simSlot?: string;
}

const BasicSettings = () => {
  const toast = useToast();
  const {
    data: initialData,
    isLoading,
    fetchCellSettingsData,
  } = useCellSettingsData();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formData, setFormData] = useState<FormData>({
    currentAPN: "",
    apnPDPType: "",
    preferredNetworkType: "",
    nr5gMode: "",
    simSlot: "",
  });

  // Initialize form data when initial data loads
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const constructATCommand = (changes: Partial<FormData>): string => {
    const commands: string[] = [];

    // Check if both APN and PDP type are present when either is changed
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
      const command = `+QUIMSLOT=${changes.simSlot}`;
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

  const handleSavedSettings = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      // Compare with initial data to find changes
      const changes: Partial<FormData> = {};
      Object.keys(formData).forEach((key) => {
        const k = key as keyof FormData;
        if (formData[k] !== initialData?.[k]) {
          changes[k] = formData[k];
        }
      });

      if (Object.keys(changes).length === 0) {
        toast.toast({
          title: "No changes detected",
          description: "Try changing some settings before saving",
        });
        return;
      }

      const command = constructATCommand(changes);
      console.log("Command to send:", command);

      const response = await fetch("/api/at-handler", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      console.log("Response:", response);
      await fetchCellSettingsData();

      toast.toast({
        title: "Settings saved!",
        description: "The settings have been saved successfully",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.toast({
        variant: "destructive",
        title: "Failed to save settings!",
        description: "An error occurred while saving the settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 grid-flow-row gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Network Settings</CardTitle>
          <CardDescription>
            Change the network settings of the device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 lg:grid-cols-2 grid-flow-row gap-6"
            onSubmit={handleSavedSettings}
          >
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
                  value={formData.apnPDPType}
                  onValueChange={(value) =>
                    handleFieldChange("apnPDPType", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select PDP Type" />
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

            {/* Similar pattern for other fields */}
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label>Preferred Network Type</Label>
              {isLoading ? (
                <Skeleton className="h-8" />
              ) : (
                <Select
                  value={formData.preferredNetworkType}
                  onValueChange={(value) =>
                    handleFieldChange("preferredNetworkType", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Preferred Network Type" />
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
                  value={formData.nr5gMode}
                  onValueChange={(value) =>
                    handleFieldChange("nr5gMode", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select NR5G Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>NR5G Mode</SelectLabel>
                      <SelectItem value="0">NR5G-SA and NSA Enabled</SelectItem>
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
                  value={formData.simSlot}
                  onValueChange={(value) => handleFieldChange("simSlot", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select U-SIM Slot" />
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

            <div className="col-span-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>APN and ICCID Profiles</CardTitle>
          <CardDescription>
            Add a predefined APN based on the ICCID of the SIM card.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 lg:grid-cols-2 grid-flow-row gap-6">
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="APNProfile1">APN Profile 1</Label>
              <Input
                type="text"
                id="APNProfile1"
                placeholder="APN for Profile 1"
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="APN">APN PDP Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select PDP Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>PDP Type</SelectLabel>
                    <SelectItem value="ipv4">IPv4 Only</SelectItem>
                    <SelectItem value="ipv6">IPv6 Only</SelectItem>
                    <SelectItem value="ipv4v6">IPv4 and IPv6</SelectItem>
                    <SelectItem value="p2p">P2P Protocol</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full max-w-sm items-center gap-2 col-span-2">
              <Label htmlFor="APNProfile1">ICCID Profile 1</Label>
              <Input
                type="text"
                id="APNProfile1"
                placeholder="APN for Profile 1"
              />
            </div>

            <Separator className="col-span-2 w-full my-2" />

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="APNProfile2">APN Profile 2</Label>
              <Input
                type="text"
                id="APNProfile2"
                placeholder="APN for Profile 2"
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="APN">APN PDP Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select PDP Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>PDP Type</SelectLabel>
                    <SelectItem value="ipv4">IPv4 Only</SelectItem>
                    <SelectItem value="ipv6">IPv6 Only</SelectItem>
                    <SelectItem value="ipv4v6">IPv4 and IPv6</SelectItem>
                    <SelectItem value="p2p">P2P Protocol</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full max-w-sm items-center gap-2 col-span-2">
              <Label htmlFor="APNProfile1">ICCID Profile 1</Label>
              <Input
                type="text"
                id="APNProfile1"
                placeholder="APN for Profile 1"
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex space-x-6">
          <Button>Save</Button>
          <Button variant="secondary">
            <Trash2 className="h-4 w-4 mr-2" />
            Remove APN Profiles
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default BasicSettings;
