/**
 * Custom hook that fetches and processes cellular modem data for the home dashboard.
 * This hook handles data fetching, processing, error handling, and automatic refresh at regular intervals.
 *
 * The hook fetches data from the API endpoint `/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=1`
 * and transforms the raw response into a structured {@link HomeData} format with information about:
 * - SIM card details (slot, state, provider, etc.)
 * - Connection information (APN, network type, temperature, etc.)
 * - Data transmission metrics (carrier aggregation, bandwidth, signal strength)
 * - Cellular information (cell ID, tracking area code, signal quality)
 * - Current bands information (band numbers, EARFCN, PCI, signal metrics)
 *
 * @returns An object containing:
 * - `data` - The processed cellular modem information, or null if not yet loaded
 * - `isLoading` - Boolean indicating if data is currently being fetched
 * - `error` - Any error that occurred during data fetching, or null if no error
 * - `refresh` - Function to manually trigger a data refresh
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refresh } = useHomeData();
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * return <HomeDisplay data={data} onRefresh={refresh} />;
 * ```
 */

// hooks/useHomeData.ts
import { useState, useEffect, useCallback } from "react";
import { HomeData } from "@/types/types";
import { BANDWIDTH_MAP, NR_BANDWIDTH_MAP } from "@/constants/home/index";

