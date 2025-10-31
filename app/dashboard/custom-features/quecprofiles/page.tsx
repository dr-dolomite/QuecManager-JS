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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Grid2X2,
  Loader2,
  List,
  PauseCircle,
  Save,
  Trash2Icon,
  UserRoundPen,
  RefreshCcw,
  MoreHorizontalIcon,
  Edit3Icon,
  PauseCircleIcon,
  PlayCircleIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import confetti from "canvas-confetti";

// Updated Type definitions for our profile data
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
  mobile_provider: string;
  paused?: string; // Add this field for pause/resume feature
}

// Type for profile application status
interface ProfileStatus {
  status: string;
  message: string;
  profile: string;
  progress: number;
  timestamp: number;
}

// Type for the AT command response
interface ATCommandResponse {
  command: string;
  response: string;
  status: string;
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
  // Track last displayed status to avoid repeated messages
  const [lastToastStatus, setLastToastStatus] = useState<string>("");
  // New state for fetching ICCID and IMEI
  const [fetchingDeviceInfo, setFetchingDeviceInfo] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({
    iccid: "",
    imei: "",
    simSlot: "",
  });

  // Form state with fields
  const [formData, setFormData] = useState<Profile>({
    name: "",
    iccid: "",
    imei: "",
    apn: "",
    pdp_type: "IPV4V6",
    lte_bands: "",
    sa_nr5g_bands: "",
    nsa_nr5g_bands: "",
    network_type: "LTE",
    ttl: "0",
    mobile_provider: "Other",
    paused: "0",
  });

  // Error message state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch profiles on component mount
  useEffect(() => {
    fetchProfiles();
    checkProfileStatus();
    fetchDeviceInfo(); // Prefetch device info when component mounts

    // Set up status check interval
    const statusInterval = setInterval(checkProfileStatus, 5000);
    return () => clearInterval(statusInterval);
  }, []);

  // Function to fetch current device ICCID and IMEI
  const fetchDeviceInfo = async () => {
    setFetchingDeviceInfo(true);
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=9"
      );

      if (!response.ok) {
        throw new Error("Failed to fetch device information");
      }

      const data = (await response.json()) as ATCommandResponse[];
      console.log("Device info response:", data);

      let iccid = "";
      let imei = "";
      let simSlot = "";

      // Extract ICCID from AT+ICCID response
      const iccidResponse = data.find((item) => item.command === "AT+ICCID");
      if (iccidResponse && iccidResponse.status === "success") {
        // ICCID is typically a string of numbers in the response
        const match = iccidResponse.response.match(/\d{10,20}/);
        if (match) {
          iccid = match[0];
        }
      }

      // Extract IMEI from AT+CGSN response
      const imeiResponse = data.find((item) => item.command === "AT+CGSN");
      if (imeiResponse && imeiResponse.status === "success") {
        // IMEI is typically a 15-digit number in the response
        const match = imeiResponse.response.match(/\d{15}/);
        if (match) {
          imei = match[0];
        }
      }

      // Extract SIM slot from AT+QUIMSLOT? response
      const simSlotResponse = data.find(
        (item) => item.command === "AT+QUIMSLOT?"
      );
      if (simSlotResponse && simSlotResponse.status === "success") {
        // Response format: +QUIMSLOT: 1 or +QUIMSLOT: 2
        const match = simSlotResponse.response.match(/\+QUIMSLOT:\s*(\d+)/);
        if (match) {
          simSlot = match[1];
        }
      }

      console.log(
        "Extracted device info - ICCID:",
        iccid,
        "IMEI:",
        imei,
        "SIM Slot:",
        simSlot
      );

      // Update state and also immediately set values in form data
      setDeviceInfo({ iccid, imei, simSlot });

      // Directly update the form with the fetched values
      setFormData((prev) => ({
        ...prev,
        iccid: iccid || prev.iccid,
        imei: imei || prev.imei,
      }));
    } catch (error) {
      console.error("Error fetching device information:", error);
      toast({
        title: "Info",
        description: "Could not auto-populate device information",
        variant: "default",
      });
    } finally {
      setFetchingDeviceInfo(false);
    }
  };

  // Function to fetch profiles
  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/profiles/list_profiles.sh"
      );

      if (response.ok) {
        const data = await response.json();

        if (data.status === "success" && Array.isArray(data.profiles)) {
          // Log the data to see what we're getting
          console.log("Fetched profiles:", data.profiles);
          setProfiles(data.profiles);
        } else {
          console.error("Invalid profile data structure:", data);
          setProfiles([]);
        }
      } else {
        console.error("Failed to fetch profiles:", response.statusText);
        setProfiles([]);
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
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
        "/cgi-bin/quecmanager/profiles/check_status.sh"
      );

      if (response.ok) {
        const data = await response.json();

        // Update the status state
        setProfileStatus(data);

        // Only show toast notifications for non-idle status AND active operations (not already applied)
        if (
          data.status !== "idle" &&
          data.status !== lastToastStatus && // Don't repeat the same status
          !data.message.includes("already applied") && // Skip "already applied" messages
          !data.message.includes("Profile already correctly applied") &&
          data.status === "applying" // Only show toast for active operations
        ) {
          toast({
            title: `Profile: ${data.profile}`,
            description: data.message,
            variant: data.status === "error" ? "destructive" : "default",
          });

          // Update last shown status to avoid repeats
          setLastToastStatus(data.status);
        }
      }
    } catch (error) {
      // Silently fail as this is just a background check
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;

    // Special validation for TTL field
    if (id === "ttl") {
      const numValue = parseInt(value);
      if (value === "" || isNaN(numValue)) {
        setFormData({
          ...formData,
          ttl: "0",
        });
        return;
      }

      // Enforce TTL range 0-255
      if (numValue < 0) {
        setFormData({
          ...formData,
          ttl: "0",
        });
        return;
      } else if (numValue > 255) {
        setFormData({
          ...formData,
          ttl: "255",
        });
        return;
      }
    }

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

  // Handler for opening the Create Profile dialog
  const handleOpenCreateDialog = () => {
    setModalMode("create");
    setErrorMessage(null);

    // Fetch latest device info including SIM slot
    fetchDeviceInfo();

    // Reset form with empty values except for device info
    setFormData({
      name: "",
      iccid: deviceInfo.iccid || "",
      imei: deviceInfo.imei || "",
      apn: "",
      pdp_type: "IPV4V6",
      lte_bands: "",
      sa_nr5g_bands: "",
      nsa_nr5g_bands: "",
      network_type: "LTE",
      ttl: "0",
      mobile_provider: "Other",
      paused: "0",
    });

    // Show the modal with pre-populated device info
    setShowModal(true);
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

      // TTL validation
      if (
        formData.ttl &&
        (parseInt(formData.ttl) < 0 || parseInt(formData.ttl) > 255)
      ) {
        setErrorMessage("TTL must be between 0 and 255");
        setIsSubmitting(false);
        return;
      }

      // Format data for API request with fields
      const requestData = {
        name: formData.name,
        iccid: formData.iccid,
        imei: formData.imei || "",
        apn: formData.apn,
        pdp_type: formData.pdp_type,
        lte_bands: formData.lte_bands,
        sa_nr5g_bands: formData.sa_nr5g_bands || "",
        nsa_nr5g_bands: formData.nsa_nr5g_bands || "",
        network_type: formData.network_type,
        ttl: formData.ttl || "0",
        mobile_provider: formData.mobile_provider || "Other",
        paused: "0", // New profiles start active by default
      };

      // Send API request to CGI script
      const response = await fetch(
        "/cgi-bin/quecmanager/profiles/quec_profile_create.sh",
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
          sa_nr5g_bands: "",
          nsa_nr5g_bands: "",
          network_type: "LTE",
          ttl: "0",
          mobile_provider: "Other",
          paused: "0",
        });

        // Show success message
        toast({
          title: "Success",
          description: "Profile created successfully",
          variant: "default",
        });

        // Refresh profiles from server
        await fetchProfiles();

        // Refresh status check to avoid stale data
        await checkProfileStatus();
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

      // TTL validation
      if (
        formData.ttl &&
        (parseInt(formData.ttl) < 0 || parseInt(formData.ttl) > 255)
      ) {
        setErrorMessage("TTL must be between 0 and 255");
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
        sa_nr5g_bands: formData.sa_nr5g_bands || "",
        nsa_nr5g_bands: formData.nsa_nr5g_bands || "",
        network_type: formData.network_type,
        ttl: formData.ttl || "0",
        mobile_provider: formData.mobile_provider || "Other",
        paused: formData.paused || "0", // Maintain pause state during edit
      };

      console.log("Sending update request with data:", requestData);

      // Send API request
      const response = await fetch(
        "/cgi-bin/quecmanager/profiles/quec_profile_edit.sh",
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
          sa_nr5g_bands: "",
          nsa_nr5g_bands: "",
          network_type: "LTE",
          ttl: "0",
          mobile_provider: "Other",
          paused: "0",
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
      const response = await fetch(
        "/cgi-bin/quecmanager/profiles/quec_profile_delete.sh",
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

        // Refresh status check to avoid stale data
        await checkProfileStatus();
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

  // TOGGLE PAUSE FUNCTION
  const toggleProfilePause = async (
    iccid: string,
    name: string,
    currentPausedState: string
  ) => {
    try {
      // New paused state is the opposite of the current state
      const newPausedState = currentPausedState === "1" ? "0" : "1";

      const response = await fetch(
        "/cgi-bin/quecmanager/profiles/toggle_pause.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            iccid,
            paused: newPausedState,
          }),
        }
      );

      // Get response as text first for parsing
      const rawText = await response.text();

      // Try to parse JSON safely with the fix for malformed responses
      let responseData;
      try {
        responseData = parseAPIResponse(rawText);
      } catch (parseError) {
        toast({
          title: "Error",
          description: "Invalid response format from server",
          variant: "destructive",
        });
        return;
      }

      if (responseData.status === "success") {
        toast({
          title: newPausedState === "1" ? "Profile Paused" : "Profile Resumed",
          description: responseData.message,
          variant: "default",
        });

        // Refresh profiles from server
        await fetchProfiles();

        // Refresh status check to avoid stale data
        await checkProfileStatus();
      } else {
        toast({
          title: "Error",
          description:
            responseData.message || "Failed to update profile status",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating the profile",
        variant: "destructive",
      });
    }
  };

  const handleConfettiClick = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
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
      sa_nr5g_bands: profile.sa_nr5g_bands || "",
      nsa_nr5g_bands: profile.nsa_nr5g_bands || "",
      network_type: profile.network_type,
      ttl: profile.ttl || "0",
      mobile_provider: profile.mobile_provider || "Other",
      paused: profile.paused || "0",
    });

    setCurrentProfile(profile);
    setErrorMessage(null);
    setShowModal(true);
  };

  // Function to format network type for display
  const formatNetworkType = (type: string) => {
    switch (type) {
      case "AUTO":
        return "AUTO";
      case "LTE":
        return "4G LTE";
      case "NR5G":
        return "5G SA";
      case "LTE:NR5G":
        return "5G NSA";
      default:
        return type;
    }
  };

  // Enhanced renderStatusBanner function for the React component
  const renderStatusBanner = () => {
    if (!profileStatus || profileStatus.status === "idle") {
      // If there's an idle message and it contains "No profile exists" (our new improved message)
      if (
        profileStatus &&
        profileStatus.message &&
        profileStatus.message.includes("No profile exists")
      ) {
        return (
          <Alert className="mb-1" variant="warning">
            <AlertCircle className="size-5" />
            <AlertTitle>No Profile Found</AlertTitle>
            <AlertDescription>
              No profile exists for the current SIM card. Create a profile to
              configure your network settings.
            </AlertDescription>
          </Alert>
        );
      }
      return null;
    }

    // Handle paused status
    else if (profileStatus.status === "paused") {
      return (
        <Alert className="mb-1" variant="warning">
          <PauseCircle className="size-5" />
          <AlertTitle>Profile Paused</AlertTitle>
          <AlertDescription className="flex justify-between items-center">
            <span>
              {profileStatus.message ||
                `Profile "${profileStatus.profile}" is currently paused. Resume to apply settings.`}
            </span>
          </AlertDescription>
        </Alert>
      );
    }

    // Customize the status message based on content
    let messageToShow = profileStatus.message;
    let titleToShow = "";

    // Handle error messages more gracefully
    if (profileStatus.status === "error") {
      titleToShow = "Profile Issue";

      // Make specific error messages more user-friendly
      if (profileStatus.message.includes("missing the required APN setting")) {
        titleToShow = "Missing APN Setting";
        messageToShow = `Please edit profile "${profileStatus.profile}" and add an APN to enable network connectivity.`;
      } else if (profileStatus.message.includes("Could not detect SIM card")) {
        titleToShow = "SIM Card Not Detected";
        messageToShow =
          "Please check that a SIM card is properly inserted in your device.";
      } else if (
        profileStatus.message.includes("Could not communicate with modem")
      ) {
        titleToShow = "Modem Communication Error";
        messageToShow =
          "Having trouble connecting to the cellular modem. Please check your device.";
      }
    }
    // Handle other statuses as before
    else if (
      profileStatus.status === "success" &&
      (profileStatus.message.includes("already applied") ||
        profileStatus.message.includes("Profile already correctly applied"))
    ) {
      titleToShow = "Profile Active";
      messageToShow = `Profile "${profileStatus.profile}" is active and correctly applied`;
    } else if (profileStatus.status === "applying") {
      titleToShow = "Applying Profile";
    } else if (profileStatus.status === "rebooting") {
      titleToShow = "Device Rebooting";
      messageToShow =
        "Your device is restarting to apply configuration changes.";
    } else {
      titleToShow = "Success";
    }

    return (
      <Alert
        className="mb-1"
        variant={profileStatus.status === "error" ? "destructive" : "success"}
      >
        {profileStatus.status === "applying" ? (
          <Loader2 className="size-5 animate-spin" />
        ) : profileStatus.status === "error" ? (
          <AlertCircle className="size-5" />
        ) : profileStatus.status === "rebooting" ? (
          <RefreshCcw className="size-5 animate-spin" />
        ) : (
          <CheckCircle2 className="size-5" />
        )}
        <AlertTitle>{titleToShow}</AlertTitle>
        <AlertDescription className="flex justify-between items-center">
          <span>{messageToShow}</span>
          {profileStatus.status === "applying" && (
            <span className="font-semibold">{profileStatus.progress}%</span>
          )}
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
          <div className="flex items-center justify-between">
            <Dialog open={showModal} onOpenChange={setShowModal}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenCreateDialog}>
                  <UserRoundPen className="w-4 h-4" />
                  Add New Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="xl:max-w-xl">
                <DialogHeader>
                  <DialogTitle>
                    {modalMode === "create"
                      ? `Add New Profile for SIM ${deviceInfo.simSlot || "?"}`
                      : "Edit Profile"}
                  </DialogTitle>
                  <DialogDescription>
                    {modalMode === "create"
                      ? "Create a new profile for your SIM card."
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
                    <Label htmlFor="name">
                      <span className="text-red-500 mr-1">*</span>Profile Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="My Network Profile"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="grid gap-1.5 col-span-2 md:col-span-1">
                    <Label htmlFor="iccid">
                      <span className="text-red-500 mr-1">*</span>ICCID
                    </Label>
                    <Input
                      id="iccid"
                      placeholder="SIM ICCID"
                      value={formData.iccid}
                      onChange={handleInputChange}
                      disabled={modalMode === "edit"} // ICCID can't be changed in edit mode
                      required
                    />
                  </div>

                  <div className="grid gap-1.5 col-span-2 md:col-span-1">
                    <Label htmlFor="imei">IMEI</Label>
                    <Input
                      id="imei"
                      placeholder="Preferred IMEI"
                      value={formData.imei}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="apn">
                      <span className="text-red-500 mr-1">*</span>APN
                    </Label>
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
                    <Label htmlFor="name">Mobile Provider</Label>
                    <Select
                      value={formData.mobile_provider}
                      onValueChange={(value) =>
                        handleSelectChange("mobile_provider", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mobile Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Verizon">Verizon</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1.5 md:col-span-1">
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

                  <div className="grid gap-1.5 col-span-2 md:col-span-1">
                    <Label htmlFor="nsa_nr5g_bands">NR5G-NSA Bands</Label>
                    <div className="grid gap-0.5">
                      <Input
                        id="nsa_nr5g_bands"
                        placeholder="41,78"
                        value={formData.nsa_nr5g_bands}
                        onChange={handleInputChange}
                      />
                      <p className="text-xs text-muted-foreground italic">
                        Comma-separated list of NSA bands.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-1.5 col-span-2 md:col-span-1">
                    <Label htmlFor="sa_nr5g_bands">NR5G-SA Bands</Label>
                    <div className="grid gap-0.5">
                      <Input
                        id="sa_nr5g_bands"
                        placeholder="41,78"
                        value={formData.sa_nr5g_bands}
                        onChange={handleInputChange}
                      />
                      {/* <p className="text-xs text-muted-foreground italic">
                        Comma-separated list of SA bands.
                      </p> */}
                    </div>
                  </div>

                  <div className="grid gap-1.5">
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
                        <SelectItem value="AUTO">AUTO</SelectItem>
                        <SelectItem value="LTE">LTE Only</SelectItem>
                        <SelectItem value="NR5G">5G-SA Only</SelectItem>
                        <SelectItem value="LTE:NR5G">5G-NSA Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="ttl">TTL Value</Label>
                    <div className="grid gap-0.5">
                      <Input
                        id="ttl"
                        type="number"
                        min="0"
                        max="255"
                        placeholder="0 (disabled)"
                        value={formData.ttl}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  {/* If there are no profiles show Save button with confetti and if there are profiles show regular Save button */}
                  {profiles.length === 0 ? (
                    <Button
                      onClick={() => {
                        if (modalMode === "create") {
                          createProfile();
                          handleConfettiClick();
                        } else {
                          editProfile();
                        }
                      }}
                      // Disable button while submitting and if required fields are empty
                      disabled={
                        isSubmitting ||
                        !formData.name ||
                        !formData.iccid ||
                        !formData.apn
                      }
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
                          {/* <ConfettiButton> */}
                          <Save className="h-4 w-4" />
                          {modalMode === "create"
                            ? "Save Profile"
                            : "Update Profile"}
                          {/* </ConfettiButton> */}
                        </>
                      )}
                    </Button>
                  ) : (
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
                  )}

                  {/* </div> */}
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
              ) : profiles && profiles.length > 0 ? (
                // Actual profiles in grid view
                profiles.map((profile, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="xl:text-xl font-bold tracking-wide">
                          {profile.name}
                        </CardTitle>

                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              aria-label="Open menu"
                              size="icon"
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="[--radius:1rem]"
                          >
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onClick={() => handleEditClick(profile)}
                              >
                                <Edit3Icon />
                                Edit Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleProfilePause(
                                    profile.iccid,
                                    profile.name,
                                    profile.paused || "0"
                                  )
                                }
                              >
                                {profile.paused === "1" ? (
                                  <PlayCircleIcon />
                                ) : (
                                  <PauseCircleIcon />
                                )}

                                {profile.paused === "1"
                                  ? "Resume Profile"
                                  : "Pause Profile"}
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    <Trash2Icon />
                                    Delete Profile
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-sm">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Are you absolutely sure?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will
                                      permanently delete the profile{" "}
                                      <span className="font-semibold">
                                        {profile.name}{" "}
                                      </span>
                                      from the system.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive hover:bg-destructive/90 focus:ring-destructive/50"
                                      onClick={() =>
                                        deleteProfile(
                                          profile.iccid,
                                          profile.name
                                        )
                                      }
                                    >
                                      <Trash2Icon className="h-4 w-4" />
                                      Delete Profile
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center">
                        <Badge variant="secondary" className="text-xs">
                          {formatNetworkType(profile.network_type)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-0.5 col-span-2 md:col-span-1">
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

                        <div className="grid gap-0.5 col-span-2 md:col-span-1">
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

                        <div className="grid gap-0.5 col-span-2 md:col-span-1">
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

                        <div className="grid gap-0.5 col-span-2 md:col-span-1">
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
                            htmlFor={`mobileProvider-${index}`}
                            className="text-sm text-muted-foreground"
                          >
                            Mobile Provider
                          </Label>
                          <p
                            id={`mobileProvider-${index}`}
                            className="font-semibold"
                          >
                            {profile.mobile_provider || "Other"}
                          </p>
                        </div>

                        <div className="grid gap-0.5">
                          <Label
                            htmlFor={`prefTTl-${index}`}
                            className="text-sm text-muted-foreground"
                          >
                            Preferred TTL
                          </Label>
                          <p id={`prefTTL-${index}`} className="font-semibold">
                            {profile.ttl || "0"}
                          </p>
                        </div>

                        <div className="grid gap-0.5 col-span-2 md:col-span-1">
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

                        <div className="grid gap-0.5 col-span-2 md:col-span-1">
                          <Label
                            htmlFor={`prefNRNSABands-${index}`}
                            className="text-sm text-muted-foreground"
                          >
                            Preferred NR5G-NSA Bands
                          </Label>
                          <p
                            id={`prefNRNSABands-${index}`}
                            className="font-semibold"
                          >
                            {profile.nsa_nr5g_bands || "-"}
                          </p>
                        </div>

                        <div className="grid gap-0.5 col-span-2 md:col-span-1">
                          <Label
                            htmlFor={`prefNRSABands-${index}`}
                            className="text-sm text-muted-foreground"
                          >
                            Preferred NR5G-SA Bands
                          </Label>
                          <p
                            id={`prefNRSABands-${index}`}
                            className="font-semibold"
                          >
                            {profile.sa_nr5g_bands || "-"}
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
                  <h3 className="font-medium text-md mb-1">
                    No Profiles Found for SIM {deviceInfo.simSlot || "?"}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Simplify network management with profiles that automatically
                    apply your preferred settings.
                  </p>
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
                      IMEI
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      APN
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      Network
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      TTL
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
                          <Skeleton className="h-5 w-10" />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                          </div>
                        </td>
                      </tr>
                    </>
                  ) : profiles && profiles.length > 0 ? (
                    // Actual profiles in list view
                    profiles.map((profile, index) => (
                      <tr
                        key={index}
                        className="border-t hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-4">
                          <HoverCard>
                            <HoverCardTrigger className="flex items-center gap-x-1">
                              <InfoCircledIcon className="size-4 text-emerald-500" />
                              <p className="underline underline-offset-4 cursor-pointer font-medium ">
                                {profile.name}
                              </p>
                            </HoverCardTrigger>
                            <HoverCardContent className="text-sm font-medium text-center w-auto">
                              <span className="font-semibold mr-4">ICCID</span>
                              {profile.iccid}
                            </HoverCardContent>
                          </HoverCard>
                        </td>
                        <td className="p-4">
                          {profile.imei || "Not specified"}
                        </td>
                        <td className="p-4">
                          <HoverCard>
                            <HoverCardTrigger className="flex items-center gap-x-1">
                              <InfoCircledIcon className="size-4 text-emerald-500" />
                              <p className="underline underline-offset-4 cursor-pointer font-medium ">
                                {profile.apn}
                              </p>
                            </HoverCardTrigger>
                            <HoverCardContent className="text-sm font-semibold text-center w-auto">
                              {profile.pdp_type}
                            </HoverCardContent>
                          </HoverCard>
                        </td>
                        <td className="p-4">
                          <span>{formatNetworkType(profile.network_type)}</span>
                        </td>
                        <td className="p-4">
                          {profile.ttl && parseInt(profile.ttl) > 0 ? (
                            <span>{profile.ttl}</span>
                          ) : (
                            <span>Off</span>
                          )}
                        </td>
                        <td className="p-4">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                aria-label="Open menu"
                                size="icon"
                              >
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="[--radius:1rem]"
                            >
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onClick={() => handleEditClick(profile)}
                                >
                                  <Edit3Icon />
                                  Edit Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    toggleProfilePause(
                                      profile.iccid,
                                      profile.name,
                                      profile.paused || "0"
                                    )
                                  }
                                >
                                  {profile.paused === "1" ? (
                                    <PlayCircleIcon />
                                  ) : (
                                    <PauseCircleIcon />
                                  )}

                                  {profile.paused === "1"
                                    ? "Resume Profile"
                                    : "Pause Profile"}
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                              <DropdownMenuSeparator />
                              <DropdownMenuGroup>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      <Trash2Icon />
                                      Delete Profile
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="max-w-sm">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Are you absolutely sure?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action cannot be undone. This will
                                        permanently delete the profile{" "}
                                        <span className="font-semibold">
                                          {profile.name}{" "}
                                        </span>
                                        from the system.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive hover:bg-destructive/90 focus:ring-destructive/50"
                                        onClick={() =>
                                          deleteProfile(
                                            profile.iccid,
                                            profile.name
                                          )
                                        }
                                      >
                                        <Trash2Icon className="h-4 w-4" />
                                        Delete Profile
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  ) : (
                    // Empty state for list view
                    <tr className="border-t">
                      <td
                        colSpan={6}
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

          {/* Status Banner */}
          {renderStatusBanner()}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuecProfilesPage;
