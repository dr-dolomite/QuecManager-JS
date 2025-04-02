/**
 * @module useCellSettingsData
 * @description Custom React hook for fetching and processing cellular network settings data.
 * This hook communicates with the device's CGI endpoints to retrieve information about
 * APN settings, network type preferences, 5G mode, and SIM slot configuration.
 *
 * @returns {Object} An object containing:
 *   - data: The processed cell settings data or null if not loaded
 *   - isLoading: Boolean indicating if data is currently being fetched
 *   - fetchCellSettingsData: Function to manually trigger a data refresh
 *
 * @example
 * ```tsx
 * import useCellSettingsData from '@/hooks/cell-settings-data';
 *
 * function CellSettingsComponent() {
 *   const { data, isLoading, fetchCellSettingsData } = useCellSettingsData();
 *
 *   if (isLoading) return <p>Loading...</p>;
 *   if (!data) return <p>No data available</p>;
 *
 *   return (
 *     <div>
 *       <p>Current APN: {data.currentAPN}</p>
 *       <p>PDP Type: {data.apnPDPType}</p>
 *       <button onClick={fetchCellSettingsData}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @internal
 * The hook fetches data from the endpoint '/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=2'
 * and processes the response using several helper functions to extract the relevant information:
 * - processAPN: Extracts the APN from either manual or auto configuration
 * - processAPNPDPType: Extracts the PDP type (e.g., IP, IPV6)
 * - processPreferredNetworkType: Extracts the preferred network mode
 * - processNR5GMode: Extracts the 5G mode configuration
 * - processSimSlot: Extracts the active SIM slot
 */

// hooks/cellSettingsData.ts
import { useState, useEffect, useCallback } from "react";
import { CellSettingsData } from "@/types/types";

const useCellSettingsData = () => {
  const [data, setData] = useState<CellSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCellSettingsData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Clean up data from previous fetch
      setData(null);

      const response = await fetch(
        "/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=2"
      );
      const rawData = await response.json();
      console.log("Fetched cell settings data:", rawData);

      const processedData: CellSettingsData = {
        APNProfiles: getAPNProfiles(
          rawData[0].response,
          rawData[8].response,
          rawData[1].response
        ),
        apnPDPType: processAPNPDPType(rawData[0].response),
        preferredNetworkType: processPreferredNetworkType(rawData[2].response),
        nr5gMode: processNR5GMode(rawData[3].response),
        simSlot: processSimSlot(rawData[4].response),
        // For cfun state simply get the number character from the response
        cfunState: rawData[5].response.match(/\d+/)[0].trim(),
        // For auto select state simply get the number character from the response
        autoSelState: rawData[6].response.match(/\d+/)[0].trim(),
        // Extract the MBN profiles list from the response
        mbnProfilesList: rawData[7].response
          .split("\n")
          .filter((line: string) => line.includes('+QMBNCFG: "List"')) // Only get profile lines
          .map((line: string) => {
            // Extract just the profile name from the quotes
            const match = line.match(/\+QMBNCFG: "List",\d+,\d+,\d+,"([^"]+)"/);
            return match ? match[1] : null; // Return just the name or null if pattern doesn't match
          })
          .filter(Boolean),
        selectedMbnProfile: "",
        // Look for QMAP="WWAN",<active state>,< profile index> and get the profile index
        // This is the profile that is currently selected for data connection
        dataProfileIndex: rawData[8].response
          .split("\n")
          .find((line: string) => line.includes('+QMAP: "WWAN"'))
          ?.split(",")[1]
          .trim()
          .replace("+QMAP:", ""),
      };

      setData(processedData);
      console.log("Processed cell settings data:", processedData);
    } catch (error) {
      console.error("Error fetching cell settings data:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCellSettingsData();
  }, [fetchCellSettingsData]);

  return { data, isLoading, fetchCellSettingsData };
};

export default useCellSettingsData;

// Helper functions to process the raw data

const processAPNPDPType = (data: string) => {
  const PDPType = data
    .split("\n")
    .find((line: string) => line.includes("+CGDCONT: 1"))
    ?.split(",")[1]
    .replace(/"/g, "");

  if (PDPType === undefined || PDPType === "") {
    return "Error fetching PDP Type";
  }

  return PDPType;
};

const processPreferredNetworkType = (data: string) => {
  const networkType = data
    .split("\n")
    .find((line: string) => line.includes('+QNWPREFCFG: "mode_pref"'))
    ?.split(",")[1]
    .replace(/"/g, "");

  if (networkType === undefined || networkType === "") {
    return "Error fetching network type";
  }

  return networkType;
};

const processNR5GMode = (data: string) => {
  const nr5gMode = data
    .split("\n")
    .find((line: string) => line.includes('+QNWPREFCFG: "nr5g_disable_mode"'))
    ?.split(",")[1]
    .replace(/"/g, "");

  if (nr5gMode === undefined || nr5gMode === "") {
    return "Error fetching NR5G mode";
  }

  return nr5gMode;
};

const processSimSlot = (data: string) => {
  const simSlot = data
    .split("\n")
    .find((line: string) => line.includes("+QUIMSLOT:"))
    ?.split(":")[1]
    .trim();

  if (simSlot === undefined || simSlot === "") {
    return "Error fetching SIM slot";
  }

  return simSlot;
};

const getAPNProfiles = (cgdcont: string, wwan: string, cgdcontdrp: string): string[] | undefined => {
  // Early return for undefined/empty input
  if (!cgdcont?.trim()) return undefined;

  // Extract active profile number from QMAP response
  const profileLine = wwan.split('\n').find(line => line.includes('+QMAP: "WWAN"'));
  const profileNumber = profileLine?.split(',')?.[1]?.trim()?.replace('+QMAP:', '');
  
  if (!profileNumber) return undefined;
  
  // Extract all APN profiles from CGDCONT response
  const apnProfiles = cgdcont
    .split('\n')
    .filter(line => line.includes('+CGDCONT:'))
    .map(line => {
      // Single regex to handle both normal and blank APNs
      const match = line.match(/\+CGDCONT:\s*\d+,"[^"]+","([^"]*)"/);
      return match ? match[1] : null;
    })
    .filter(Boolean) as string[];

  if (!apnProfiles.length) return undefined;
  
  // Handle blank APNs by getting the actual APN from CGDCONTRDP if available
  if (apnProfiles[0] === '') {
    const dynamicApnLine = cgdcontdrp.split('\n').find(line => line.includes('+CGCONTRDP:'));
    const dynamicApn = dynamicApnLine?.split(',')?.[2]?.replace(/"/g, '');
    
    if (dynamicApn) apnProfiles[0] = dynamicApn;
  }

  // Reorder profiles to put the active profile first
  const profileIndex = parseInt(profileNumber, 10) - 1;
  if (profileIndex >= 0 && profileIndex < apnProfiles.length && profileIndex !== 0) {
    // Swap the active profile to the first position
    [apnProfiles[0], apnProfiles[profileIndex]] = [apnProfiles[profileIndex], apnProfiles[0]];
  }
  
  return apnProfiles;
};