const useHomeData = () => {
  const [data, setData] = useState<HomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Automated recovery function
  const handleErrorWithRetry = useCallback(
    async (err: Error) => {
      console.error("Error fetching home data:", err);

      if (retryCount < 2) {
        // Limit to 2 retry attempts
        console.log(`Attempting automatic recovery (attempt ${retryCount + 1}/2)...`);
        // Increment retry count and attempt refetch
        setRetryCount((prev) => prev + 1);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        fetchHomeData();
      } else {
        // After max retries, show error state and fallback data
        console.error("Max retry attempts reached. Please refresh manually.");
        setError(err);

        // Set fallback data with "Unknown" values
        setData({
          simCard: {
            slot: "Not Inserted",
            state: "Not Inserted",
            provider: "Unknown",
            phoneNumber: "Unknown",
            imsi: "-",
            iccid: "-",
            imei: "-",
          },
          connection: {
            apn: "No APN",
            operatorState: "Unknown",
            functionalityState: "Disabled",
            networkType: "No Signal",
            modemTemperature: "Unknown",
            accessTechnology: "-",
          },
          dataTransmission: {
            carrierAggregation: "Inactive",
            connectedBands: "-",
            signalStrength: "-%",
            mimoLayers: "-",
            bandwidth: "Unknown", // Added missing field
          },
          cellularInfo: {
            cellId: "-",
            trackingAreaCode: "-",
            cellIdRaw: "-",
            trackingAreaCodeRaw: "-",
            physicalCellId: "-",
            earfcn: "-",
            mcc: "-",
            mnc: "-",
            signalQuality: "-%",
          },
          currentBands: {
            id: [1],
            bandNumber: ["-"],
            earfcn: ["-"],
            bandwidth: ["-"],
            pci: ["-"],
            rsrp: ["-"],
            rsrq: ["-"],
            sinr: ["-"],
          },
          networkAddressing: {
            publicIPv4: "-",
            cellularIPv4: "-",
            cellularIPv6: "-",
            carrierPrimaryDNS: "-",
            carrierSecondaryDNS: "-",
            rawCarrierPrimaryDNS: "-",
            rawCarrierSecondaryDNS: "-",
          },
          timeAdvance: {
            lteTimeAdvance: "-",
            nrTimeAdvance: "-",
          },
        });
      }
    },
    [retryCount]
  );

  const fetchHomeData = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=1"
      );
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const rawData = await response.json();
      console.log(rawData); //

      // fetch public ip from /cgi-bin/quecmanager/home/fetch_public_ip.sh
      const publicIPResponse = await fetch(
        "/cgi-bin/quecmanager/home/fetch_public_ip.sh"
      );

      // Process the raw data into the HomeData format
      const processedData: HomeData = {
        simCard: {
          slot: parseField(rawData[0].response, 1, 1, 0),
          state: rawData[6].response.includes("READY") ? "Inserted" : "Not Inserted",
          provider: parseField(rawData[2].response, 1, 1, 2),
          phoneNumber: parseField(rawData[1].response, 1, 1, 1),
          imsi: parseField(rawData[3].response, 1, 0, 0),
          iccid: parseField(rawData[4].response, 1, 1, 1, "Unknown", ":", " "),
          imei: parseField(rawData[5].response, 1, 0, 0),
        },
        connection: {
          apn: parseField(rawData[7]?.response, 1, 1, 2, parseField(rawData[12]?.response, 1, 1, 2)),
          operatorState: getOperatorState(rawData[8]?.response, rawData[16]?.response) || "Unknown",
          functionalityState: parseField(rawData[9]?.response, 1, 1, 0) === "1" ? "Enabled" : "Disabled",
          networkType: getNetworkType(rawData[13].response) || "No Signal",
          modemTemperature: getModemTemperature(rawData[11].response) || "Unknown",
          accessTechnology: getAccessTechnology(rawData[2].response) || "Unknown",
        },
        dataTransmission: {
          carrierAggregation: rawData[13].response.match(/"LTE BAND \d+"|"NR5G BAND \d+"/g) ?.length > 1 ? "Multi" : "Inactive",
          bandwidth: getCurrentBandsBandwidth(rawData[13].response).join(", ") || "Unknown",
          connectedBands: getCurrentBandsBandNumber(rawData[13].response).join(", ").replaceAll("LTE BAND ", "B").replaceAll("NR5G BAND ", "N") || "Unknown",
          signalStrength: getSignalStrength(rawData[14].response) || "Unknown",
          mimoLayers: getMimoLayers(rawData[14].response) || "Unknown",
        },
        cellularInfo: {
          // The TAC and CellID are providing a data map for the network type to correlate to which index to use for the parsing
          cellId: extractValueByNetworkType(rawData[10]?.response, getNetworkType(rawData[13]?.response), { "NR5G-SA": 1, "NR5G-NSA": 2, "LTE": 1 }, { "NR5G-SA": 6, "NR5G-NSA": 4, "LTE": 6 }, false),
          trackingAreaCode: extractValueByNetworkType(rawData[10]?.response, getNetworkType(rawData[13]?.response), { "NR5G-SA": 1, "NR5G-NSA": 2, "LTE": 1 }, { "NR5G-SA": 8, "NR5G-NSA": 10, "LTE": 12 }, false),
          cellIdRaw: extractValueByNetworkType(rawData[10]?.response, getNetworkType(rawData[13]?.response), { "NR5G-SA": 1, "NR5G-NSA": 2, "LTE": 1 }, { "NR5G-SA": 6, "NR5G-NSA": 4, "LTE": 6 }, true), 
          trackingAreaCodeRaw: extractValueByNetworkType(rawData[10]?.response, getNetworkType(rawData[13]?.response), { "NR5G-SA": 1, "NR5G-NSA": 2, "LTE": 1 }, { "NR5G-SA": 8, "NR5G-NSA": 10, "LTE": 12 }, true),
          physicalCellId: getCurrentBandsPCI(rawData[13].response, getNetworkType(rawData[13].response)).join(", ") || "Unknown",
          earfcn: getCurrentBandsEARFCN(rawData[13].response).join(", "),
          mcc: getNetworkCode(rawData[10]?.response, getNetworkType(rawData[13]?.response), { "NR5G-NSA": 2, "LTE": 4, "NR5G-SA": 4 }),
          mnc: getNetworkCode(rawData[10]?.response, getNetworkType(rawData[13]?.response), { "NR5G-NSA": 3, "LTE": 5, "NR5G-SA": 5 }),
          signalQuality: getSignalQuality(rawData[19].response) || "Unknown",
        },
        currentBands: {
          // id is length of bandNumber
          id: Array.from({ length: getCurrentBandsBandNumber(rawData[13].response)?.length ?? 0, }, (_, i) => i + 1) || [1],
          bandNumber: getCurrentBandsBandNumber(rawData[13].response) || ["Unknown",],
          earfcn: getCurrentBandsEARFCN(rawData[13].response),
          bandwidth: getCurrentBandsBandwidth(rawData[13].response) || ["Unknown",],
          pci: getCurrentBandsPCI(rawData[13].response, getNetworkType(rawData[13].response)) || ["Unknown"],
          rsrp: getCurrentBandsRSRP(rawData[13].response),
          rsrq: getCurrentBandsRSRQ(rawData[13].response) || ["Unknown"],
          sinr: getCurrentBandsSINR(rawData[13].response, getNetworkType(rawData[13].response)) || ["Unknown"],
        },
        networkAddressing: {
          publicIPv4: publicIPResponse.ok? (await publicIPResponse.json()).public_ip || "-" : "Can't fetch public IP",
          // Extract IPv4 address from QMAP="WWAN" response
          cellularIPv4: extractIPAddress(rawData, "IPV4"),
          cellularIPv6: extractIPAddress(rawData, "IPV6"),
          // Extract DNS servers from CGCONTRDP response
          carrierPrimaryDNS: formatDNSAddress(parseDNSAddress(rawData, getNetworkType(rawData[13]?.response), 15, { "NR5G-SA": 5, "NR5G-NSA": 6, "LTE": 6 }, 20)),
          carrierSecondaryDNS: formatDNSAddress(parseDNSAddress(rawData, getNetworkType(rawData[13]?.response), 15, { "NR5G-SA": 6, "NR5G-NSA": 7, "LTE": 7 }, 20)),
          rawCarrierPrimaryDNS: parseDNSAddress(rawData, getNetworkType(rawData[13]?.response), 15, { "NR5G-SA": 5, "NR5G-NSA": 6, "LTE": 6 }, 20),
          rawCarrierSecondaryDNS: parseDNSAddress(rawData, getNetworkType(rawData[13]?.response), 15, { "NR5G-SA": 6, "NR5G-NSA": 7, "LTE": 7 }, 20),
        },
        timeAdvance: {
          lteTimeAdvance: parseField(rawData[21]?.response, 1, 1, 2),
          nrTimeAdvance: parseField(rawData[22]?.response, 1, 1, 2),
        },
      };
      setData(processedData);
      setRetryCount(0);
      setError(null);
      console.log("Processed home data:", processedData);// 
    } catch (error) {
      console.error("Error fetching home data:", error);
      handleErrorWithRetry(
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      setIsLoading(false);
    }
  }, [handleErrorWithRetry]);

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout;

    const loadData = async () => {
      if (!isMounted) return;
      try {
        await fetchHomeData();
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    // Initial load
    loadData();

    // Set up polling interval
    intervalId = setInterval(() => {
      fetchHomeData();
    }, 15000);

    // Cleanup function
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [fetchHomeData]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchHomeData();
    setIsLoading(false);
  }, [fetchHomeData]);

  return { data, isLoading, error, refresh };
};

