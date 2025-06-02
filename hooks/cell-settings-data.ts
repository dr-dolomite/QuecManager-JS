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

// !! MARK AS UNUSED HOOK, NEED CONFIRMATION

// hooks/cellSettingsData.ts
import { useState, useEffect, useCallback } from "react";
import { CellSettingsData } from "@/types/types";
import { get } from "http";

interface APNProfile {
  cid: string;
  pdpType: string;
  apn: string;
  isActive: boolean;
}

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
        selectedMbnProfile: rawData[7].response.split("\n").filter((line: string) => line.includes('QMBNCFG: "List"')).findIndex((line: any) => line.split(",")[3] == 1).toString(),
        // Look for QMAP="WWAN",<active state>,< profile index> and get the profile index
        // This is the profile that is currently selected for data connection
        // Extract the profile ID from QMAP="WWAN" response
        dataProfileIndex: (() => {
          try {
            if (!rawData[8]?.response) return "-";

            // Get all WWAN lines from the response
            const qmapLines = rawData[8].response
              .split("\n")
              .filter((line: string | string[]) =>
                line.includes('+QMAP: "WWAN"')
              );

            if (!qmapLines.length) return "-";

            // Extract the profile ID using regex - it's the third field (after two commas)
            const profileIDMatch = qmapLines[0].match(
              /\+QMAP: "WWAN",\d+,(\d+),/
            );
            const profileID = profileIDMatch ? profileIDMatch[1] : "-";

            return profileID;
          } catch (error) {
            console.error("Error extracting data profile index:", error);
            return "-";
          }
        })(),
        lteAMBR: getLTEAMBRValue(rawData[9]?.response),
        nr5gAMBR: getNR5GAMBRValue(rawData[10]?.response),
      };

      console.log("Processed cell settings data:", processedData);
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

const getAPNProfiles = (
  cgdcont: string,
  wwan: string,
  cgdcontrdp: string
): string[] => {
  try {
    // Step 1: Extract the profile ID from QMAP="WWAN" response (active profile)
    const qmapLines = wwan
      .split("\n")
      .filter((line) => line.includes('+QMAP: "WWAN"'));

    const profileIDMatch = qmapLines[0]?.match(/\+QMAP: "WWAN",\d+,(\d+),/);
    const activeProfileID = profileIDMatch ? profileIDMatch[1] : null;
    console.log("Active Profile ID:", activeProfileID);

    // Step 2: Parse all profiles from CGDCONT response
    const cgdcontProfiles = cgdcont
      .split("\n")
      .filter((line) => line.includes("+CGDCONT:"))
      .map((line) => {
        const parts = line.split(",");
        if (parts.length < 3) return null;

        // Extract cid (remove "+CGDCONT: " prefix)
        const cid = parts[0].replace("+CGDCONT:", "").trim();

        // Extract PDP type (remove quotes)
        const pdpType = parts[1].replace(/"/g, "");

        // Extract APN (remove quotes)
        let apn = parts[2].replace(/"/g, "");

        // Check if this is the active profile but has empty APN
        const isActive = cid === activeProfileID;

        // If APN is empty and this is the active profile, find real APN from CGCONTRDP
        if (isActive && (!apn || apn === "")) {
          console.log("Empty APN for active profile, checking CGCONTRDP");

          // Look for matching cid in CGCONTRDP
          const cgcontrdpLine = cgdcontrdp.split("\n").find((line) => {
            const match = line.match(/\+CGCONTRDP: (\d+),/);
            return match && match[1] === cid;
          });

          if (cgcontrdpLine) {
            // Extract APN from CGCONTRDP (3rd field)
            const parts = cgcontrdpLine.split(",");
            if (parts.length >= 3) {
              apn = parts[2].replace(/"/g, "");
              console.log("Found dynamic APN from CGCONTRDP:", apn);
            }
          }
        }

        return {
          cid,
          pdpType,
          apn,
          isActive,
        } as APNProfile; // Add explicit type
      })
      .filter((profile): profile is APNProfile => profile !== null); // Type predicate to filter null values

    // Step 3: Sort profiles to put active one first
    cgdcontProfiles.sort((a, b) => {
      if (a.isActive) return -1;
      if (b.isActive) return 1;
      return parseInt(a.cid) - parseInt(b.cid);
    });

    console.log("APN Profiles:", cgdcontProfiles);

    // Return just the APNs in order, with active one first
    return cgdcontProfiles.map((profile) => profile.apn);
  } catch (error) {
    console.error("Error processing APN profiles:", error);
    return ["Error fetching APN profiles"];
  }
};

const getLTEAMBRValue = (data: string): string[] => {
  try {
    if (!data) {
      console.log("No data provided for LTE AMBR parsing");
      return [];
    }

    // Check if the response is empty (no AMBR values)
    if (!data.includes('+QNWCFG: "lte_ambr"')) {
      console.log("No LTE AMBR values in response");
      return [];
    }

    // Step 1: Split the response into lines
    const lines = data.split("\n");

    // Step 2: Filter for lines containing AMBR values
    const ambrLines = lines.filter((line) =>
      line.includes('+QNWCFG: "lte_ambr"')
    );

    if (!ambrLines.length) {
      console.log("No LTE AMBR values found after filtering");
      return [];
    }

    // Step 3: Process each line and flatten into a single string array
    const result: string[] = [];

    ambrLines.forEach((line) => {
      // RegEx to extract values
      const match = line.match(/\+QNWCFG: "lte_ambr","([^"]+)",(\d+),(\d+)/);

      if (match && match.length >= 4) {
        const apnName = match[1];
        const downloadValue = match[2];
        const uploadValue = match[3];

        // Add all values to flat array
        result.push(apnName);
        result.push(downloadValue);
        result.push(uploadValue);
      }
    });

    return result;
  } catch (error) {
    console.error("Error processing LTE AMBR values:", error);
    return [];
  }
};

const getNR5GAMBRValue = (data: string): string[] => {
  try {
    if (!data) {
      console.log("No data provided for NR5G AMBR parsing");
      return [];
    }

    // Check if the response is empty (no AMBR values)
    if (!data.includes('+QNWCFG: "nr5g_ambr"')) {
      console.log("No NR5G AMBR values in response");
      return [];
    }

    // Step 1: Split the response into lines
    const lines = data.split("\n");

    // Step 2: Filter for lines containing AMBR values
    const ambrLines = lines.filter((line) =>
      line.includes('+QNWCFG: "nr5g_ambr"')
    );

    if (!ambrLines.length) {
      console.log("No NR5G AMBR values found after filtering");
      return [];
    }

    // Step 3: Process each line and flatten into a single string array
    const result: string[] = [];

    ambrLines.forEach((line) => {
      // RegEx to extract values
      const match = line.match(/\+QNWCFG: "nr5g_ambr","([^"]+)",(\d+),(\d+)/);

      if (match && match.length >= 4) {
        const apnName = match[1];
        const downloadValue = match[2];
        const uploadValue = match[3];

        // Add all values to flat array
        result.push(apnName);
        result.push(downloadValue);
        result.push(uploadValue);
      }
    });

    return result;
  } catch (error) {
    console.error("Error processing NR5G AMBR values:", error);
    return [];
  }
};
