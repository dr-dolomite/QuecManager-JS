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
 * The hook fetches data from the endpoint '/api/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=2'
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
        "/api/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=2"
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

const getAPNProfiles = (cgdcont: string, wwan: string, cgdcontdrp: string) => {
  // CGDCONT actually returns numbers of profiles depending on the MBN profile
  // An example is the generic profile which has 3 profiles:
  // 'AT+CGDCONT?\n+CGDCONT: 1,"IPV4V6","","0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0",0,0,0,0,,,,,,,,,,"",,,,0\n
  // +CGDCONT: 2,"IPV4V6","ims","0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0",0,0,0,0,,,,,,,,,,"",,,,0\n
  // +CGDCONT: 3,"IPV4V6","sos","0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0",0,0,0,1,,,,,,,,,,"",,,,0\n'

  // Now we can only know what is the correct CGDCONT profile by checking QMAP="WWAN" like this;
  // AT+QMAP="WWAN"\n
  // +QMAP: "WWAN",1,1,"IPV4","10.108.249.202"\n
  // +QMAP: "WWAN",0,1,"IPV6","0:0:0:0:0:0:0:0"\n

  // The digit "WWAN" is the profile number that corresponds to the APN used for data connection
  // Once we have the profile number we can get the APN name from CGDCONT

  if (cgdcont === undefined || cgdcont === "") {
    return undefined;
  } else {
    const profileNumber = wwan
      .split("\n")
      .find((line: string) => line.includes('+QMAP: "WWAN"'))
      ?.split(",")[1]
      .trim()
      .replace("+QMAP:", "");

    if (profileNumber === undefined || profileNumber === "") {
      return undefined;
    }

    // Noticed that our types for APNProfile need to be string[] because we also want to return the other profiles. However, we will always make the first one the data connection profile so it doesnt matter if its profile 3, it will be the first one in the array.

    const APNProfiles = cgdcont
      .split("\n")
      .filter((line: string) => line.includes("+CGDCONT:"))
      .map((line: string) => {
        // Enhanced regex and handling for blank APNs
        const match = line.match(/\+CGDCONT:\s*\d+,"[^"]+","([^"]*)"/);

        // If we have a match, use the captured group (even if it's blank)
        // Otherwise, check if it's a blank APN case
        if (match) {
          return match[1]; // This will be "" for blank APNs
        } else {
          // Alternative regex specifically for blank APNs
          const blankMatch = line.match(/\+CGDCONT:\s*\d+,"[^"]+",""/);
          return blankMatch ? "" : null;
        }
      })
      .filter((apn): apn is string => apn !== null);

    // If the current active Data APN is blank, we need to set it to the APN result from CGDCONTDRP
    // Example: AT+CGCONTRDP\n+CGCONTRDP: 1,5,"SMARTLTE","10.108.249.202",,"121.54.70.164","121.54.70.163"\n on which SMARTLTE is the APN name

    let blankAPN;

    if (APNProfiles[0] === "") {
      blankAPN = cgdcontdrp
        .split("\n")
        .find((line: string) => line.includes("+CGCONTRDP:"))
        ?.split(",")[2]
        .replace(/"/g, "");
    } else {
      blankAPN = cgdcontdrp
        .split("\n")
        .find((line: string) => line.includes("+CGCONTRDP:"))
        ?.split(",")[2]
        .replace(/"/g, "");
    }
    // If the APN is blank, we can set it to the APN from CGDCONTDRP
    if (blankAPN !== undefined && blankAPN !== "") {
      APNProfiles[0] = blankAPN;
    }

    // We need to make sure that the profile number is a number and not a string so we can use it as an index
    const profileIndex = parseInt(profileNumber, 10) - 1; // Convert to zero-based index

    // Check if the index is valid
    if (profileIndex >= 0 && profileIndex < APNProfiles.length) {
      // Swap the selected profile with the first one
      const selectedProfile = APNProfiles[profileIndex];
      APNProfiles[profileIndex] = APNProfiles[0];
      APNProfiles[0] = selectedProfile;
    }
    console.log("APN Profiles:", APNProfiles);

    // return the array of APN profiles
    return APNProfiles;
  }
};