// Helper functions for data processing
const parseField = (
  response: string,
  lineIndex: number,
  firstField: number,
  fieldIndex: number,
  defaultValue = "Unknown",
  firstDelimiter = ":",
  secondDelimiter = ",",
) => {
  try {
    return (
      response.split("\n")[lineIndex]?.split(firstDelimiter)[firstField]?.split(secondDelimiter)[
        fieldIndex
      ]?.replace(/"/g, "")
        .trim() || defaultValue
    );
  } catch {
    return defaultValue;
  }
};

// Helper function to extract and process IPv4 and IPv6 addresses
const extractIPAddress = (rawData: any, type: "IPV4" | "IPV6", defaultValue = "-"): string => {
  const line = rawData[15]?.response?.split("\n")
    .find((line: string) => line.includes('QMAP: "WWAN"') && line.includes(`"${type}"`));
  const ipAddress = parseField(line || "", 0, 1, 4, defaultValue, " ", ",");
  const parsedIP = type == "IPV6" ? ipAddress.replace(/::/g, ":") : ipAddress;
  const invalid_values = ["0.0.0.0", "::", "::0", "::0:0:0:0:0:0:0:0", "0:0:0:0:0:0:0:0"];
  return invalid_values.includes(parsedIP) ? defaultValue : parsedIP;
};

// Helper function to parse DNS addresses
const parseDNSAddress = (
  rawData: any,
  networkType: string,
  profileIndex: number,
  dnsFieldIndex: Record<string, number>,
  cdgcontIndex: number,
  defaultValue = "-"
): string => {
  try {
    if (!rawData[profileIndex]?.response || !rawData[cdgcontIndex]?.response) return defaultValue;

    // Step 1: Get profile ID from QMAP="WWAN" response
    const qmapLines = rawData[profileIndex].response
      .split("\n")
      .filter((line: string) => line.includes('+QMAP: "WWAN"'));

    const profileIDMatch = qmapLines[0]?.match(/\+QMAP: "WWAN",\d+,(\d+),/);
    const profileID = profileIDMatch ? profileIDMatch[1] : null;

    if (!profileID) return defaultValue;

    // Step 2: Find matching CID in CGCONTRDP
    const cgcontrdpLines = rawData[cdgcontIndex].response
      .split("\n")
      .filter((line: string) => line.includes("+CGCONTRDP:"));

    const matchingLine = cgcontrdpLines.find((line: string) => {
      const cid = line.match(/\+CGCONTRDP: (\d+),/);
      return cid && cid[1] === profileID;
    });

    if (!matchingLine) return defaultValue;

    // Step 3: Extract DNS field
    const parts = matchingLine.split(",");
    if (parts.length <= dnsFieldIndex[networkType]) return defaultValue;
    return parts[dnsFieldIndex[networkType]].replace(/"/g, "").trim() || defaultValue;
  } catch (error) {
    console.error("Error parsing DNS address:", error);
    return defaultValue;
  }
};

// Helper function to format DNS addresses
const formatDNSAddress = (dnsAddress: string): string => {
  try {
    const isIPv4 = dnsAddress.match(
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    );
    const isDottedIPv6 = dnsAddress.split(".").length > 4;
    return isIPv4 ? dnsAddress : isDottedIPv6 ? formatDottedIPv6(dnsAddress) : dnsAddress.replace(/:{3,}/g, "::");
  } catch (error) {
    console.error("Error formatting DNS address:", error);
    return dnsAddress;
  }
};

const getAccessTechnology = (response: string) => parseField(response, 1, 1, 3);

const getOperatorState = (lteResponse: string, nr5gResponse: string): "Unknown" | "Registered" | "Searching" | "Denied" | "Roaming" | "Not Registered" => {
  const state =
    Number(parseField(lteResponse, 1, 1, 1)) || Number(parseField(nr5gResponse, 1, 1, 1));
  const stateMap: Record<number, "Unknown" | "Registered" | "Searching" | "Denied" | "Roaming" | "Not Registered"> = {
    1: "Registered",
    2: "Searching",
    3: "Denied",
    4: "Unknown",
    5: "Roaming",
  };
  return stateMap[state] || "Not Registered";
};

const getNetworkType = (response: string) => {
  const bands = response.match(/"LTE BAND \d+"|"NR5G BAND \d+"/g) || [];
  const hasLTE = bands?.some((band) => band.includes("LTE"));
  const hasNR5G = bands?.some((band) => band.includes("NR5G"));
  return hasLTE && hasNR5G ? "NR5G-NSA" : hasLTE ? "LTE" : hasNR5G ? "NR5G-SA" : "No Signal";
};

const getModemTemperature = (response: string) => {
  const temps = ["cpuss-0", "cpuss-1", "cpuss-2", "cpuss-3"].map((cpu) => {
    const line = response.split("\n").find((l) => l.includes(cpu));
    return parseInt(line!?.split(":")[1]?.split(",")[1].replace(/"/g, "").trim());
  });
  const avgTemp = temps.reduce((acc, t) => acc + t, 0) / temps.length;
  return `${Math.round(avgTemp)}°C`;
};

const getSignalStrength = (response: string): string => {
  const INVALID_RSRP_VALUES = [-140, -37625, -32768];
  // Helper function to extract and filter RSRP values
  const extractRSRP = (line?: string): number[] =>
    line?.split(":")[1]?.split(",")
      .slice(0, 4)
      .map((v) => parseInt(v.trim()))
      .filter((v) => !INVALID_RSRP_VALUES.includes(v)) || [];

  // Extract RSRP values for LTE and NR5G
  const rsrpLteArr = extractRSRP(response.split("\n").find((l) => l.includes("LTE")));
  const rsrpNrArr = extractRSRP(response.split("\n").find((l) => l.includes("NR5G")));

  // Helper function to calculate percentage
  const calculatePercentage = (values: number[]): number =>
    Math.max(0, Math.min(100, ((values.reduce((acc, v) => acc + v, 0) / values.length + 125) / 50) * 100));

  // Calculate signal strength percentages
  const ltePercentage = rsrpLteArr.length ? calculatePercentage(rsrpLteArr) : null;
  const nrPercentage = rsrpNrArr.length ? calculatePercentage(rsrpNrArr) : null;

  // Determine final signal strength
  return ltePercentage !== null && nrPercentage !== null ? `${Math.round((ltePercentage + nrPercentage) / 2)}%` : ltePercentage !== null ? `${Math.round(ltePercentage)}%` : nrPercentage !== null ? `${Math.round(nrPercentage)}%` : "Unknown%";
};

// Function to parse the TAC and CellID from the response and return the values from Hex to Decimal format based on the lineIndex and fieldIndex of the respective Index Maps
const extractValueByNetworkType = (response: string, networkType: string, lineIndexMap: Record<string, number>, fieldIndexMap: Record<string, number>, raw = false): string => {
  const lineIndex = lineIndexMap[networkType];
  const fieldIndex = fieldIndexMap[networkType];
  return lineIndex !== undefined && fieldIndex !== undefined && !raw
    ? parseInt(parseField(response, lineIndex, 1, fieldIndex), 16).toString().toUpperCase()
    : lineIndex !== undefined && fieldIndex !== undefined && raw
    ? parseField(response, lineIndex, 1, fieldIndex).toUpperCase()
    : "Unknown";
};

// Function to get the MNC or MCC based on the network type and field index map
const getNetworkCode = (response: string, networkType: string, fieldIndexMap: Record<string, number>): string => {
  const lineIndex = networkType === "NR5G-NSA" ? 2 : 1;
  const fieldIndex = fieldIndexMap[networkType];
  return parseField(response, lineIndex, 1, fieldIndex);
};

const getSignalQuality = (response: string): string => {
  const INVALID_VALUES = [-140, -32768, -37625];
  const parseSignalValues = (line?: string): number[] =>
    parseField(line || "", 0, 1, 1, "Unknown", ":", " ").split(",").slice(0,4).map((v) => parseInt(v.trim())).filter((v) => !INVALID_VALUES.includes(v)) || [];
  const calculatePercentage = (values: number[]): number =>
    values.length
      ? Math.max(0, Math.min(100, ((values.reduce((acc, v) => acc + v, 0) / values.length - -10) / 40) * 100))
      : 0;

  const lines = response.split("\n");
  const ltePercentage = calculatePercentage(parseSignalValues(lines.find((l) => l.includes("LTE"))));
  const nrPercentage = calculatePercentage(parseSignalValues(lines.find((l) => l.includes("NR5G"))));
  return ltePercentage && nrPercentage
    ? `${Math.round((ltePercentage + nrPercentage) / 2)}%`
    : ltePercentage
    ? `${Math.round(ltePercentage)}%`
    : nrPercentage
    ? `${Math.round(nrPercentage)}%`
    : "Unknown%";
};

const getCurrentBandsBandNumber = (response: string): string[] => {
  const extractBands = (lines: string[]): string[] =>
    lines.map((line) => parseField(line, 0, 1, 3, "Unknown", ":", ","));

  const bandsLte = extractBands(response.split("+QCAINFO").filter((line) => line.includes("LTE BAND")));
  const bandsNr5g = extractBands(response.split("+QCAINFO").filter((line) => line.includes("NR5G BAND")));

  const allBands = [...bandsLte, ...bandsNr5g];
  return allBands.length ? allBands : ["Unknown"];
};

const getCurrentBandsEARFCN = (response: string): string[] => {
  const extractEARFCNs = (type: string) =>
    response
      .split("+QCAINFO")
      .filter((line) => line.includes(type))
      .map((line) => line.split(":")[1]?.split(",")[1]?.trim() || "Unknown");

  const earfcnsLte = extractEARFCNs("LTE BAND");
  const earfcnsNr5g = extractEARFCNs("NR5G BAND");

  return [...earfcnsLte, ...earfcnsNr5g].length ? [...earfcnsLte, ...earfcnsNr5g] : ["Unknown"];
};

const getCurrentBandsBandwidth = (response: string): string[] => {
  const extractBandwidths = (type: string, map: Record<string, string>) =>
    response
      .split("+QCAINFO")
      .filter((line) => line.includes(type))
      .map((line) => map[line.split(":")[1]?.split(",")[2]] || "Unknown");

  const bandwidthsLte = extractBandwidths("LTE BAND", BANDWIDTH_MAP);
  const bandwidthsNr5g = extractBandwidths("NR5G BAND", NR_BANDWIDTH_MAP);

  return [...bandwidthsLte, ...bandwidthsNr5g].length
    ? [...bandwidthsLte, ...bandwidthsNr5g]
    : ["Unknown"];
};

const getCurrentBandsPCI = (response: string, networkType: string): string[] => {
  const getPCIFromParts = (parts: string[] | undefined): string => {
    if (!parts) return "Unknown";
    const pciIndex: 4 | 5 = (() => {
      switch (parts.length) {
        case 8: // length 8, PCI is at index 4, NR5G PCC and NR5G SCC Band when NR5G-NSA
          return 4;
        case 13: // length 13, PCI is at index 5, LTE SCC Band
        case 12: // length 12, PCI is at index 5, NR5G SCC Band
        case 10: // length 10, PCI is at index 5, LTE PCC Band
        default:
          return 5;
      }
    })();
    return parts[pciIndex]?.trim() || "Unknown";
  };
  const extractPCI = (lines: string[]): string[] =>  lines
      .map((line) => getPCIFromParts(line.split(":")[1]?.split(",")));

  const lines = response.split("+QCAINFO");
  const pccPCI = extractPCI(lines.filter((l)=> l.includes("PCC")))[0];
  const sccPCIs = extractPCI(lines.filter((l) => l.includes("SCC")));
  return [pccPCI, ...sccPCIs].filter((pci) => pci !== "Unknown");

};

const getCurrentBandsRSRP = (
  response: string,
): string[] => {
  const getRSRPFromParts = (parts: string[] | undefined): string => {
    if (!parts) return "Unknown";
    const pciIndex: 5 | 6 |9 = (() => {
      switch (parts.length) {
        case 8: // length 8, RSRP is at index 4, NR SA PCC and NR NSA SCC Band when NR5G-NSA
          return 5;
        case 12: // length 12, RSRP is at index 5, NR NSA/SA SCC Band X
          return 9;
        case 13: // length 13, RSRP is at index 5, LTE SCC Band X
        case 10: // length 10, RSRP is at index 5, LTE/NR NSA PCC Band X
        default:
          return 6;
      }
    })();
    return parts[pciIndex]?.trim() || "Unknown";
  };

  const extractRSRP = (lines: string[]): string[] => {
    return lines
      .map((line) => getRSRPFromParts(line.split(":")[1]?.split(",")));
  };
  const lines = response.split("+QCAINFO");
  const pccRSRP = extractRSRP(lines.filter((l)=> l.includes("PCC")))[0];
  const sccRSRPs = extractRSRP(lines.filter((l) => l.includes("SCC")));
  return [pccRSRP, ...sccRSRPs].filter((pci) => pci !== "Unknown");
};

const getCurrentBandsRSRQ = (
  response: string,
): string[] => {
  const getRSRQFromParts = (parts: string[] | undefined): string => {
    if (!parts) return "Unknown";
    const pciIndex: 6 | 7 | 10 = (() => {
      switch (parts.length) {
        case 8: // length 8, RSRQ is at index 4, NR SA PCC and NR NSA SCC Band when NR5G-NSA
          return 6;
        case 12: // length 12, RSRQ is at index 5, NR NSA/SA SCC Band X
          return 10;
        case 13: // length 13, RSRQ is at index 5, LTE SCC Band X
        case 10: // length 10, RSRQ is at index 5, LTE/NR NSA PCC Band X
        default:
          return 7;
      }
    })();
    return parts[pciIndex]?.trim() || "Unknown";
  };

  const extractRSRQ = (lines: string[]): string[] => {
    return lines
      .map((line) => getRSRQFromParts(line.split(":")[1]?.split(",")));
  };
  const lines = response.split("+QCAINFO");
  const pccRSRQ = extractRSRQ(lines.filter((l)=> l.includes("PCC")))[0];
  const sccRSRQs = extractRSRQ(lines.filter((l) => l.includes("SCC")));
  return [pccRSRQ, ...sccRSRQs].filter((pci) => pci !== "Unknown");
};
// AT+QCAINFO=1;+QCAINFO;+QCAINFO=0
// +QCAINFO: "PCC",501390,12,"NR5G BAND 41",147,-11,-11,2463
// +QCAINFO: "SCC",393850,3,"NR5G BAND 25",1,354,1,3,378000
// +QCAINFO: "SCC",398410,0,"NR5G BAND 25",1,354,0,-,-
// +QCAINFO: "SCC",521310,11,"NR5G BAND 41",1,147,0,-,-,-11,-11,2463

const getCurrentBandsSINR = (
  response: string,
  networkType: string,
): string[] => {
  const getSINRFromParts = (parts: string[] | undefined): string => {
    if (!parts) return "Unknown";
    const pciIndex: 7 | 8 | 9 | 11 = (() => {
      switch (parts.length) {
        case 9: // length 8, NR SA PCC and NR NSA SCC Band when NR5G-NSA
          return 8;
        case 8: // length 8, NR SA PCC and NR NSA SCC Band when NR5G-NSA
          return 7;
        case 12: // length 12, NR NSA/SA SCC Band X
          return 11;
        case 13: // length 13, LTE SCC Band X
        case 10: // length 10, LTE/NR NSA PCC Band X
        default:
          return 9;
      }
    })();
    return parts[pciIndex]?.trim() || "Unknown";
  };

  const extractSINR = (lines: string[], networkType: string): string[] => 
    lines
      .map((line) => {
        const rawSINR = getSINRFromParts(line.split(":")[1]?.split(","));
        if (rawSINR === "-32768") return "-";
        const calculatedSINR = parseInt(rawSINR) >= 4000 ? "4000" : parseInt(rawSINR) < -3000 ? "-" : rawSINR;
        return !isNaN(parseInt(calculatedSINR)) && !line.includes("LTE")  ? Math.round(parseInt(calculatedSINR) / 100).toString() : calculatedSINR || "Unknown";
      });

  const lines = response.split("+QCAINFO");
  const pccSINR = extractSINR(lines.filter((l)=> l.includes("PCC")), networkType)[0];
  const sccSINRs = extractSINR(lines.filter((l) => l.includes("SCC")),networkType);
  return [pccSINR, ...sccSINRs].filter((c) => c !== "Unknown");
};

const getMimoLayers = (response: string): string => {
  const INVALID_VALUES = [-32768, -140];

  // Helper function to extract and filter RSRP values
  const extractRSRP = (line?: string): number[] =>
    parseField(line || "", 0, 1, 1, "-32768", ":", " ").split(",").slice(0, 4).map((v) => parseInt(v.trim())).filter((v) => !INVALID_VALUES.includes(v)) || [];

  // Extract RSRP values for LTE and NR5G
  const lteRSRPCount = extractRSRP(response.split("\n").find((l) => l.includes("LTE"))).length;
  const nr5gRSRPCount = extractRSRP(response.split("\n").find((l) => l.includes("NR5G"))).length;
  // Determine MIMO layers
  return lteRSRPCount && nr5gRSRPCount ? `LTE ${lteRSRPCount} /  NR ${nr5gRSRPCount}` : lteRSRPCount ? ` LTE ${lteRSRPCount}` : nr5gRSRPCount ? `NR ${nr5gRSRPCount}` : "Unknown";
};

// Add this helper function in your file (outside the React component)
const formatDottedIPv6 = (dottedIPv6: string): string => {
  try {
    // Split by dots
    const parts = dottedIPv6.split(".");

    // Only process if it looks like a dotted IPv6
    if (parts.length < 8) return dottedIPv6;

    // Convert each decimal to 2-digit hex
    const hexParts = parts.map((part) => {
      const num = parseInt(part, 10);
      if (isNaN(num)) return "00";
      return num.toString(16).padStart(2, "0");
    });

    // Group into 8 blocks of 2 bytes each
    const ipv6Blocks = [];
    for (let i = 0; i < hexParts.length; i += 2) {
      if (i + 1 < hexParts.length) {
        ipv6Blocks.push(hexParts[i] + hexParts[i + 1]);
      } else {
        ipv6Blocks.push(hexParts[i] + "00");
      }
    }

    // Remove leading zeros from each block
    const cleanedBlocks = ipv6Blocks.map(
      (block) => block.replace(/^0+/, "") || "0"
    );

    // Find longest run of zeros for compression
    let longestZeros: string | any[] = [];
    let currentZeros = [];

    for (let i = 0; i < cleanedBlocks.length; i++) {
      if (cleanedBlocks[i] === "0") {
        currentZeros.push(i);
      } else if (currentZeros.length > 0) {
        if (currentZeros.length > longestZeros.length) {
          longestZeros = [...currentZeros];
        }
        currentZeros = [];
      }
    }

    // Check final run of zeros
    if (currentZeros.length > longestZeros.length) {
      longestZeros = [...currentZeros];
    }

    // Apply zero compression if we have at least 2 consecutive zeros
    if (longestZeros.length >= 2) {
      const result = [];
      for (let i = 0; i < cleanedBlocks.length; i++) {
        if (i === longestZeros[0]) {
          result.push(""); // Start of compressed section
          i = longestZeros[longestZeros.length - 1]; // Skip to end of zeros
        } else {
          result.push(cleanedBlocks[i]);
        }
      }

      return result.join(":").replace(/::+/g, "::");
    }

    // If no compression, just join the blocks
    return cleanedBlocks.join(":");
  } catch (err) {
    console.error("Error formatting IPv6:", err);
    return dottedIPv6;
  }
};

export default useHomeData;
