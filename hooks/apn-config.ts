/**
 * APN (Access Point Name) Configuration Hook
 * 
 * This module provides a custom React hook for managing APN profiles for cellular connectivity.
 * It handles fetching, updating, and deleting APN profiles, as well as tracking service status.
 *
 * @module apn-config
 * 
 * @example
 * ```tsx
 * const { 
 *   profiles, 
 *   serviceStatus, 
 *   isActive, 
 *   isLoading, 
 *   updateAPNProfile 
 * } = useAPNConfig();
 * 
 * // Update a profile
 * await updateAPNProfile('profile1', {
 *   iccid: '12345678901234567890',
 *   apn: 'internet',
 *   pdpType: 'IP'
 * });
 * ```
 * 
 * @returns {UseAPNConfigReturn} An object containing:
 * - `profiles` - The current APN profiles (profile1 and profile2)
 * - `serviceStatus` - Current service status information
 * - `lastActivity` - Timestamp of the last activity
 * - `isActive` - Boolean indicating if the APN service is active
 * - `isLoading` - Boolean indicating if data is being loaded
 * - `updateAPNProfile` - Function to update an APN profile
 * - `deleteAPNProfiles` - Function to delete all APN profiles
 * - `refreshProfiles` - Function to refresh the profiles data
 * 
 * @remarks
 * This hook makes API calls to the device's backend services to manage APN profiles.
 * All API requests include a timeout to prevent hanging operations.
 * Profile updates require sending both profile1 data regardless of which profile is being changed.
 */

// apn-config.ts
import { useState, useEffect } from "react";
import type {
  APNProfile,
  APNProfileResponse,
  ServiceStatus,
} from "@/types/types";

interface APNProfiles {
  profile1?: APNProfile;
  profile2?: APNProfile;
}

interface UseAPNConfigReturn {
  profiles: APNProfiles;
  serviceStatus: ServiceStatus | null;
  lastActivity: string | null;
  isActive: boolean;
  isLoading: boolean;
  updateAPNProfile: (
    profileId: "profile1" | "profile2",
    data: APNProfile
  ) => Promise<boolean>;
  deleteAPNProfiles: () => Promise<boolean>;
  refreshProfiles: () => void;
}

export function useAPNConfig(): UseAPNConfigReturn {
  const [profiles, setProfiles] = useState<APNProfiles>({});
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(
    null
  );
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/cgi-bin/quecmanager/cell-settings/apn-profiles/fetch-apn-profile.sh", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: APNProfileResponse = await response.json();
      // console.log('Fetched APN profiles data:', data);
      
      setProfiles(data.profiles);
      setServiceStatus(data.service || null);
      setLastActivity(data.lastActivity || null);
      setIsActive(data.status === 'active');
    } catch (error) {
      console.error('Error fetching APN profiles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const updateAPNProfile = async (
    profileId: "profile1" | "profile2",
    data: APNProfile
  ) => {
    try {
      const formData = new URLSearchParams();

      // Build form data
      if (profileId === "profile1") {
        formData.append("iccidProfile1", data.iccid);
        formData.append("apnProfile1", data.apn);
        formData.append("pdpType1", data.pdpType);
      } else {
        formData.append("iccidProfile1", profiles.profile1?.iccid || "");
        formData.append("apnProfile1", profiles.profile1?.apn || "");
        formData.append("pdpType1", profiles.profile1?.pdpType || "");
      }

      const response = await fetch(
        "/api/cgi-bin/quecmanager/cell-settings/apn-profiles/save-apn-profile.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Change this condition to check for either 'active' or 'success'
      if (result.status === "success") {
        setProfiles(result.profiles || {}); // Make profiles optional
        setServiceStatus(result.service || null);
        setLastActivity(result.lastActivity || null);
        setIsActive(true);
        return true;
      }

      throw new Error(result.message || "Failed to update profile");
    } catch (error: unknown) {
      console.error(
        `Error updating ${profileId}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
      return false;
    }
  };

  const deleteAPNProfiles = async (): Promise<boolean> => {
    try {
      const response = await fetch(
        "/api/cgi-bin/quecmanager/cell-settings/apn-profiles/delete-apn-profile.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete profiles");
      }

      const result: APNProfileResponse = await response.json();

      if (result.status !== "error") {
        setProfiles({});
        setServiceStatus(result.service || null);
        setLastActivity(result.lastActivity || null);
        setIsActive(result.status === "active");
        return true;
      }

      throw new Error(result.message || "Failed to delete profiles");
    } catch (error) {
      console.error("Error deleting APN profiles:", error);
      return false;
    }
  };

  const refreshProfiles = () => {
    fetchProfiles();
  };

  return {
    profiles,
    serviceStatus,
    lastActivity,
    isActive,
    isLoading,
    updateAPNProfile,
    deleteAPNProfiles,
    refreshProfiles,
  };
}
