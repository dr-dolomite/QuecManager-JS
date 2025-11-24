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
    interval?: number;
    isDefault: boolean;
  };
}

interface MemorySettingsResponse {
  status: string;
  message: string;
  data?: {
    enabled: boolean;
    interval?: number;
    isDefault: boolean;
  };
}

interface ProfileDialogResponse {
  status: string;
  message: string;
  data?: {
    enabled: boolean;
    isDefault: boolean;
  };
}

interface TemperatureUnitResponse {
  status: string;
  message: string;
  data?: {
    unit: "celsius" | "fahrenheit";
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
  const [temperatureUnit, setTemperatureUnit] = useState<
    "celsius" | "fahrenheit"
  >("celsius");
  const [isTempUnitLoading, setIsTempUnitLoading] = useState<boolean>(false);
  const [isTempUnitDefault, setIsTempUnitDefault] = useState<boolean>(true);
  const [pingEnabled, setPingEnabled] = useState<boolean>(true);
  const [pingInterval, setPingInterval] = useState<number>(5);
  const [isPingLoading, setIsPingLoading] = useState<boolean>(false);
  const [isPingDefault, setIsPingDefault] = useState<boolean>(true);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);
  const [memoryInterval, setMemoryInterval] = useState<number>(1);
  const [isMemoryLoading, setIsMemoryLoading] = useState<boolean>(false);
  const [isMemoryDefault, setIsMemoryDefault] = useState<boolean>(true);
  const [profileDialogEnabled, setProfileDialogEnabled] =
    useState<boolean>(true);
  const [isProfileDialogLoading, setIsProfileDialogLoading] =
    useState<boolean>(false);
  const [isProfileDialogDefault, setIsProfileDialogDefault] =
    useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cache keys for localStorage
  const CACHE_KEY = "profile_picture_data";
  const CACHE_METADATA_KEY = "profile_picture_metadata";

