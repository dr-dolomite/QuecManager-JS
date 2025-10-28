"use client";

import { useState, useEffect } from "react";
import { useAPNConfig } from "@/hooks/apn-config";
import { useToast } from "@/hooks/use-toast";
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
import { Trash2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ProfileData {
  apn: string;
  pdpType: string;
  iccid: string;
}

interface APNProfileFormData {
  profile1: ProfileData;
  profile2: ProfileData;
}

const INITIAL_PROFILE_STATE: ProfileData = {
  apn: "",
  pdpType: "",
  iccid: "",
};

const INITIAL_FORM_STATE: APNProfileFormData = {
  profile1: { ...INITIAL_PROFILE_STATE },
  profile2: { ...INITIAL_PROFILE_STATE },
};

const PDP_TYPES = [
  { value: "IPV4", label: "IPv4 Only" },
  { value: "IPV6", label: "IPv6 Only" },
  { value: "IPV4V6", label: "IPv4 and IPv6" },
  { value: "P2P", label: "P2P Protocol" },
] as const;

const APNProfilesCard = () => {
  const { toast } = useToast();
  const {
    profiles,
    serviceStatus,
    lastActivity,
    isActive,
    isLoading,
    updateAPNProfile,
    deleteAPNProfiles,
    refreshProfiles,
  } = useAPNConfig();

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] =
    useState<APNProfileFormData>(INITIAL_FORM_STATE);

  useEffect(() => {
    if (profiles) {
      setFormData({
        profile1: {
          apn: profiles.profile1?.apn || "",
          pdpType: profiles.profile1?.pdpType || "",
          iccid: profiles.profile1?.iccid || "",
        },
        profile2: {
          apn: profiles.profile2?.apn || "",
          pdpType: profiles.profile2?.pdpType || "",
          iccid: profiles.profile2?.iccid || "",
        },
      });
    }
  }, [profiles]);

  const handleFieldChange = (
    profileId: keyof APNProfileFormData,
    field: keyof ProfileData,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [profileId]: {
        ...prev[profileId],
        [field]: value,
      },
    }));
  };

  const validateProfiles = (): boolean => {
    // Profile 1 is mandatory
    if (
      !formData.profile1.apn ||
      !formData.profile1.pdpType ||
      !formData.profile1.iccid
    ) {
      toast({
        variant: "destructive",
        title: "Invalid Profile 1",
        description: "All fields for Profile 1 are required",
      });
      return false;
    }

    // If any Profile 2 field is filled, all Profile 2 fields are required
    const hasAnyProfile2Data = Object.values(formData.profile2).some(
      (value) => value !== ""
    );
    if (hasAnyProfile2Data) {
      if (
        !formData.profile2.apn ||
        !formData.profile2.pdpType ||
        !formData.profile2.iccid
      ) {
        toast({
          variant: "destructive",
          title: "Invalid Profile 2",
          description:
            "All fields for Profile 2 are required if any field is filled",
        });
        return false;
      }
    }

    return true;
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateProfiles()) {
      return;
    }

    try {
      setIsSaving(true);

      const profile1Success = await updateAPNProfile(
        "profile1",
        formData.profile1
      );

      if (!profile1Success) {
        throw new Error("Failed to update profile");
      }

      // Refresh the profiles data
      refreshProfiles();

      // Show success toast
      toast({
        title: "Success",
        description: "APN profiles have been saved successfully",
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save APN profiles. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete all APN profiles?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const success = await deleteAPNProfiles();
      if (success) {
        setFormData(INITIAL_FORM_STATE);
        // Refresh the profiles data after successful deletion
        refreshProfiles();
        toast({
          title: "Success",
          description: "APN profiles have been deleted successfully",
        });
      } else {
        throw new Error("Failed to delete profiles");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete APN profiles. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderProfileFields = (
    profileId: keyof APNProfileFormData,
    profileNum: number
  ) => (
    <>
      <div className="grid w-full max-w-sm items-center gap-2">
        <Label htmlFor={`APNProfile${profileNum}`}>
          APN Profile {profileNum}
        </Label>
        {isLoading ? (
          <Skeleton className="h-8" />
        ) : (
          <Input
            type="text"
            id={`APNProfile${profileNum}`}
            placeholder={`APN for Profile ${profileNum}`}
            value={formData[profileId].apn}
            onChange={(e) =>
              handleFieldChange(profileId, "apn", e.target.value)
            }
          />
        )}
      </div>

      <div className="grid w-full max-w-sm items-center gap-2">
        <Label htmlFor={`PDPType${profileNum}`}>APN PDP Type</Label>
        {isLoading ? (
          <Skeleton className="h-8" />
        ) : (
          <Select
            key={`pdp-type-${formData[profileId].pdpType}`}
            value={formData[profileId].pdpType || ""}
            onValueChange={(value) =>
              handleFieldChange(profileId, "pdpType", value)
            }
          >
            <SelectTrigger id={`PDPType${profileNum}`}>
              <SelectValue placeholder="Select PDP Type">
                {getPDPTypeLabel(formData[profileId].pdpType)}
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

      <div className="grid w-full max-w-sm items-center gap-2 col-span-2">
        <Label htmlFor={`ICCIDProfile${profileNum}`}>
          ICCID Profile {profileNum}
        </Label>
        {isLoading ? (
          <Skeleton className="h-8" />
        ) : (
          <Input
            type="text"
            id={`ICCIDProfile${profileNum}`}
            placeholder={`ICCID for Profile ${profileNum}`}
            value={formData[profileId].iccid}
            onChange={(e) =>
              handleFieldChange(profileId, "iccid", e.target.value)
            }
          />
        )}
      </div>
    </>
  );

  const getPDPTypeLabel = (pdpType: string | undefined | null): string => {
    const pdpTypeMap: Record<string, string> = {
      IPV4: "IPv4 Only",
      IPV6: "IPv6 Only",
      IPV4V6: "IPv4 and IPv6",
      P2P: "P2P Protocol",
    };
    return pdpType && pdpTypeMap[pdpType]
      ? pdpTypeMap[pdpType]
      : "Select PDP Type";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center">
            {serviceStatus &&
              (serviceStatus.status === "running" ? (
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
              ))}
            APN and ICCID Profiles
          </div>
        </CardTitle>
        <CardDescription>
          Configure APN profiles based on SIM card ICCID. Profile 1 is required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 lg:grid-cols-2 grid-flow-row gap-6"
          onSubmit={handleSave}
          onClick={(e) => console.log("Form clicked")} // Add this temporarily
        >
          {renderProfileFields("profile1", 1)}

          <Separator className="col-span-2 w-full my-2" />

          {renderProfileFields("profile2", 2)}

          <Separator className="col-span-2 w-full my-2" />

          {/* {lastActivity && (
          <Alert className="mb-6">
            <AlertDescription>
              {lastActivity}
            </AlertDescription>
          </Alert>
        )} */}

          <div className="col-span-2">
            <CardFooter className="border-t py-4 grid md:grid-cols-2 grid-cols-1 gap-4 px-0">
              <Button
                type="submit"
                disabled={isSaving || isDeleting || isActive}
                onClick={(e) => {
                  console.log("Button clicked directly"); // Add this
                }}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSaving || isDeleting || !isActive}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete All Profiles"}
              </Button>
            </CardFooter>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default APNProfilesCard;
