/**
 * Custom hook to manage IMEI profiles for cellular devices
 * 
 * @returns {UseIMEIConfigReturn} An object containing:
 *   - profiles: Current IMEI profiles data
 *   - hasActiveProfile: Boolean flag indicating if any profile is active
 *   - updateIMEIProfile: Function to update a specific profile
 *   - deleteIMEIProfiles: Function to delete all profiles
 * 
 * @example
 * ```tsx
 * const { profiles, hasActiveProfile, updateIMEIProfile, deleteIMEIProfiles } = useIMEIConfig();
 * 
 * // Update a profile
 * await updateIMEIProfile("profile1", { imei: "123456789012345", iccid: "12345678901234567890" });
 * 
 * // Delete all profiles
 * await deleteIMEIProfiles();
 * ```
 * 
 * @interface IMEIProfile
 * @property {string} imei - The IMEI (International Mobile Equipment Identity) number
 * @property {string} iccid - The ICCID (Integrated Circuit Card Identifier) number
 * 
 * @interface IMEIProfiles
 * @property {IMEIProfile} [profile1] - First IMEI profile configuration
 * @property {IMEIProfile} [profile2] - Second IMEI profile configuration
 * 
 * @interface UseIMEIConfigReturn
 * @property {IMEIProfiles} profiles - Current IMEI profiles data
 * @property {boolean} hasActiveProfile - Indicates if at least one profile is configured
 * @property {Function} updateIMEIProfile - Updates a specific profile with new IMEI and ICCID data
 * @property {Function} deleteIMEIProfiles - Deletes all IMEI profiles
 */

import { useState, useEffect } from "react";

interface IMEIProfile {
  imei: string;
  iccid: string;
}

interface IMEIProfiles {
  profile1?: IMEIProfile;
  profile2?: IMEIProfile;
}

interface UseIMEIConfigReturn {
  profiles: IMEIProfiles;
  hasActiveProfile: boolean;
  updateIMEIProfile: (
    profileId: "profile1" | "profile2",
    data: IMEIProfile
  ) => Promise<boolean>;
  deleteIMEIProfiles: () => Promise<boolean>;
}

export function useIMEIConfig(): UseIMEIConfigReturn {
  const [profiles, setProfiles] = useState<IMEIProfiles>({});
  const [profileLoading, setprofileLoading] = useState(true);
  const [hasActiveProfile, setHasActiveProfile] = useState(false);

  const fetchProfiles = async () => {
    try {
      setprofileLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/cell-settings/imei-profiles/fetch-imei-profile.sh",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProfiles(data);
      if (data.profile1 || data.profile2) {
        setHasActiveProfile(true);
      }
    } catch (error) {
      console.error("Error fetching IMEI profiles:", error);
    } finally {
      setprofileLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const updateIMEIProfile = async (
    profileId: "profile1" | "profile2",
    data: IMEIProfile
  ): Promise<boolean> => {
    try {
      const formData = new URLSearchParams();

      // Always include profile1 data
      if (profileId === "profile1") {
        formData.append("iccidProfile1", data.iccid);
        formData.append("imeiProfile1", data.imei);
      } else {
        // If updating profile2, include existing profile1 data
        formData.append("iccidProfile1", profiles.profile1?.iccid || "");
        formData.append("imeiProfile1", profiles.profile1?.imei || "");
      }

      // Include profile2 data if it exists or is being updated
      if (profileId === "profile2" || profiles.profile2) {
        formData.append(
          "iccidProfile2",
          profileId === "profile2" ? data.iccid : profiles.profile2?.iccid || ""
        );
        formData.append(
          "imeiProfile2",
          profileId === "profile2" ? data.imei : profiles.profile2?.imei || ""
        );
      }

      const response = await fetch(
        "/cgi-bin/quecmanager/cell-settings/imei-profiles/save-imei-profile.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const result = await response.json();

      if (result.status === "success") {
        setProfiles((prev) => ({
          ...prev,
          [profileId]: data,
        }));
        return true;
      }

      throw new Error(result.message || "Failed to update profile");
    } catch (error) {
      console.error(`Error updating ${profileId}:`, error);
      return false;
    }
  };

  const deleteIMEIProfiles = async (): Promise<boolean> => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/cell-settings/imei-profiles/delete-imei-profile.sh",
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

      const result = await response.json();

      if (result.status === "success") {
        setProfiles({});
        return true;
      }

      throw new Error(result.message || "Failed to delete profiles");
    } catch (error) {
      console.error("Error deleting IMEI profiles:", error);
      return false;
    }
  };

  return {
    profiles,
    hasActiveProfile,
    updateIMEIProfile,
    deleteIMEIProfiles,
  };
}