  // Load cached image and fetch data immediately on component mount
  useEffect(() => {
    loadCachedImage();
    fetchProfilePicture();
    fetchMeasurementUnit();
    fetchTemperatureUnit();
    fetchPingSettings();
    fetchMemorySettings();
    fetchProfileDialogSettings();
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

  // Temperature units functions
  const fetchTemperatureUnit = async () => {
    try {
      setIsTempUnitLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/temperature_units.sh"
      );
      const data: TemperatureUnitResponse = await response.json();

      if (data.status === "success" && data.data) {
        setTemperatureUnit(data.data.unit);
        setIsTempUnitDefault(data.data.isDefault);
      }
    } catch (error) {
      console.error("Error fetching temperature unit:", error);
      toast({
        title: "Error",
        description: "Failed to load temperature unit preferences.",
        variant: "destructive",
      });
    } finally {
      setIsTempUnitLoading(false);
    }
  };

  const updateTemperatureUnit = async (unit: "celsius" | "fahrenheit") => {
    try {
      setIsTempUnitLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/temperature_units.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ unit }),
        }
      );
      const data: TemperatureUnitResponse = await response.json();

      if (data.status === "success") {
        setTemperatureUnit(unit);
        setIsTempUnitDefault(false);
        toast({
          title: "Preference Updated",
          description: `Temperature unit set to ${
            unit === "celsius" ? "Celsius (°C)" : "Fahrenheit (°F)"
          }.`,
        });
      } else {
        throw new Error(data.message || "Failed to update temperature unit");
      }
    } catch (error) {
      console.error("Error updating temperature unit:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsTempUnitLoading(false);
    }
  };

  const resetTemperatureUnit = async () => {
    try {
      setIsTempUnitLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/temperature_units.sh",
        {
          method: "DELETE",
        }
      );
      const data: TemperatureUnitResponse = await response.json();

      if (data.status === "success" && data.data) {
        setTemperatureUnit(data.data.unit);
        setIsTempUnitDefault(true);
        toast({
          title: "Preference Reset",
          description: `Temperature unit reset to system default (${
            data.data.unit === "celsius" ? "Celsius (°C)" : "Fahrenheit (°F)"
          }).`,
        });
      } else {
        throw new Error(data.message || "Failed to reset temperature unit");
      }
    } catch (error) {
      console.error("Error resetting temperature unit:", error);
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsTempUnitLoading(false);
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
        if (typeof data.data.interval === "number") {
          setPingInterval(data.data.interval);
        }
        // For the new dynamic system, we determine default status based on enabled state
        // If monitoring is disabled, it's effectively in default state
        setIsPingDefault(!data.data.enabled);
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

  const updatePingSettings = async (enabled: boolean, interval?: number) => {
    try {
      setIsPingLoading(true);
      setIsMemoryLoading(true); // Disable memory fields during ping update
      const prevEnabled = pingEnabled;
      const prevInterval = pingInterval;
      const requestedInterval = interval ?? pingInterval;
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/ping_settings.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enabled, interval: requestedInterval }),
        }
      );
      const data: PingSettingsResponse = await response.json();

      if (data.status === "success") {
        setPingEnabled(enabled);
        if (typeof data.data?.interval === "number") {
          setPingInterval(data.data.interval);
        } else {
          setPingInterval(requestedInterval);
        }
        // In the new dynamic system, default state is disabled
        setIsPingDefault(!enabled);
        const newInterval =
          typeof data.data?.interval === "number"
            ? data.data.interval
            : requestedInterval;

        // Separate toasts depending on what changed
        if (enabled !== prevEnabled) {
          toast({
            title: "Ping Status Updated",
            description: `Ping has been ${enabled ? "enabled" : "disabled"}.`,
          });
        }

        if (newInterval !== prevInterval) {
          toast({
            title: "Polling Rate Updated",
            description: `Now measuring every ${newInterval} second${
              newInterval === 1 ? "" : "s"
            }.`,
          });
        }

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
      setIsMemoryLoading(false); // Re-enable memory fields
    }
  };

  const resetPingSettings = async () => {
    try {
      setIsPingLoading(true);
      setIsMemoryLoading(true); // Disable memory fields during ping reset
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/ping_settings.sh",
        {
          method: "DELETE",
        }
      );
      const data: PingSettingsResponse = await response.json();

      if (data.status === "success") {
        // With the new dynamic system, reset means disabling monitoring
        setPingEnabled(false);
        setPingInterval(5); // Default interval
        setIsPingDefault(true);
        toast({
          title: "Ping Settings Reset",
          description: "Ping settings reset to system default (disabled).",
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
      setIsMemoryLoading(false); // Re-enable memory fields
    }
  };

  // Memory settings functions
  const fetchMemorySettings = async () => {
    try {
      setIsMemoryLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/home/memory/memory_service.sh"
      );
      const data: MemorySettingsResponse = await response.json();

      if (data.status === "success" && data.data) {
        setMemoryEnabled(data.data.enabled);
        if (typeof data.data.interval === "number") {
          setMemoryInterval(data.data.interval);
        }
        // For the new dynamic system, we determine default status based on enabled state
        // If monitoring is disabled, it's effectively in default state
        setIsMemoryDefault(!data.data.enabled);
      }
    } catch (error) {
      console.error("Error fetching memory settings:", error);
      toast({
        title: "Error",
        description: "Failed to load memory monitoring settings.",
        variant: "destructive",
      });
    } finally {
      setIsMemoryLoading(false);
    }
  };

  const updateMemorySettings = async (enabled: boolean, interval?: number) => {
    try {
      setIsMemoryLoading(true);
      setIsPingLoading(true); // Disable ping fields during memory update
      const prevEnabled = memoryEnabled;
      const prevInterval = memoryInterval;
      const requestedInterval = interval ?? memoryInterval;
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/memory_settings.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enabled, interval: requestedInterval }),
        }
      );
      const data: MemorySettingsResponse = await response.json();

      if (data.status === "success") {
        setMemoryEnabled(enabled);
        if (typeof data.data?.interval === "number") {
          setMemoryInterval(data.data.interval);
        } else {
          setMemoryInterval(requestedInterval);
        }
        // In the new dynamic system, default state is disabled
        setIsMemoryDefault(!enabled);
        const newInterval =
          typeof data.data?.interval === "number"
            ? data.data.interval
            : requestedInterval;

        // Separate toasts depending on what changed
        if (enabled !== prevEnabled) {
          toast({
            title: "Memory Monitoring Updated",
            description: `Memory monitoring has been ${
              enabled ? "enabled" : "disabled"
            }.`,
          });
        }

        if (newInterval !== prevInterval) {
          toast({
            title: "Update Rate Changed",
            description: `Memory now updates every ${newInterval} second${
              newInterval === 1 ? "" : "s"
            }.`,
          });
        }

        // Dispatch custom event to notify memory card of the change
        window.dispatchEvent(new CustomEvent("memorySettingsUpdated"));
      } else {
        throw new Error(data.message || "Failed to update memory settings");
      }
    } catch (error) {
      console.error("Error updating memory settings:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsMemoryLoading(false);
      setIsPingLoading(false); // Re-enable ping fields
    }
  };

  const resetMemorySettings = async () => {
    try {
      setIsMemoryLoading(true);
      setIsPingLoading(true); // Disable ping fields during memory reset
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/memory_settings.sh",
        {
          method: "DELETE",
        }
      );
      const data: MemorySettingsResponse = await response.json();

      if (data.status === "success") {
        // With the new dynamic system, reset means disabling monitoring
        setMemoryEnabled(false);
        setMemoryInterval(1); // Default interval
        setIsMemoryDefault(true);
        toast({
          title: "Memory Settings Reset",
          description: "Memory monitoring reset to system default (disabled).",
        });

        // Dispatch custom event to notify memory card of the change
        window.dispatchEvent(new CustomEvent("memorySettingsUpdated"));
      } else {
        throw new Error(data.message || "Failed to reset memory settings");
      }
    } catch (error) {
      console.error("Error resetting memory settings:", error);
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsMemoryLoading(false);
      setIsPingLoading(false); // Re-enable ping fields
    }
  };

  // Profile dialog settings functions
  const fetchProfileDialogSettings = async () => {
    try {
      setIsProfileDialogLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/profile_dialog.sh"
      );
      const data: ProfileDialogResponse = await response.json();

      if (data.status === "success" && data.data) {
        setProfileDialogEnabled(data.data.enabled);
        setIsProfileDialogDefault(data.data.isDefault);
      }
    } catch (error) {
      console.error("Error fetching profile dialog settings:", error);
      toast({
        title: "Error",
        description: "Failed to load profile dialog settings.",
        variant: "destructive",
      });
    } finally {
      setIsProfileDialogLoading(false);
    }
  };

  const updateProfileDialogSettings = async (enabled: boolean) => {
    try {
      setIsProfileDialogLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/profile_dialog.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enabled }),
        }
      );
      const data: ProfileDialogResponse = await response.json();

      if (data.status === "success") {
        setProfileDialogEnabled(enabled);
        setIsProfileDialogDefault(false);
        toast({
          title: "Setting Updated",
          description: `Profile setup dialog has been ${
            enabled ? "enabled" : "disabled"
          }.`,
        });
      } else {
        throw new Error(
          data.message || "Failed to update profile dialog settings"
        );
      }
    } catch (error) {
      console.error("Error updating profile dialog settings:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsProfileDialogLoading(false);
    }
  };

  const resetProfileDialogSettings = async () => {
    try {
      setIsProfileDialogLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/profile_dialog.sh",
        {
          method: "DELETE",
        }
      );
      const data: ProfileDialogResponse = await response.json();

      if (data.status === "success" && data.data) {
        setProfileDialogEnabled(data.data.enabled);
        setIsProfileDialogDefault(true);
        toast({
          title: "Setting Reset",
          description:
            "Profile dialog setting reset to system default (enabled).",
        });
      } else {
        throw new Error(
          data.message || "Failed to reset profile dialog settings"
        );
      }
    } catch (error) {
      console.error("Error resetting profile dialog settings:", error);
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsProfileDialogLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Personalization Settings</h1>
        <p className="text-muted-foreground">
          Customize your profile and preferences.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Personalization Settings</CardTitle>
          {/* <CardDescription>
          Customize your profile and preferences.
        </CardDescription> */}
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
                        isLoading ||
                        isDeleting ||
                        isUploading ||
                        !hasProfileImage
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

            <div className="grid lg:grid-cols-2 grid-flow-row gap-4">
              <div className="lg:col-span-2 col-span-1">
                <div className="grid w-full max-w-sm items-center gap-2">
                  <Label htmlFor="ProfileDialogSettings">
                    Profile Setup Dialog
                  </Label>
                  {isProfileDialogLoading ? (
                    <Skeleton className="h-8" />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-row gap-2 items-center">
                        <Select
                          disabled={isProfileDialogLoading}
                          value={profileDialogEnabled ? "enabled" : "disabled"}
                          onValueChange={(value: string) =>
                            updateProfileDialogSettings(value === "enabled")
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {profileDialogEnabled
                                ? "Show Dialog"
                                : "Hide Dialog"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Profile Setup Dialog</SelectLabel>
                              <SelectItem value="enabled">
                                Show profile setup dialog
                              </SelectItem>
                              <SelectItem value="disabled">
                                Hide profile setup dialog
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={
                            isProfileDialogLoading || isProfileDialogDefault
                          }
                          onClick={resetProfileDialogSettings}
                        >
                          <Undo2Icon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Controls whether to show the profile setup on the home page.
                  </p>
                </div>
              </div>

              <div className="col-span-1">
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
              </div>

              <div className="col-span-1">
                <div className="grid w-full max-w-sm items-center gap-2">
                  <Label htmlFor="TemperatureUnits">
                    Temperature Measurement Unit
                  </Label>
                  {isTempUnitLoading ? (
                    <Skeleton className="h-8" />
                  ) : (
                    <div className="flex flex-row gap-2 items-center">
                      <Select
                        disabled={isTempUnitLoading}
                        value={temperatureUnit}
                        onValueChange={(value: "celsius" | "fahrenheit") =>
                          updateTemperatureUnit(value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {temperatureUnit === "celsius"
                              ? "Celsius (°C)"
                              : "Fahrenheit (°F)"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Temperature Unit</SelectLabel>
                            <SelectItem value="celsius">
                              Celsius (°C)
                            </SelectItem>
                            <SelectItem value="fahrenheit">
                              Fahrenheit (°F)
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={isTempUnitLoading || isTempUnitDefault}
                        onClick={resetTemperatureUnit}
                      >
                        <Undo2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {isTempUnitDefault ? (
                    <p className="text-sm text-muted-foreground">
                      This is the default unit based on your system settings.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This is a custom unit setting.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="PingSettings">Network Latency Testing</Label>
                {isPingLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <div className="flex flex-col gap-2">
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
                        disabled={isPingLoading || isPingDefault}
                        onClick={resetPingSettings}
                      >
                        <Undo2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Controls whether the device measures network latency.
                </p>
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                {isPingLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <div className="grid w-full items-center gap-2">
                    <Label htmlFor="PingPolling">Polling Rate</Label>
                    <div className="flex flex-row gap-2 items-center">
                      <Select
                        disabled={isPingLoading || !pingEnabled}
                        value={String(pingInterval)}
                        onValueChange={(value: string) => {
                          const next = parseInt(value, 10);
                          setPingInterval(next);
                          // Persist immediately to backend while keeping UX consistent
                          updatePingSettings(pingEnabled, next);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>{pingInterval} seconds</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Polling Rate</SelectLabel>
                            <SelectItem value="2">Every 2 seconds</SelectItem>
                            <SelectItem value="5">Every 5 seconds</SelectItem>
                            <SelectItem value="10">Every 10 seconds</SelectItem>
                            <SelectItem value="15">Every 15 seconds</SelectItem>
                            <SelectItem value="30">Every 30 seconds</SelectItem>
                            <SelectItem value="60">Every 60 seconds</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={
                          isPingLoading || pingInterval === 5 || isPingDefault
                        }
                        onClick={() => updatePingSettings(pingEnabled, 5)}
                      >
                        <Undo2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Controls how often the device measures latency.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                <Label htmlFor="MemorySettings">Memory Monitoring</Label>
                {isMemoryLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2 items-center">
                      <Select
                        disabled={isMemoryLoading}
                        value={memoryEnabled ? "enabled" : "disabled"}
                        onValueChange={(value: string) =>
                          updateMemorySettings(value === "enabled")
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {memoryEnabled ? "Enabled" : "Disabled"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Memory Monitoring</SelectLabel>
                            <SelectItem value="enabled">
                              Enable memory monitoring
                            </SelectItem>
                            <SelectItem value="disabled">
                              Disable memory monitoring
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={isMemoryLoading || isMemoryDefault}
                        onClick={resetMemorySettings}
                      >
                        <Undo2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Controls whether the device measures memory usage.
                </p>
              </div>

              <div className="grid w-full max-w-sm items-center gap-2">
                {isMemoryLoading ? (
                  <Skeleton className="h-8" />
                ) : (
                  <div className="grid w-full items-center gap-2">
                    <Label htmlFor="MemoryUpdateRate">Update Rate</Label>
                    <div className="flex flex-row gap-2 items-center">
                      <Select
                        disabled={isMemoryLoading || !memoryEnabled}
                        value={String(memoryInterval)}
                        onValueChange={(value: string) => {
                          const next = parseInt(value, 10);
                          setMemoryInterval(next);
                          // Persist immediately to backend while keeping UX consistent
                          updateMemorySettings(memoryEnabled, next);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {memoryInterval} second
                            {memoryInterval === 1 ? "" : "s"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Update Rate</SelectLabel>
                            <SelectItem value="1">Every 1 second</SelectItem>
                            <SelectItem value="2">Every 2 seconds</SelectItem>
                            <SelectItem value="3">Every 3 seconds</SelectItem>
                            <SelectItem value="5">Every 5 seconds</SelectItem>
                            <SelectItem value="10">Every 10 seconds</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={
                          isMemoryLoading ||
                          memoryInterval === 1 ||
                          isMemoryDefault
                        }
                        onClick={() => updateMemorySettings(memoryEnabled, 1)}
                      >
                        <Undo2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Controls how often memory usage is updated.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalizationPage;
