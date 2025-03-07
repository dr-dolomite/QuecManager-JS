"use client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Grid2X2,
  Loader2,
  List,
  MoreVertical,
  PencilLine,
  Save,
  Trash2Icon,
  UserRoundPen,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Type definitions for our profile data
interface Profile {
  name: string;
  iccid: string;
  imei?: string;
  apn: string;
  pdp_type: string;
  lte_bands: string;
  nr5g_bands?: string;
  network_type: string;
}

// Type for profile application status
interface ProfileStatus {
  status: string;
  message: string;
  profile: string;
  progress: number;
  timestamp: number;
}

const QuecProfilesPage = () => {
  const { toast } = useToast();

  // State management
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(
    null
  );

  // Form state
  const [formData, setFormData] = useState<Profile>({
    name: "",
    iccid: "",
    imei: "",
    apn: "",
    pdp_type: "IPV4V6",
    lte_bands: "",
    nr5g_bands: "",
    network_type: "LTE",
  });

  // Error message state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch profiles on component mount
  useEffect(() => {
    fetchProfiles();
    checkProfileStatus();

    // Set up status check interval
    const statusInterval = setInterval(checkProfileStatus, 5000);
    return () => clearInterval(statusInterval);
  }, []);

  // Function to fetch profiles
  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        "/api/cgi-bin/quecmanager/profiles/list_profiles.sh"
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && Array.isArray(data.profiles)) {
          setProfiles(data.profiles);
        } else {
          setProfiles([]);
        }
      } else {
        setProfiles([]);
      }
    } catch (error) {
      setProfiles([]);
      toast({
        title: "Error",
        description: "Failed to load profiles. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to check profile application status
  const checkProfileStatus = async () => {
    try {
      const response = await fetch(
        "/api/cgi-bin/quecmanager/profiles/check_status.sh"
      );

      if (response.ok) {
        const data = await response.json();
        setProfileStatus(data);

        // Show toast notification for active processes
        if (data.status !== "idle") {
          toast({
            title: `Profile: ${data.profile}`,
            description: data.message,
            variant: data.status === "error" ? "destructive" : "default",
          });
        }
      }
    } catch (error) {
      // Silently fail as this is just a background check
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData({
      ...formData,
      [id]: value,
    });
  };

  // Handle select input changes
  const handleSelectChange = (id: string, value: string) => {
    setFormData({
      ...formData,
      [id]: value,
    });
  };

  // Helper function to parse malformed JSON responses
  const parseAPIResponse = (rawText: string) => {
    // Clean the JSON string by finding the actual JSON part
    let cleanedJson = rawText.trim();

    // Extract just the JSON part by finding the first { and proper end
    const jsonStart = cleanedJson.indexOf("{");
    if (jsonStart > 0) {
      // Remove anything before the first opening brace
      cleanedJson = cleanedJson.substring(jsonStart);
    }

    // Find the proper end of the JSON by counting braces
    let depth = 0;
    let properEnd = cleanedJson.length;

    for (let i = 0; i < cleanedJson.length; i++) {
      if (cleanedJson[i] === "{") {
        depth++;
      } else if (cleanedJson[i] === "}") {
        depth--;
        if (depth === 0) {
          properEnd = i + 1; // Position after the matching closing brace
          break;
        }
      }
    }

    // Truncate anything after the proper JSON end
    cleanedJson = cleanedJson.substring(0, properEnd);

    // Now parse the cleaned JSON
    return JSON.parse(cleanedJson);
  };

  // CREATE PROFILE FUNCTION
  const createProfile = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Validation
      if (!formData.name || !formData.iccid || !formData.apn) {
        setErrorMessage("Profile name, ICCID, and APN are required");
        setIsSubmitting(false);
        return;
      }

      // Format data for API request
      const requestData = {
        name: formData.name,
        iccid: formData.iccid,
        imei: formData.imei || "",
        apn: formData.apn,
        pdp_type: formData.pdp_type,
        lte_bands: formData.lte_bands,
        nr5g_bands: formData.nr5g_bands || "",
        network_type: formData.network_type,
      };

      // Send API request to CGI script
      const response = await fetch(
        "/api/cgi-bin/quecmanager/profiles/quec_profile_create.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        }
      );

      // Get response as text first for parsing
      const rawText = await response.text();

      // Try to parse JSON safely with the fix for malformed responses
      let responseData;
      try {
        responseData = parseAPIResponse(rawText);
      } catch (parseError) {
        setErrorMessage(`Invalid response format from server`);
        setIsSubmitting(false);
        return;
      }

      if (responseData.status === "success") {
        // Close modal and reset form
        setShowModal(false);

        // Reset form data
        setFormData({
          name: "",
          iccid: "",
          imei: "",
          apn: "",
          pdp_type: "IPV4V6",
          lte_bands: "",
          nr5g_bands: "",
          network_type: "LTE",
        });

        // Show success message
        toast({
          title: "Success",
          description: "Profile created successfully",
          variant: "default",
        });

        // Refresh profiles from server
        await fetchProfiles();
      } else {
        // Show error message
        setErrorMessage(responseData.message || "Failed to create profile");
      }
    } catch (error) {
      setErrorMessage(`An unexpected error occurred`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // EDIT PROFILE FUNCTION
  const editProfile = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Validation
      if (!formData.name || !formData.iccid || !formData.apn) {
        setErrorMessage("Profile name, ICCID, and APN are required");
        setIsSubmitting(false);
        return;
      }

      // Format data for API request
      const requestData = {
        name: formData.name,
        iccid: formData.iccid,
        imei: formData.imei || "",
        apn: formData.apn,
        pdp_type: formData.pdp_type,
        lte_bands: formData.lte_bands,
        nr5g_bands: formData.nr5g_bands || "",
        network_type: formData.network_type,
      };

      // Send API request
      const response = await fetch(
        "/api/cgi-bin/quecmanager/profiles/quec_profile_edit.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        }
      );

      // Get response as text first for parsing
      const rawText = await response.text();

      // Try to parse JSON safely with the fix for malformed responses
      let responseData;
      try {
        responseData = parseAPIResponse(rawText);
      } catch (parseError) {
        setErrorMessage(`Invalid response format from server`);
        setIsSubmitting(false);
        return;
      }

      if (responseData.status === "success") {
        // Close modal and reset form
        setShowModal(false);

        // Reset form data
        setFormData({
          name: "",
          iccid: "",
          imei: "",
          apn: "",
          pdp_type: "IPV4V6",
          lte_bands: "",
          nr5g_bands: "",
          network_type: "LTE",
        });

        // Show success message
        toast({
          title: "Success",
          description: "Profile updated successfully",
          variant: "default",
        });

        // Refresh profiles from server
        await fetchProfiles();
      } else {
        // Show error message
        setErrorMessage(responseData.message || "Failed to update profile");
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // DELETE PROFILE FUNCTION
  const deleteProfile = async (iccid: string, name: string) => {
    try {
      // Confirm deletion with user
      if (
        !window.confirm(`Are you sure you want to delete profile "${name}"?`)
      ) {
        return;
      }

      const response = await fetch(
        "/api/cgi-bin/quecmanager/profiles/quec_profile_delete.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ iccid }),
        }
      );

      // Get response as text first for parsing
      const rawText = await response.text();

      // Try to parse JSON safely with the fix for malformed responses
      let responseData;
      try {
        responseData = parseAPIResponse(rawText);
      } catch (parseError) {
        // Show error toast
        toast({
          title: "Error",
          description: "Failed to parse server response",
          variant: "destructive",
        });
        return;
      }

      if (responseData.status === "success") {
        // Show success message
        toast({
          title: "Profile Deleted",
          description: `Profile "${name}" has been deleted successfully`,
          variant: "default",
        });

        // Refresh profiles from server
        await fetchProfiles();
      } else {
        // Show error message
        toast({
          title: "Error",
          description: responseData.message || "Failed to delete profile",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting the profile",
        variant: "destructive",
      });
    }
  };

  // Function to show edit modal with profile data
  const handleEditClick = (profile: Profile) => {
    setModalMode("edit");
    setFormData({
      name: profile.name,
      iccid: profile.iccid,
      imei: profile.imei || "",
      apn: profile.apn,
      pdp_type: profile.pdp_type,
      lte_bands: profile.lte_bands,
      nr5g_bands: profile.nr5g_bands || "",
      network_type: profile.network_type,
    });
    setCurrentProfile(profile);
    setErrorMessage(null);
    setShowModal(true);
  };

  // Function to format network type for display
  const formatNetworkType = (type: string) => {
    switch (type) {
      case "LTE":
        return "4G LTE";
      case "NR5G":
        return "5G SA";
      case "LTE:NR5G":
        return "NR5G-NSA w/ LTE";
      default:
        return type;
    }
  };

  // Render profile status banner if active
  const renderStatusBanner = () => {
    if (!profileStatus || profileStatus.status === "idle") return null;

    return (
      <Alert
        className="mb-4"
        variant={profileStatus.status === "error" ? "destructive" : "default"}
      >
        {profileStatus.status === "applying" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : profileStatus.status === "error" ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        <AlertTitle>
          {profileStatus.status === "applying"
            ? "Applying Profile"
            : profileStatus.status === "error"
            ? "Error"
            : "Success"}
        </AlertTitle>
        <AlertDescription className="flex justify-between items-center">
          <span>{profileStatus.message}</span>
          <span className="font-semibold">{profileStatus.progress}%</span>
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>QuecProfiles</CardTitle>
          <CardDescription>
            Configure personalized profiles for your SIM cards to manage
            connectivity settings and network preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-y-8">
          {/* Status Banner */}
          {renderStatusBanner()}

          <div className="flex items-center justify-between">
            <Dialog open={showModal} onOpenChange={setShowModal}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setModalMode("create");
                    setErrorMessage(null);
                    setFormData({
                      name: "",
                      iccid: "",
                      imei: "",
                      apn: "",
                      pdp_type: "IPV4V6",
                      lte_bands: "",
                      nr5g_bands: "",
                      network_type: "LTE",
                    });
                  }}
                >
                  <UserRoundPen className="w-4 h-4" />
                  Add New Profile
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {modalMode === "create"
                      ? "Add New Profile"
                      : "Edit Profile"}
                  </DialogTitle>
                  <DialogDescription>
                    {modalMode === "create"
                      ? "Create a new profile for your SIM card to manage connectivity settings and network preferences."
                      : "Update the settings for this profile."}
                  </DialogDescription>
                </DialogHeader>

                {errorMessage && (
                  <Alert variant="destructive" className="my-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-y-5 gap-x-4 py-4">
                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="name">Profile Name</Label>
                    <Input
                      id="name"
                      placeholder="My Network Profile"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="iccid">ICCID</Label>
                    <Input
                      id="iccid"
                      placeholder="SIM ICCID"
                      value={formData.iccid}
                      onChange={handleInputChange}
                      disabled={modalMode === "edit"} // ICCID can't be changed in edit mode
                      required
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="imei">IMEI</Label>
                    <Input
                      id="imei"
                      placeholder="Preferred IMEI"
                      value={formData.imei}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="apn">APN</Label>
                    <Input
                      id="apn"
                      placeholder="internet"
                      value={formData.apn}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="pdp_type">APN PDP Type</Label>
                    <Select
                      value={formData.pdp_type}
                      onValueChange={(value) =>
                        handleSelectChange("pdp_type", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="PDP Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IP">IPV4</SelectItem>
                        <SelectItem value="IPV6">IPV6</SelectItem>
                        <SelectItem value="IPV4V6">IPV4 & IPV6</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="lte_bands">LTE Bands</Label>
                    <div className="grid gap-0.5">
                      <Input
                        id="lte_bands"
                        placeholder="1,3,7,20"
                        value={formData.lte_bands}
                        onChange={handleInputChange}
                      />
                      <p className="text-xs text-muted-foreground italic">
                        Comma-separated list of LTE bands.
                      </p>
                    </div>
                  </div>

                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="nr5g_bands">NR5G Bands</Label>
                    <div className="grid gap-0.5">
                      <Input
                        id="nr5g_bands"
                        placeholder="41,78"
                        value={formData.nr5g_bands}
                        onChange={handleInputChange}
                      />
                      <p className="text-xs text-muted-foreground italic">
                        Comma-separated list of NR5G bands.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-1.5 col-span-2">
                    <Label htmlFor="network_type">Network Type</Label>
                    <Select
                      value={formData.network_type}
                      onValueChange={(value) =>
                        handleSelectChange("network_type", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Network Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LTE">LTE Only</SelectItem>
                        <SelectItem value="NR5G">NR5G Only</SelectItem>
                        <SelectItem value="LTE:NR5G">
                          NR5G-NSA w/ LTE
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="secondary"
                      onClick={() => setShowModal(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={
                        modalMode === "create" ? createProfile : editProfile
                      }
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {modalMode === "create"
                            ? "Creating..."
                            : "Updating..."}
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          {modalMode === "create"
                            ? "Save Profile"
                            : "Update Profile"}
                        </>
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-1">
              <button
                className={`p-1 rounded ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-gray-700 shadow-sm"
                    : ""
                }`}
                onClick={() => setViewMode("grid")}
              >
                <Grid2X2 size={18} />
              </button>
              <button
                className={`p-1 rounded ${
                  viewMode === "list"
                    ? "bg-white dark:bg-gray-700 shadow-sm"
                    : ""
                }`}
                onClick={() => setViewMode("list")}
              >
                <List size={18} />
              </button>
            </div>
          </div>

          {viewMode === "grid" && (
            <div className="grid gap-4">
              {isLoading ? (
                // Loading skeletons for grid view
                <>
                  <div className="border rounded-lg p-4">
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-20" />
                      <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : profiles.length > 0 ? (
                // Actual profiles in grid view
                profiles.map((profile, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="xl:text-xl font-bold tracking-wide">
                          {profile.name}
                        </CardTitle>
                        <Popover>
                          <PopoverTrigger>
                            <MoreVertical className="h-4 w-4" />
                          </PopoverTrigger>
                          <PopoverContent className="grid gap-2 max-w-[180px]">
                            <Button
                              size="sm"
                              onClick={() => handleEditClick(profile)}
                            >
                              <PencilLine className="w-4 h-4" />
                              Edit Profile
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                deleteProfile(profile.iccid, profile.name)
                              }
                            >
                              <Trash2Icon className="w-4 h-4" />
                              Delete Profile
                            </Button>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <CardDescription>
                        <Badge variant="secondary" className="text-xs">
                          {formatNetworkType(profile.network_type)}
                        </Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-0.5">
                          <Label
                            htmlFor={`ICCID-${index}`}
                            className="text-sm text-muted-foreground"
                          >
                            SIM ICCID
                          </Label>
                          <p id={`ICCID-${index}`} className="font-semibold">
                            {profile.iccid}
                          </p>
                        </div>

                        <div className="grid gap-0.5">
                          <Label
                            htmlFor={`IMEI-${index}`}
                            className="text-sm text-muted-foreground"
                          >
                            Preferred IMEI
                          </Label>
                          <p id={`IMEI-${index}`} className="font-semibold">
                            {profile.imei || "-"}
                          </p>
                        </div>

                        <div className="grid gap-0.5">
                          <Label
                            htmlFor={`APN-${index}`}
                            className="text-sm text-muted-foreground"
                          >
                            Preferred APN
                          </Label>
                          <p id={`APN-${index}`} className="font-semibold">
                            {profile.apn}
                          </p>
                        </div>

                        <div className="grid gap-0.5">
                          <Label
                            htmlFor={`PDP-${index}`}
                            className="text-sm text-muted-foreground"
                          >
                            Preferred APN PDP Type
                          </Label>
                          <p id={`PDP-${index}`} className="font-semibold">
                            {profile.pdp_type}
                          </p>
                        </div>

                        <div className="grid gap-0.5">
                          <Label
                            htmlFor={`prefLTEBands-${index}`}
                            className="text-sm text-muted-foreground"
                          >
                            Preferred LTE Bands
                          </Label>
                          <p
                            id={`prefLTEBands-${index}`}
                            className="font-semibold"
                          >
                            {profile.lte_bands || "-"}
                          </p>
                        </div>

                        <div className="grid gap-0.5">
                          <Label
                            htmlFor={`prefNRBands-${index}`}
                            className="text-sm text-muted-foreground"
                          >
                            Preferred NR5G Bands
                          </Label>
                          <p
                            id={`prefNRBands-${index}`}
                            className="font-semibold"
                          >
                            {profile.nr5g_bands || "-"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                // Empty state
                <div className="text-center py-8 border rounded-lg">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <UserRoundPen className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-1">
                    No Profiles Found
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first profile to manage modem settings
                  </p>
                  <Button onClick={() => setShowModal(true)}>
                    <UserRoundPen className="w-4 h-4" />
                    Add New Profile
                  </Button>
                </div>
              )}
            </div>
          )}

          {viewMode === "list" && (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      Profile Name
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      ICCID
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      APN (PDP Type)
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      Network Type
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    // Loading skeletons for list view
                    <>
                      <tr className="border-t">
                        <td className="p-4">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-3 w-24 mt-1" />
                        </td>
                        <td className="p-4">
                          <Skeleton className="h-5 w-40" />
                        </td>
                        <td className="p-4">
                          <Skeleton className="h-5 w-28" />
                        </td>
                        <td className="p-4">
                          <Skeleton className="h-5 w-20" />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                          </div>
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-4">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-3 w-24 mt-1" />
                        </td>
                        <td className="p-4">
                          <Skeleton className="h-5 w-40" />
                        </td>
                        <td className="p-4">
                          <Skeleton className="h-5 w-28" />
                        </td>
                        <td className="p-4">
                          <Skeleton className="h-5 w-20" />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                          </div>
                        </td>
                      </tr>
                    </>
                  ) : profiles.length > 0 ? (
                    // Actual profiles in list view
                    profiles.map((profile, index) => (
                      <tr
                        key={index}
                        className="border-t hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-4">
                          <div className="font-medium">{profile.name}</div>
                          <div className="text-xs text-muted-foreground">
                            IMEI: {profile.imei || "Not specified"}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-sm">
                          {profile.iccid}
                        </td>
                        <td className="p-4">
                          {profile.apn}{" "}
                          <span className="text-muted-foreground text-xs">
                            ({profile.pdp_type})
                          </span>
                        </td>
                        <td className="p-4">
                          <Badge variant="secondary" className="text-xs">
                            {formatNetworkType(profile.network_type)}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditClick(profile)}
                            >
                              <PencilLine className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() =>
                                deleteProfile(profile.iccid, profile.name)
                              }
                            >
                              <Trash2Icon className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    // Empty state for list view
                    <tr className="border-t">
                      <td
                        colSpan={5}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No profiles found. Create one to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuecProfilesPage;