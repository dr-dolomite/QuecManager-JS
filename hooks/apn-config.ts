import { useState, useEffect } from 'react';

interface APNProfile {
  apn: string;
  pdpType: string;
  iccid: string;
}

interface APNProfiles {
  profile1?: APNProfile;
  profile2?: APNProfile;
}

interface UseAPNConfigReturn {
  profiles: APNProfiles;
  isLoading: boolean;
  updateAPNProfile: (profileId: 'profile1' | 'profile2', data: APNProfile) => Promise<boolean>;
  deleteAPNProfiles: () => Promise<boolean>;
}

export function useAPNConfig(): UseAPNConfigReturn {
  const [profiles, setProfiles] = useState<APNProfiles>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/cgi-bin/cell-settings/apn-profiles/fetch-profile.sh", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched APN profiles data:', data);
      setProfiles(data);
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
    profileId: 'profile1' | 'profile2',
    data: APNProfile
  ): Promise<boolean> => {
    try {
      const formData = new URLSearchParams();
      
      // Always include profile1 data
      if (profileId === 'profile1') {
        formData.append('iccidProfile1', data.iccid);
        formData.append('apnProfile1', data.apn);
        formData.append('pdpType1', data.pdpType);
      } else {
        // If updating profile2, include existing profile1 data
        formData.append('iccidProfile1', profiles.profile1?.iccid || '');
        formData.append('apnProfile1', profiles.profile1?.apn || '');
        formData.append('pdpType1', profiles.profile1?.pdpType || '');
      }

      // Include profile2 data if it exists or is being updated
      if (profileId === 'profile2' || profiles.profile2) {
        formData.append('iccidProfile2', profileId === 'profile2' ? data.iccid : (profiles.profile2?.iccid || ''));
        formData.append('apnProfile2', profileId === 'profile2' ? data.apn : (profiles.profile2?.apn || ''));
        formData.append('pdpType2', profileId === 'profile2' ? data.pdpType : (profiles.profile2?.pdpType || ''));
      }

      const response = await fetch('/cgi-bin/cell-settings/apn-profiles/save-profile.sh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        setProfiles(prev => ({
          ...prev,
          [profileId]: data
        }));
        return true;
      }
      
      throw new Error(result.message || 'Failed to update profile');
    } catch (error) {
      console.error(`Error updating ${profileId}:`, error);
      return false;
    }
  };

  const deleteAPNProfiles = async (): Promise<boolean> => {
    try {
      const response = await fetch('/cgi-bin/cell-settings/apn-profiles/delete-profile.sh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error('Failed to delete profiles');
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        setProfiles({});
        return true;
      }
      
      throw new Error(result.message || 'Failed to delete profiles');
    } catch (error) {
      console.error('Error deleting APN profiles:', error);
      return false;
    }
  };

  return {
    profiles,
    isLoading,
    updateAPNProfile,
    deleteAPNProfiles,
  };
}