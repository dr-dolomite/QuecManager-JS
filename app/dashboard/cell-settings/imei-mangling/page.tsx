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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { useIMEIConfig } from "@/hooks/imei-config";

interface IMEIProfile {
  imei: string;
  iccid: string;
}

interface IMEIProfileFormData {
  profile1: IMEIProfile;
  profile2: IMEIProfile;
}

const INITIAL_PROFILE_STATE: IMEIProfile = {
  imei: "",
  iccid: "",
};

const INITIAL_FORM_STATE: IMEIProfileFormData = {
  profile1: { ...INITIAL_PROFILE_STATE },
  profile2: { ...INITIAL_PROFILE_STATE },
};

const IMEIManglingPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentIMEI, setCurrentIMEI] = useState("");
  const [newIMEI, setNewIMEI] = useState("");
  const [originalFormData, setOriginalFormData] =
    useState<IMEIProfileFormData>(INITIAL_FORM_STATE);

  const [formData, setFormData] =
    useState<IMEIProfileFormData>(INITIAL_FORM_STATE);
  const { profiles, hasActiveProfile, updateIMEIProfile, deleteIMEIProfiles } =
    useIMEIConfig();

  const { toast } = useToast();

  const fetchIMEI = useCallback(async () => {
    try {
      setIsLoading(true);
      const command = "AT+CGSN";
      const encodedCommand = encodeURIComponent(command);
      const response = await fetch("/cgi-bin/atinout_handler.sh", {
        //   const response = await fetch("/api/at-handler", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: `command=${encodedCommand}`,
        // body: JSON.stringify({ command }),
      });

      const rawResult = await response.text();
      // Regex to match IMEI in a response format
      const imeiMatch = rawResult.match(/\d{15}/);
      const imei = imeiMatch ? imeiMatch[0] : null;

      if (imei) {
        setCurrentIMEI(imei);
        setNewIMEI(imei);
      } else {
        throw new Error("IMEI not found in response");
      }

      toast({
        title: "Success",
        description: "Fetched IMEI settings successfully",
      });
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

  useEffect(() => {
    fetchIMEI();
    if (profiles) {
      setFormData({
        profile1: {
          imei: profiles.profile1?.imei || "",
          iccid: profiles.profile1?.iccid || "",
        },
        profile2: {
          imei: profiles.profile2?.imei || "",
          iccid: profiles.profile2?.iccid || "",
        },
      });
      setOriginalFormData({
        profile1: {
          imei: profiles.profile1?.imei || "",
          iccid: profiles.profile1?.iccid || "",
        },
        profile2: {
          imei: profiles.profile2?.imei || "",
          iccid: profiles.profile2?.iccid || "",
        },
      });
    }
  }, [fetchIMEI, profiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const command = `AT+EGMR=1,7,"${newIMEI};+QPOWD=1"`;
      const encodedCommand = encodeURIComponent(command);
      const response = await fetch("/cgi-bin/atinout_handler.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: `command=${encodedCommand}`,
      });

      if (!response.ok) {
        throw new Error("Failed to update IMEI");
      }

      // The device will reboot after this command, so we don't need to handle the response
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

  const validateProfiles = (): boolean => {
    // Profile 1 is mandatory
    if (
      !formData.profile1.imei ||
      !formData.profile1.iccid
    ) {
      toast({
        variant: "destructive",
        title: "Invalid Profile 1",
        description: "Both IMEI and ICCID are required for Profile 1",
      });
      return false;
    }

    // Validate IMEI format for Profile 1
    if (!/^\d{15}$/.test(formData.profile1.imei)) {
      toast({
        variant: "destructive",
        title: "Invalid IMEI in Profile 1",
        description: "IMEI must be exactly 15 digits",
      });
      return false;
    }

    // If any Profile 2 field is filled, all Profile 2 fields are required
    const hasAnyProfile2Data = Object.values(formData.profile2).some(
      (value) => value !== ""
    );
    if (hasAnyProfile2Data) {
      if (!formData.profile2.imei || !formData.profile2.iccid) {
        toast({
          variant: "destructive",
          title: "Invalid Profile 2",
          description:
            "Both IMEI and ICCID are required if any Profile 2 field is filled",
        });
        return false;
      }

      // Validate IMEI format for Profile 2
      if (!/^\d{15}$/.test(formData.profile2.imei)) {
        toast({
          variant: "destructive",
          title: "Invalid IMEI in Profile 2",
          description: "IMEI must be exactly 15 digits",
        });
        return false;
      }
    }

    return true;
  };

  const handleSaveProfiles = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!validateProfiles()) {
      return;
    }
  
    setIsSaving(true);
  
    try {
      // Always update Profile 1
      await updateIMEIProfile("profile1", formData.profile1);
  
      // Only update Profile 2 if it has data
      const hasProfile2Data = Object.values(formData.profile2).some(
        (value) => value !== ""
      );
      if (hasProfile2Data) {
        await updateIMEIProfile("profile2", formData.profile2);
      }
  
      // Assume the updates were successful, since the device will restart
      toast({
        title: "Success",
        description: "IMEI profiles have been saved successfully. Rebooting...",
        duration: 90000,
      });

      // After 90 seconds, refresh the page to show the new IMEI
      setTimeout(() => {
        window.location.reload();
      }, 90000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save IMEI profiles. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfiles = async () => {
    if (!confirm("Are you sure you want to delete all IMEI profiles?")) {
      return;
    }
    setIsDeleting(true);
    try {
      const success = await deleteIMEIProfiles();
      if (success) {
        setFormData(INITIAL_FORM_STATE);
        toast({
          title: "Success",
          description: "IMEI profiles have been deleted successfully",
        });
        // Timeout for 2 seconds to allow the toast to show
      } else {
        throw new Error("Failed to delete profiles");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete IMEI profiles. Please try again.",
      });
    } finally {
      // Wait for the toast to show before resetting the state
      setTimeout(() => {
        setIsDeleting(false);
      }, 2000);
    }
  };

  const handleInputChange = (
    profile: "profile1" | "profile2",
    field: keyof IMEIProfile,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [profile]: {
        ...prev[profile],
        [field]: value,
      },
    }));
  };

  const hasFormDataChanged = () => {
    return (
      formData.profile1.imei !== originalFormData.profile1.imei ||
      formData.profile1.iccid !== originalFormData.profile1.iccid ||
      formData.profile2.imei !== originalFormData.profile2.imei ||
      formData.profile2.iccid !== originalFormData.profile2.iccid
    );
  };

  return (
    <div className="grid gap-8">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>IMEI Mangling</CardTitle>
            <CardDescription className="flex items-center justify-between">
              Change the IMEI of the device.
              <div className="flex items-center text-orange-500">
                <TriangleAlert className="size-4 mr-1" />
                Do at your own risk!
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="IMEI">Change Current IMEI</Label>
              {isLoading ? (
                <Skeleton className="h-8" />
              ) : (
                <div className="grid gap-1.5">
                  {hasActiveProfile ? (
                    <div className="relative w-full">
                      <HoverCard>
                        <HoverCardTrigger>
                          <Input
                            className="pr-9"
                            placeholder={currentIMEI}
                            disabled
                          />

                          <TriangleAlert className="absolute right-0 top-0 m-2.5 h-4 w-4 text-muted-foreground" />
                        </HoverCardTrigger>
                        <HoverCardContent className="text-sm">
                          You cannot use this feature while IMEI profiles are
                          active.
                        </HoverCardContent>
                      </HoverCard>
                    </div>
                  ) : (
                    <Input
                      type="text"
                      id="IMEI"
                      value={newIMEI}
                      onChange={(e) => setNewIMEI(e.target.value)}
                      placeholder={currentIMEI}
                    />
                  )}
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
              disabled={isLoading || newIMEI === currentIMEI}
            >
              {isLoading ? "Processing..." : "Change IMEI"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ICCID Based IMEI Mangling</CardTitle>
          <CardDescription className="flex items-center justify-between">
            Change the IMEI of the device based on the ICCID.
            <div className="flex items-center text-orange-500">
              <TriangleAlert className="size-4 mr-1" />
              Do at your own risk!
            </div>
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveProfiles}>
          <CardContent>
            <div className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="IMEI-prof1">IMEI for Profile 1</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Input
                    type="text"
                    id="IMEI-prof1"
                    placeholder="IMEI for Profile 1"
                    value={formData.profile1.imei}
                    onChange={(e) =>
                      handleInputChange("profile1", "imei", e.target.value)
                    }
                  />
                )}
              </div>
              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="ICCID-prof1">ICCID for Profile 1</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Input
                    type="text"
                    id="ICCID-prof1"
                    placeholder="ICCID for Profile 1"
                    value={formData.profile1.iccid}
                    onChange={(e) =>
                      handleInputChange("profile1", "iccid", e.target.value)
                    }
                  />
                )}
              </div>
              <Separator className="col-span-full my-2" />
              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="IMEI-prof2">IMEI for Profile 2</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Input
                    type="text"
                    id="IMEI-prof2"
                    placeholder="IMEI for Profile 2"
                    value={formData.profile2.imei}
                    onChange={(e) =>
                      handleInputChange("profile2", "imei", e.target.value)
                    }
                  />
                )}
              </div>
              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="ICCID-prof2">ICCID for Profile 2</Label>
                {isLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <Input
                    type="text"
                    id="ICCID-prof2"
                    placeholder="ICCID for Profile 2"
                    value={formData.profile2.iccid}
                    onChange={(e) =>
                      handleInputChange("profile2", "iccid", e.target.value)
                    }
                  />
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="grid grid-cols-2 grid-flow-row gap-6 border-t py-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isSaving || !hasFormDataChanged()}
            >
              {isSaving ? "Saving..." : "Save IMEI Profiles"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleDeleteProfiles}
              disabled={isLoading || isDeleting}
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Deleting..." : "Delete All Profiles"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default IMEIManglingPage;
