"use client";

import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  Trash2,
  Upload,
  User,
  Loader2,
  RefreshCw,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfilePictureResponse {
  status: string;
  code?: string;
  message: string;
  data?: {
    exists: boolean;
    size: number;
    modified: number;
    type: string;
    data: string;
  };
}

interface UploadResponse {
  status: string;
  message: string;
  data?: {
    size: number;
    path: string;
  };
}

interface MeasurementUnitResponse {
  status: string;
  message: string;
  data?: {
    unit: "km" | "mi";
    isDefault: boolean;
  };
}

interface PingSettingsResponse {
  status: string;
  message: string;
  data?: {
    enabled: boolean;
    isDefault: boolean;
  };
}

const PersonalizationPage = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [hasProfileImage, setHasProfileImage] = useState<boolean>(false);
  const [measurementUnit, setMeasurementUnit] = useState<"km" | "mi">("km");
  const [isUnitLoading, setIsUnitLoading] = useState<boolean>(false);
  const [isUnitDefault, setIsUnitDefault] = useState<boolean>(true);
  const [pingEnabled, setPingEnabled] = useState<boolean>(true);
  const [isPingLoading, setIsPingLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cache keys for localStorage
  const CACHE_KEY = "profile_picture_data";
  const CACHE_METADATA_KEY = "profile_picture_metadata";

  // Load cached image and fetch data immediately on component mount
  useEffect(() => {
    loadCachedImage();
    fetchProfilePicture();
    fetchMeasurementUnit();
    fetchPingSettings();
  }, []);

  const loadCachedImage = () => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        setProfileImage(cachedData);
        setHasProfileImage(true);
      }
    } catch (error) {
      console.error("Error loading cached image:", error);
    }
  };

  const updateCache = (
    imageData: string,
    metadata: { size: number; modified: number; type: string }
  ) => {
    try {
      localStorage.setItem(CACHE_KEY, imageData);
      localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error("Error updating cache:", error);
      // If localStorage is full, clear the cache and try again
      if (error instanceof Error && error.name === "QuotaExceededError") {
        clearCache();
        try {
          localStorage.setItem(CACHE_KEY, imageData);
          localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
        } catch (retryError) {
          console.error(
            "Failed to cache image even after clearing:",
            retryError
          );
        }
      }
    }
  };

  const clearCache = () => {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_METADATA_KEY);
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  };

  const getCachedMetadata = () => {
    try {
      const metadata = localStorage.getItem(CACHE_METADATA_KEY);
      return metadata ? JSON.parse(metadata) : null;
    } catch (error) {
      console.error("Error getting cached metadata:", error);
      return null;
    }
  };

  const fetchProfilePicture = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/profile_picture.sh"
      );
      const data: ProfilePictureResponse = await response.json();

      if (data.status === "success" && data.data?.exists) {
        const serverMetadata = {
          size: data.data.size,
          modified: data.data.modified,
          type: data.data.type,
        };

        // Check if cached version is still valid
        const cachedMetadata = getCachedMetadata();
        const isValidCache =
          cachedMetadata &&
          cachedMetadata.size === serverMetadata.size &&
          cachedMetadata.modified === serverMetadata.modified &&
          cachedMetadata.type === serverMetadata.type;

        if (!isValidCache) {
          // Cache is invalid or doesn't exist, update with server data
          if (data.data.data) {
            setProfileImage(data.data.data);
            setHasProfileImage(true);
            updateCache(data.data.data, serverMetadata);
          }
        } else {
          // Cache is valid, ensure UI state is correct
          setHasProfileImage(true);
        }
      } else {
        // No profile picture on server, clear cache and UI
        setProfileImage(null);
        setHasProfileImage(false);
        clearCache();
      }
    } catch (error) {
      console.error("Error fetching profile picture:", error);
      // On error, keep cached image if available, otherwise show fallback
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (!cachedData) {
        setProfileImage(null);
        setHasProfileImage(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateImageFile = (
    file: File
  ): { valid: boolean; error?: string } => {
    // Check file type - be more permissive with MIME types
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/pjpeg", // IE JPEG variant
      "image/x-png", // Some browsers report PNG this way
    ];

    if (!allowedTypes.includes(file.type)) {
      // If MIME type is not recognized, check file extension
      const fileName = file.name.toLowerCase();
      const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const hasValidExtension = validExtensions.some((ext) =>
        fileName.endsWith(ext)
      );

      if (!hasValidExtension) {
        return {
          valid: false,
          error: `Invalid file type: ${file.type}. Please select a JPEG, PNG, GIF, or WebP image.`,
        };
      }
    }

    // Check file size (3MB limit)
    const maxSize = 3 * 1024 * 1024; // 3MB in bytes
    if (file.size > maxSize) {
      return {
        valid: false,
        error: "File too large. Please select an image smaller than 3MB.",
      };
    }

    // Check minimum file size (1KB to avoid empty files)
    const minSize = 1024; // 1KB
    if (file.size < minSize) {
      return {
        valid: false,
        error:
          "File too small. Please select a valid image file (minimum 1KB).",
      };
    }

    return { valid: true };
  };

  const validateImageContent = (
    file: File
  ): Promise<{ valid: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          resolve({ valid: false, error: "Could not read file content" });
          return;
        }

        const uint8Array = new Uint8Array(arrayBuffer);

        // Check magic bytes for common image formats
        if (uint8Array.length < 4) {
          resolve({
            valid: false,
            error: "File too small to be a valid image",
          });
          return;
        }

        // JPEG: FF D8
        if (uint8Array[0] === 0xff && uint8Array[1] === 0xd8) {
          resolve({ valid: true });
          return;
        }

        // PNG: 89 50 4E 47
        if (
          uint8Array.length >= 8 &&
          uint8Array[0] === 0x89 &&
          uint8Array[1] === 0x50 &&
          uint8Array[2] === 0x4e &&
          uint8Array[3] === 0x47
        ) {
          resolve({ valid: true });
          return;
        }

        // GIF: 47 49 46 38
        if (
          uint8Array.length >= 6 &&
          uint8Array[0] === 0x47 &&
          uint8Array[1] === 0x49 &&
          uint8Array[2] === 0x46 &&
          uint8Array[3] === 0x38
        ) {
          resolve({ valid: true });
          return;
        }

        // WebP: RIFF and WEBP signature
        if (uint8Array.length >= 12) {
          const riffCheck =
            uint8Array[0] === 0x52 &&
            uint8Array[1] === 0x49 &&
            uint8Array[2] === 0x46 &&
            uint8Array[3] === 0x46;
          const webpCheck =
            uint8Array[8] === 0x57 &&
            uint8Array[9] === 0x45 &&
            uint8Array[10] === 0x42 &&
            uint8Array[11] === 0x50;
          if (riffCheck && webpCheck) {
            resolve({ valid: true });
            return;
          }
        }

        resolve({
          valid: false,
          error: "File does not appear to be a valid image format",
        });
      };

      reader.onerror = () => {
        resolve({ valid: false, error: "Error reading file content" });
      };

      // Read first 16 bytes for magic number check
      reader.readAsArrayBuffer(file.slice(0, 16));
    });
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Basic file validation
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({
        title: "Invalid File",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    // Content validation (magic bytes)
    const contentValidation = await validateImageContent(file);
    if (!contentValidation.valid) {
      toast({
        title: "Invalid Image File",
        description:
          contentValidation.error ||
          "The selected file does not appear to be a valid image.",
        variant: "destructive",
      });
      return;
    }

    uploadProfilePicture(file);
  };

  const uploadProfilePicture = async (file: File) => {
    setIsUploading(true);

    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/profile_picture.sh",
        {
          method: "POST",
          body: file, // Send the file directly as raw binary data
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: UploadResponse = await response.json();

      if (result.status === "success") {
        toast({
          title: "Profile Picture Updated",
          description: "Your profile picture has been updated successfully.",
        });
        // Refresh the profile picture
        await fetchProfilePicture();

        // Dispatch custom event to notify other components (like layout.tsx)
        window.dispatchEvent(new CustomEvent("profilePictureUpdated"));
      } else {
        throw new Error(result.message || "Failed to upload profile picture");
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      toast({
        title: "Upload Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to upload profile picture.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const deleteProfilePicture = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/profile_picture.sh",
        {
          method: "DELETE",
        }
      );

      const result: UploadResponse = await response.json();

      if (result.status === "success") {
        toast({
          title: "Profile Picture Deleted",
          description: "Your profile picture has been removed successfully.",
        });
        setProfileImage(null);
        setHasProfileImage(false);
        // Clear cache when deleting
        clearCache();

        // Dispatch custom event to notify other components (like layout.tsx)
        window.dispatchEvent(new CustomEvent("profilePictureDeleted"));
      } else {
        throw new Error(result.message || "Failed to delete profile picture");
      }
    } catch (error) {
      console.error("Error deleting profile picture:", error);
      toast({
        title: "Delete Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete profile picture.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const forceRefresh = async () => {
    clearCache();
    await fetchProfilePicture();
  };

  // Measurement units functions
  const fetchMeasurementUnit = async () => {
    try {
      setIsUnitLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/measurement_units.sh"
      );
      const data: MeasurementUnitResponse = await response.json();

      if (data.status === "success" && data.data) {
        setMeasurementUnit(data.data.unit);
        setIsUnitDefault(data.data.isDefault);
      }
    } catch (error) {
      console.error("Error fetching measurement unit:", error);
      toast({
        title: "Error",
        description: "Failed to load measurement unit preferences.",
        variant: "destructive",
      });
    } finally {
      setIsUnitLoading(false);
    }
  };

  const updateMeasurementUnit = async (unit: "km" | "mi") => {
    try {
      setIsUnitLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/measurement_units.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ unit }),
        }
      );
      const data: MeasurementUnitResponse = await response.json();

      if (data.status === "success") {
        setMeasurementUnit(unit);
        setIsUnitDefault(false);
        toast({
          title: "Preference Updated",
          description: `Measurement unit set to ${
            unit === "km" ? "kilometers" : "miles"
          }.`,
        });
      } else {
        throw new Error(data.message || "Failed to update measurement unit");
      }
    } catch (error) {
      console.error("Error updating measurement unit:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsUnitLoading(false);
    }
  };

  const resetMeasurementUnit = async () => {
    try {
      setIsUnitLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/measurement_units.sh",
        {
          method: "DELETE",
        }
      );
      const data: MeasurementUnitResponse = await response.json();

      if (data.status === "success" && data.data) {
        setMeasurementUnit(data.data.unit);
        setIsUnitDefault(true);
        toast({
          title: "Preference Reset",
          description: `Measurement unit reset to system default (${
            data.data.unit === "km" ? "kilometers" : "miles"
          }).`,
        });
      } else {
        throw new Error(data.message || "Failed to reset measurement unit");
      }
    } catch (error) {
      console.error("Error resetting measurement unit:", error);
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsUnitLoading(false);
    }
  };

  // Ping settings functions
  const fetchPingSettings = async () => {
    try {
      setIsPingLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/ping_settings.sh"
      );
      const data: PingSettingsResponse = await response.json();

      if (data.status === "success" && data.data) {
        setPingEnabled(data.data.enabled);
      }
    } catch (error) {
      console.error("Error fetching ping settings:", error);
      toast({
        title: "Error",
        description: "Failed to load ping settings.",
        variant: "destructive",
      });
    } finally {
      setIsPingLoading(false);
    }
  };

  const updatePingSettings = async (enabled: boolean) => {
    try {
      setIsPingLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/ping_settings.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enabled }),
        }
      );
      const data: PingSettingsResponse = await response.json();

      if (data.status === "success") {
        setPingEnabled(enabled);
        toast({
          title: "Ping Settings Updated",
          description: `Ping functionality ${
            enabled ? "enabled" : "disabled"
          }.`,
        });

        // Dispatch custom event to notify ping card of the change
        window.dispatchEvent(new CustomEvent("pingSettingsUpdated"));
      } else {
        throw new Error(data.message || "Failed to update ping settings");
      }
    } catch (error) {
      console.error("Error updating ping settings:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsPingLoading(false);
    }
  };

  const resetPingSettings = async () => {
    try {
      setIsPingLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/ping_settings.sh",
        {
          method: "DELETE",
        }
      );
      const data: PingSettingsResponse = await response.json();

      if (data.status === "success" && data.data) {
        setPingEnabled(data.data.enabled);
        toast({
          title: "Ping Settings Reset",
          description: `Ping settings reset to system default (${
            data.data.enabled ? "enabled" : "disabled"
          }).`,
        });

        // Dispatch custom event to notify ping card of the change
        window.dispatchEvent(new CustomEvent("pingSettingsUpdated"));
      } else {
        throw new Error(data.message || "Failed to reset ping settings");
      }
    } catch (error) {
      console.error("Error resetting ping settings:", error);
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsPingLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personalization Settings</CardTitle>
        <CardDescription>
          Customize your profile and preferences.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          {/* Profile Picture Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="grid gap-6"></div>
            {/* Avatar Display */}
            <div className="relative">
              <Avatar className="lg:h-48 lg:w-48 h-32 w-32 border-4 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
                {profileImage ? (
                  <AvatarImage src={profileImage} alt="Profile Picture" />
                ) : (
                  <AvatarFallback className="bg-gray-100">
                    <User className="h-12 w-12 text-gray-400" />
                  </AvatarFallback>
                )}
              </Avatar>

              {/* Upload overlay */}
              <div
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                onClick={triggerFileInput}
              >
                <Camera className="h-8 w-8 text-white" />
              </div>
            </div>

            <p className="text-muted-foreground text-sm italic">
              Supported formats: JPEG, PNG, GIF, WebP (max 3MB).
            </p>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={triggerFileInput}
                disabled={isUploading || isLoading || isDeleting}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>{isUploading ? "Uploading..." : "Upload"}</span>
              </Button>

              {hasProfileImage && (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={deleteProfilePicture}
                    disabled={
                      isLoading || isDeleting || isUploading || !hasProfileImage
                    }
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span>{isDeleting ? "Deleting..." : "Delete"}</span>
                  </Button>
                </>
              )}
            </div>

            {/* Hidden File Input */}
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <Separator className="w-full my-2" />

          <div className="grid gap-6">
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="MeasurementUnits">
                Distance Measurement Unit
              </Label>
              {isUnitLoading ? (
                <Skeleton className="h-8" />
              ) : (
                <div className="flex flex-row gap-2 items-center">
                  <Select
                    disabled={isUnitLoading}
                    value={measurementUnit}
                    onValueChange={(value: "km" | "mi") =>
                      updateMeasurementUnit(value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {measurementUnit === "km"
                          ? "Kilometers (km)"
                          : "Miles (mi)"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Distance Unit</SelectLabel>
                        <SelectItem value="km">Kilometers (km)</SelectItem>
                        <SelectItem value="mi">Miles (mi)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isUnitLoading || isUnitDefault}
                    onClick={resetMeasurementUnit}
                  >
                    <Undo2Icon className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {isUnitDefault ? (
                <p className="text-sm text-muted-foreground">
                  This is the default unit based on your system settings.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This is a custom unit setting.
                </p>
              )}
            </div>

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="PingSettings">Network Latency Testing</Label>
              {isPingLoading ? (
                <Skeleton className="h-8" />
              ) : (
                <div className="flex flex-row gap-2 items-center">
                  <Select
                    disabled={isPingLoading}
                    value={pingEnabled ? "enabled" : "disabled"}
                    onValueChange={(value: string) =>
                      updatePingSettings(value === "enabled")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {pingEnabled ? "Enabled" : "Disabled"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Latency Testing</SelectLabel>
                        <SelectItem value="enabled">
                          Enable latency testing
                        </SelectItem>
                        <SelectItem value="disabled">
                          Disable latency testing
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isPingLoading}
                    onClick={resetPingSettings}
                  >
                    <Undo2Icon className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonalizationPage;
