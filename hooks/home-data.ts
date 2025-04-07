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
        console.log(
          `Attempting automatic recovery (attempt ${retryCount + 1}/2)...`
        );

        // Wait 3 seconds before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Increment retry count and attempt refetch
        setRetryCount((prev) => prev + 1);
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
      console.log(rawData);

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
          iccid: parseField(rawData[4].response, 1, 1, 1, "Unknown", " "),
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
          bandwidth: getBandwidth(rawData[13].response, getNetworkType(rawData[13].response)) || "Unknown",
          connectedBands: getConnectedBands(rawData[13].response) || "Unknown",
          signalStrength: getSignalStrength(rawData[14].response) || "Unknown",
          mimoLayers: getMimoLayers(rawData[14].response) || "Unknown",
        },
        cellularInfo: {
          cellId: extractValueByNetworkType(rawData[10]?.response, getNetworkType(rawData[13]?.response), { "NR5G-SA": 1, "NR5G-NSA": 2, "LTE": 1 }, { "NR5G-SA": 6, "NR5G-NSA": 4, "LTE": 6 }),
          trackingAreaCode: extractValueByNetworkType(rawData[10]?.response, getNetworkType(rawData[13]?.response), { "NR5G-SA": 1, "NR5G-NSA": 2, "LTE": 1 }, { "NR5G-SA": 8, "NR5G-NSA": 10, "LTE": 12 }),
          physicalCellId: getPhysicalCellIDs(rawData[13].response, getNetworkType(rawData[13].response)),
          earfcn: getEARFCN(rawData[13].response),
          mcc: getMCC(rawData[10].response, getNetworkType(rawData[13].response)) || "Unknown",
          mnc: getMNC(rawData[10].response, getNetworkType(rawData[13].response)) || "Unknown",
          signalQuality: getSignalQuality(rawData[19].response) || "Unknown",
        },
        currentBands: {
          // id is length of bandNumber
          id: Array.from({ length: getCurrentBandsBandNumber(rawData[13].response)?.length ?? 0, }, (_, i) => i + 1) || [1],
          bandNumber: getCurrentBandsBandNumber(rawData[13].response) || ["Unknown",],
          earfcn: getCurrentBandsEARFCN(rawData[13].response),
          bandwidth: getCurrentBandsBandwidth(rawData[13].response) || ["Unknown",],
          pci: getCurrentBandsPCI(rawData[13].response, getNetworkType(rawData[13].response)) || ["Unknown"],
          rsrp: getCurrentBandsRSRP(rawData[13].response, getNetworkType(rawData[13].response), rawData[10].response),
          rsrq: getCurrentBandsRSRQ(rawData[13].response, getNetworkType(rawData[13].response), rawData[10].response) || ["Unknown"],
          sinr: getCurrentBandsSINR(rawData[13].response, getNetworkType(rawData[13].response), rawData[10].response) || ["Unknown"],
        },
        networkAddressing: {
          publicIPv4: publicIPResponse.ok
            ? (await publicIPResponse.json()).public_ip || "-"
            : "Can't fetch public IP",

          // Extract IPv4 address from QMAP="WWAN" response
          cellularIPv4: (() => {
            const ipv4Line = rawData[15].response
              .split("\n")
              .find(
                (l: string | string[]) =>
                  l.includes('QMAP: "WWAN"') && l.includes('"IPV4"')
              );

            const ipv4Address = ipv4Line
              ? ipv4Line.match(/"IPV4","([^"]+)"/)?.[1] || "-"
              : "-";

            return ipv4Address === "0.0.0.0" ? "-" : ipv4Address;
          })(),

          // Extract IPv6 address from QMAP="WWAN" response
          cellularIPv6: (() => {
            const ipv6Line = rawData[15].response
              .split("\n")
              .find(
                (l: string | string[]) =>
                  l.includes('QMAP: "WWAN"') && l.includes('"IPV6"')
              );

            const ipv6Address = ipv6Line
              ? ipv6Line.match(/"IPV6","([^"]+)"/)?.[1] || "-"
              : "-";

            // Parse the IPv6 address to show its shortened version
            const parsedIPv6 = ipv6Address
              ? ipv6Address.replace(/::/g, ":")
              : "-";
            // If the parsed IPv6 address is "::" or "0:0:0:0:0:0:0:0", return "-"
            return parsedIPv6 === "::" || parsedIPv6 === "0:0:0:0:0:0:0:0"
              ? "-"
              : parsedIPv6;
          })(),

          // Extract DNS servers from CGCONTRDP response
          carrierPrimaryDNS: (() => {
            try {
              if (!rawData[15]?.response || !rawData[20]?.response) return "-";

              // Step 1: Get profile ID from QMAP="WWAN" response
              const qmapLines = rawData[15].response
                .split("\n")
                .filter((line: string | string[]) =>
                  line.includes('+QMAP: "WWAN"')
                );

              // Extract the profile ID from the first WWAN line
              const profileIDMatch = qmapLines[0]?.match(
                /\+QMAP: "WWAN",\d+,(\d+),/
              );
              const profileID = profileIDMatch ? profileIDMatch[1] : null;
              // console.log("Profile ID:", profileID);

              if (!profileID) return "-";

              // Step 2: Find matching CID in CGCONTRDP
              const cgcontrdpLines = rawData[20].response
                .split("\n")
                .filter((line: string | string[]) =>
                  line.includes("+CGCONTRDP:")
                );

              // Find the line where CID matches our profile ID
              const matchingLine = cgcontrdpLines.find((line: string) => {
                const cid = line.match(/\+CGCONTRDP: (\d+),/);
                return cid && cid[1] === profileID;
              });

              if (!matchingLine) return "-";

              // Step 3: Extract primary DNS (second to last field)
              const parts = matchingLine.split(",");
              if (parts.length < 2) return "-";

              // Primary DNS is the second to last element
              const dnsAddress = parts[parts.length - 2]
                .replace(/"/g, "")
                .trim();

              // Step 4: Format based on IP type
              const isIPv4 = dnsAddress.match(
                /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
              );

              // Detect dotted-decimal IPv6 format (long string with many dots)
              const isDottedIPv6 = dnsAddress.split(".").length > 4;

              if (isIPv4) {
                return dnsAddress;
              } else if (isDottedIPv6) {
                // Convert dotted-decimal IPv6 to standard IPv6 notation
                return formatDottedIPv6(dnsAddress);
              } else {
                // Handle regular colon-separated IPv6
                return dnsAddress.replace(/:{3,}/g, "::");
              }
            } catch (error) {
              console.error("Error extracting primary DNS:", error);
              return "-";
            }
          })(),

          carrierSecondaryDNS: (() => {
            try {
              if (!rawData[15]?.response || !rawData[20]?.response) return "-";

              // Step 1: Get profile ID from QMAP="WWAN" response
              const qmapLines = rawData[15].response
                .split("\n")
                .filter((line: string | string[]) =>
                  line.includes('+QMAP: "WWAN"')
                );

              const profileIDMatch = qmapLines[0]?.match(
                /\+QMAP: "WWAN",\d+,(\d+),/
              );
              const profileID = profileIDMatch ? profileIDMatch[1] : null;

              if (!profileID) return "-";

              // Step 2: Find matching CID in CGCONTRDP
              const cgcontrdpLines = rawData[20].response
                .split("\n")
                .filter((line: string | string[]) =>
                  line.includes("+CGCONTRDP:")
                );

              const matchingLine = cgcontrdpLines.find((line: string) => {
                const cid = line.match(/\+CGCONTRDP: (\d+),/);
                return cid && cid[1] === profileID;
              });

              if (!matchingLine) return "-";

              // Step 3: Extract secondary DNS (last field)
              const parts = matchingLine.split(",");
              if (parts.length < 2) return "-";

              // Primary DNS is the second to last element
              const dnsAddress = parts[parts.length - 1]
                .replace(/"/g, "")
                .trim();

              // Step 4: Format based on IP type
              const isIPv4 = dnsAddress.match(
                /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
              );

              // Detect dotted-decimal IPv6 format (long string with many dots)
              const isDottedIPv6 = dnsAddress.split(".").length > 4;

              if (isIPv4) {
                return dnsAddress;
              } else if (isDottedIPv6) {
                // Convert dotted-decimal IPv6 to standard IPv6 notation
                return formatDottedIPv6(dnsAddress);
              } else {
                // Handle regular colon-separated IPv6
                return dnsAddress.replace(/:{3,}/g, "::");
              }
            } catch (error) {
              console.error("Error extracting primary DNS:", error);
              return "-";
            }
          })(),
          // Raw DNS addresses without formatting
          rawCarrierPrimaryDNS: (() => {
            try {
              // [15] is the WWAN QMAP response, [20] is the CGCONTRDP response
              if (!rawData[15]?.response || !rawData[20]?.response) return "-";

              // Step 1: Get profile ID from QMAP="WWAN" response
              const qmapLines = rawData[15].response
                .split("\n")
                .filter((line: string | string[]) =>
                  line.includes('+QMAP: "WWAN"')
                );

              const profileIDMatch = qmapLines[0]?.match(
                /\+QMAP: "WWAN",\d+,(\d+),/
              );
              const profileID = profileIDMatch ? profileIDMatch[1] : null;

              if (!profileID) return "-";

              // Step 2: Find matching CID in CGCONTRDP
              const cgcontrdpLines = rawData[20].response
                .split("\n")
                .filter((line: string | string[]) =>
                  line.includes("+CGCONTRDP:")
                );

              const matchingLine = cgcontrdpLines.find((line: string) => {
                const cid = line.match(/\+CGCONTRDP: (\d+),/);
                return cid && cid[1] === profileID;
              });

              if (!matchingLine) return "-";

              // Step 3: Extract primary DNS (second to last field) without formatting
              const parts = matchingLine.split(",");
              if (parts.length < 2) return "-";

              // Return the raw DNS address without formatting
              return parts[parts.length - 2].replace(/"/g, "").trim() || "-";
            } catch (error) {
              console.error("Error extracting raw primary DNS:", error);
              return "-";
            }
          })(),

          rawCarrierSecondaryDNS: (() => {
            try {
              if (!rawData[15]?.response || !rawData[20]?.response) return "-";

              // Step 1: Get profile ID from QMAP="WWAN" response
              const qmapLines = rawData[15].response
                .split("\n")
                .filter((line: string | string[]) =>
                  line.includes('+QMAP: "WWAN"')
                );

              const profileIDMatch = qmapLines[0]?.match(
                /\+QMAP: "WWAN",\d+,(\d+),/
              );
              const profileID = profileIDMatch ? profileIDMatch[1] : null;

              if (!profileID) return "-";

              // Step 2: Find matching CID in CGCONTRDP
              const cgcontrdpLines = rawData[20].response
                .split("\n")
                .filter((line: string | string[]) =>
                  line.includes("+CGCONTRDP:")
                );

              const matchingLine = cgcontrdpLines.find((line: string) => {
                const cid = line.match(/\+CGCONTRDP: (\d+),/);
                return cid && cid[1] === profileID;
              });

              if (!matchingLine) return "-";

              // Step 3: Extract secondary DNS (last field) without formatting
              const parts = matchingLine.split(",");
              if (parts.length < 1) return "-";

              // Return the raw DNS address without formatting
              return parts[parts.length - 1].replace(/"/g, "").trim() || "-";
            } catch (error) {
              console.error("Error extracting raw secondary DNS:", error);
              return "-";
            }
          })(),
        },
        timeAdvance: {
          lteTimeAdvance: parseField(rawData[21]?.response, 1, 1, 2),
          nrTimeAdvance: parseField(rawData[22]?.response, 1, 1, 2),
        },
      };

      setData(processedData);
      setRetryCount(0);
      setError(null);
      console.log("Processed home data:", processedData);
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
        if (isMounted) {
          setIsLoading(false);
        }
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
  delimiter = ","
) => {
  try {
    return (
      response.split("\n")[lineIndex]?.split(":")[firstField]?.split(delimiter)[
        fieldIndex
      ]?.replace(/"/g, "")
        .trim() || defaultValue
    );
  } catch {
    return defaultValue;
  }
};
const getProviderName = (response: string) => parseField(response, 1, 1, 2);
const getAccessTechnology = (response: string) => parseField(response, 1, 1, 3);


const getOperatorState = (lteResponse: string, nr5gResponse: string) => {
  const state =
    Number(parseField(lteResponse,1,1,1)) || Number(parseField(nr5gResponse,1,1,1))
  switch (state) {
    case 1:
      return "Registered";
    case 2:
      return "Searching";
    case 3:
      return "Denied";
    case 4:
      return "Unknown";
    case 5:
      return "Roaming";
    default:
      return "Not Registered";
  }
};

const getNetworkType = (response: string) => {
  const bands = response.match(/"LTE BAND \d+"|"NR5G BAND \d+"/g);
  const hasLTE = bands?.some((band) => band.includes("LTE"));
  const hasNR5G = bands?.some((band) => band.includes("NR5G"));
  if (hasLTE && hasNR5G) return "NR5G-NSA";
  if (hasLTE) return "LTE";
  if (hasNR5G) return "NR5G-SA";
  return "No Signal";
};

const getModemTemperature = (response: string) => {
  const temps = ["cpuss-0", "cpuss-1", "cpuss-2", "cpuss-3"].map((cpu) => {
    const line = response.split("\n").find((l) => l.includes(cpu));
    return parseInt(
      line!?.split(":")[1]?.split(",")[1].replace(/"/g, "").trim()
    );
  });
  const avgTemp = temps.reduce((acc, t) => acc + t, 0) / temps.length;
  return `${Math.round(avgTemp)}°C`;
};

const getBandwidth = (response: string, networkType: string) => {
  // Get PCC bandwidth line
  let pccBandwidth = response.split("\n").find((l) => l.includes("PCC"));
  pccBandwidth = pccBandwidth?.split(":")[1]?.split(",")[2].trim();

  // Get LTE SCC bandwidth lines and append it to an array
  let sccBandwidthLTE = response
    .split("\n")
    .filter((l) => l.includes("SCC") && l.includes("LTE"));
  sccBandwidthLTE = sccBandwidthLTE.map((l) =>
    l?.split(":")[1]?.split(",")[2].trim()
  );

  // Get NR5G SCC bandwidth lines and append it to an array
  let sccBandwidthNR5G = response
    .split("\n")
    .filter((l) => l.includes("SCC") && l.includes("NR5G"));
  sccBandwidthNR5G = sccBandwidthNR5G.map((l) =>
    l?.split(":")[1]?.split(",")[2].trim()
  );

  // Return as a string in the format "PCC, SCC1, SCC2, ..."
  if (networkType === "LTE") {
    // If there is only PCC
    if (!sccBandwidthLTE.length && pccBandwidth) {
      return BANDWIDTH_MAP[pccBandwidth] || "Unknown";
    }

    // If there are both PCC and SCC
    // Map the bandwidths to their respective values and join them with a comma
    const parsedPCC = pccBandwidth ? BANDWIDTH_MAP[pccBandwidth] : "";
    const parsedSCCs = sccBandwidthLTE.map((bw) => BANDWIDTH_MAP[bw]);

    // Combine the PCC and SCC bandwidths into a single string separated by commas
    return [parsedPCC, ...parsedSCCs].join(", ");
  }

  if (networkType === "NR5G-SA" && pccBandwidth) {
    // If there is only PCC
    if (!sccBandwidthNR5G.length) {
      return NR_BANDWIDTH_MAP[pccBandwidth] || "Unknown";
    }

    // If there are both PCC and SCC
    const parsedPCC = NR_BANDWIDTH_MAP[pccBandwidth];
    const parsedSCCs = sccBandwidthNR5G.map((bw) => NR_BANDWIDTH_MAP[bw]);

    // Combine the PCC and SCC bandwidths into a single string separated by commas
    return [parsedPCC, ...parsedSCCs].join(", ");
  }

  if (networkType === "NR5G-NSA" && pccBandwidth) {
    // If there is only PCC
    if (!sccBandwidthLTE.length && !sccBandwidthNR5G.length) {
      return BANDWIDTH_MAP[pccBandwidth] || "Unknown";
    }

    // If there are only PCC and LTE SCC
    if (sccBandwidthLTE.length && !sccBandwidthNR5G.length) {
      const parsedPCC = BANDWIDTH_MAP[pccBandwidth];
      const parsedSCCs = sccBandwidthLTE.map((bw) => BANDWIDTH_MAP[bw]);

      // Combine the PCC and SCC bandwidths into a single string separated by commas
      return [parsedPCC, ...parsedSCCs].join(", ");
    }

    // If there are LTE PCC, LTE SCC, and NR5G SCC
    const parsedPCC = BANDWIDTH_MAP[pccBandwidth];
    const parsedSCCsLTE = sccBandwidthLTE.map((bw) => BANDWIDTH_MAP[bw]);
    const parsedSCCsNR5G = sccBandwidthNR5G.map((bw) => NR_BANDWIDTH_MAP[bw]);

    // Combine the PCC and SCC bandwidths into a single string separated by commas
    return [parsedPCC, ...parsedSCCsLTE, ...parsedSCCsNR5G].join(", ");
  }

  return "Unknown";
};

const getConnectedBands = (response: string) => {
  const bands = response.match(/"LTE BAND \d+"|"NR5G BAND \d+"/g);
  return (
    bands
      ?.map((band) => {
        if (band.includes("LTE")) return `B${band.match(/\d+/)}`;
        if (band.includes("NR5G"))
          return `N${band?.split(" ")[2].replace(/"/g, "").trim()}`;
      })
      .join(", ") || "Unknown"
  );
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
  if (ltePercentage !== null && nrPercentage !== null) {
    return `${Math.round((ltePercentage + nrPercentage) / 2)}%`;
  }
  if (ltePercentage !== null) {
    return `${Math.round(ltePercentage)}%`;
  }
  if (nrPercentage !== null) {
    return `${Math.round(nrPercentage)}%`;
  }
  return "Unknown%";
};

// Function to parse the TAC and CellID from the response and return the values from Hex to Decimal format based on the lineIndex and fieldIndex of the respective Index Maps
const extractValueByNetworkType = (response: string, networkType: string, lineIndexMap: Record<string, number>, fieldIndexMap: Record<string, number>): string => {
  const lineIndex = lineIndexMap[networkType];
  const fieldIndex = fieldIndexMap[networkType];
  return lineIndex !== undefined && fieldIndex !== undefined
    ? parseInt(parseField(response, lineIndex, 1, fieldIndex), 16).toString().toUpperCase()
    : "Unknown";
};

const getPhysicalCellIDs = (response: string, networkType: string): string => {
  const parsePCI = (lines: string[], fieldIndex: number) =>
    lines.map((line) => line.split(":")[1]?.split(",")[fieldIndex]?.trim() || "Unknown");

  const pccPCI = response.split("\n").find((line) => line.includes("PCC"))?.split(":")[1]?.split(",")[networkType === "NR5G-SA" ? 4 : 5]?.trim() || "Unknown";

  const sccPCIs = networkType === "NR5G-SA"
    ? parsePCI(response.split("\n").filter((line) => line.includes("SCC") && line.includes("NR5G")), 5)
    : [
        ...parsePCI(response.split("\n").filter((line) => line.includes("SCC") && line.includes("LTE")), 5),
        ...parsePCI(response.split("\n").filter((line) => line.includes("SCC") && line.includes("NR5G")), 4),
      ];

  return sccPCIs.length ? [pccPCI, ...sccPCIs].join(", ") : pccPCI;
};

const getEARFCN = (response: string) => {
  // Get the PCC EARFCN first
  let pccEARFCN = response.split("\n").find((l) => l.includes("PCC"));
  pccEARFCN = pccEARFCN?.split(":")[1]?.split(",")[1].trim();

  // Map the SCC EARFCN lines
  let sccEARFCNsLTE = response
    .split("\n")
    .filter((l) => l.includes("SCC") && l.includes("LTE"));
  sccEARFCNsLTE = sccEARFCNsLTE.map((l) =>
    l?.split(":")[1]?.split(",")[1].trim()
  );

  let sccEARFCNsNR5G = response
    .split("\n")
    .filter((l) => l.includes("SCC") && l.includes("NR5G"));
  sccEARFCNsNR5G = sccEARFCNsNR5G.map((l) =>
    l?.split(":")[1]?.split(",")[1].trim()
  );

  // Combine the EARFCNs into a single string separated by commas
  // If only PCC EARFCN is present
  if (pccEARFCN && !sccEARFCNsLTE.length && !sccEARFCNsNR5G.length) {
    return pccEARFCN;
  }

  // If only LTE PCC and SCC EARFCNs are present
  if (pccEARFCN && sccEARFCNsLTE.length && !sccEARFCNsNR5G.length) {
    return [pccEARFCN, ...sccEARFCNsLTE].join(", ");
  }

  // If only NR5G PCC and SCC EARFCNs are present
  if (pccEARFCN && !sccEARFCNsLTE.length && sccEARFCNsNR5G.length) {
    return [pccEARFCN, ...sccEARFCNsNR5G].join(", ");
  }

  // If both LTE and NR5G EARFCNs are present
  if (pccEARFCN && sccEARFCNsLTE.length && sccEARFCNsNR5G.length) {
    return [pccEARFCN, ...sccEARFCNsLTE, ...sccEARFCNsNR5G].join(", ");
  }

  return "Unknown";
};

const getMCC = (response: string, networkType: string) => {
  if (networkType === "LTE" || networkType === "NR5G-SA") {
    return response.split("\n")[1]?.split(":")[1]?.split(",")[4].trim();
  }

  if (networkType === "NR5G-NSA") {
    return response.split("\n")[2]?.split(":")[1]?.split(",")[2].trim();
  }

  return "Unknown";
};

const getMNC = (response: string, networkType: string) => {
  if (networkType === "LTE" || networkType === "NR5G-SA") {
    return response.split("\n")[1]?.split(":")[1]?.split(",")[5].trim();
  }

  if (networkType === "NR5G-NSA") {
    return response.split("\n")[2]?.split(":")[1]?.split(",")[3].trim();
  }
};

const getSignalQuality = (response: string) => {
  // Split the response into lines
  const lines = response.split("\n");

  // Find RSRP lines for LTE and NR5G
  const sinrLTE = lines.find((l) => l.includes("LTE"));
  const sinrNR5G = lines.find((l) => l.includes("NR5G"));

  // Parsing function to extract and clean numeric values
  const parseSignalValues = (line?: string): number[] => {
    if (!line) return [];

    return line
      ?.split(":")[1]
      ?.split(",")
      .slice(0, 4)
      .map((v) => parseInt(v.trim()))
      .filter((v) => v !== -140 && v !== -32768);
  };

  // Calculation function for percentage
  const calculatePercentage = (values: number[]): number => {
    if (!values.length) return 0;

    const avg = values.reduce((acc, v) => acc + v, 0) / values.length;

    // Adjust calculation: -10 to 30 range
    const percentage = Math.max(
      0,
      Math.min(100, ((avg - -10) / (30 - -10)) * 100)
    );

    return percentage;
  };

  // Parse signal values
  const sinrLteArr = parseSignalValues(sinrLTE);
  const sinrNrArr = parseSignalValues(sinrNR5G);

  // Calculate percentages
  const ltePercentage = calculatePercentage(sinrLteArr);
  const nrPercentage = calculatePercentage(sinrNrArr);

  // Determine final percentage
  if (sinrLteArr.length && sinrNrArr.length) {
    // If both LTE and NR5G are present, take the average
    return `${Math.round((ltePercentage + nrPercentage) / 2)}%`;
  } else if (sinrLteArr.length) {
    // If only LTE is present
    return `${Math.round(ltePercentage)}%`;
  } else if (sinrNrArr.length) {
    // If only NR5G is present
    return `${Math.round(nrPercentage)}%`;
  } else {
    // If no valid signal data
    return "Unknown%";
  }
};

// Get current band information
const getCurrentBandsBandNumber = (response: string) => {
  // Loop through the response and extract the band number
  const bandsLte = response.split("\n").filter((l) => l.includes("LTE BAND"));
  const bandsNr5g = response.split("\n").filter((l) => l.includes("NR5G BAND"));

  if (bandsLte.length && bandsNr5g.length) {
    return [...bandsLte, ...bandsNr5g].map((l) =>
      l?.split(":")[1]?.split(",")[3].replace(/"/g, "")
    );
  } else if (bandsLte.length) {
    return bandsLte.map((l) =>
      l?.split(":")[1]?.split(",")[3].replace(/"/g, "")
    );
  } else if (bandsNr5g.length) {
    return bandsNr5g.map((l) =>
      l?.split(":")[1]?.split(",")[3].replace(/"/g, "")
    );
  } else {
    return ["Unknown"];
  }
};

const getCurrentBandsEARFCN = (response: string) => {
  // Loop through the response and extract the EARFCN
  const earfcnsLte = response.split("\n").filter((l) => l.includes("LTE BAND"));
  const earfcnsNr5g = response
    .split("\n")
    .filter((l) => l.includes("NR5G BAND"));

  if (earfcnsLte.length && earfcnsNr5g.length) {
    return [...earfcnsLte, ...earfcnsNr5g].map(
      (l) => l?.split(":")[1]?.split(",")[1]
    );
  } else if (earfcnsLte.length) {
    return earfcnsLte.map((l) => l?.split(":")[1]?.split(",")[1]);
  } else if (earfcnsNr5g.length) {
    return earfcnsNr5g.map((l) => l?.split(":")[1]?.split(",")[1]);
  } else {
    return ["Unknown"];
  }
};

const getCurrentBandsBandwidth = (response: string) => {
  // Loop through the response and extract the bandwidth
  const bandwidthsLte = response
    .split("\n")
    .filter((l) => l.includes("LTE BAND"));
  const bandwidthsNr5g = response
    .split("\n")
    .filter((l) => l.includes("NR5G BAND"));

  // Convert the bandwidths to their respective values
  const parsedBandwidthsLte = bandwidthsLte.map(
    (l) => BANDWIDTH_MAP[l?.split(":")[1]?.split(",")[2]]
  );
  const parsedBandwidthsNr5g = bandwidthsNr5g.map(
    (l) => NR_BANDWIDTH_MAP[l?.split(":")[1]?.split(",")[2]]
  );

  if (parsedBandwidthsLte.length && parsedBandwidthsNr5g.length) {
    return [...parsedBandwidthsLte, ...parsedBandwidthsNr5g];
  } else if (parsedBandwidthsLte.length) {
    return parsedBandwidthsLte;
  } else if (parsedBandwidthsNr5g.length) {
    return parsedBandwidthsNr5g;
  } else {
    return ["Unknown"];
  }
};

const getCurrentBandsPCI = (response: string, networkType: string) => {
  if (networkType === "NR5G-SA") {
    const lines = response.split("\n");
    const result = [];

    // Handle PCC - keep your existing code since it works
    const pccLine = lines.find((l) => l.includes("PCC"));
    if (pccLine) {
      const pccPCI = pccLine.split(":")[1].split(",")[4].trim();
      result.push(pccPCI || "Unknown");
    }

    // Handle SCCs - fix the index for NR5G-SA mode
    const sccLines = lines.filter((l) => l.includes("SCC"));
    for (const sccLine of sccLines) {
      const parts = sccLine.split(":")[1].split(",");
      // For NR5G-SA mode, SCC PCI is at index 5, not 4
      result.push(parts.length > 5 ? parts[5].trim() : "Unknown");
    }

    return result.length > 0 ? result : ["Unknown"];
  }

  // Keep your existing code for LTE and NR5G-NSA
  else if (networkType === "LTE") {
    let PCCpci = response.split("\n").find((l) => l.includes("PCC"));
    PCCpci = PCCpci ? PCCpci?.split(":")[1]?.split(",")[5].trim() : "Unknown";
    const SCCpcis = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("LTE BAND"));
    if (!SCCpcis.length) {
      return [PCCpci];
    } else {
      const pcis = SCCpcis.map(
        (l) => l?.split(":")[1]?.split(",")[5] || "Unknown"
      );
      return [PCCpci, ...pcis];
    }
  } else if (networkType === "NR5G-NSA") {
    const pcisLte = response.split("\n").filter((l) => l.includes("LTE BAND"));
    const pcisNr5g = response
      .split("\n")
      .filter((l) => l.includes("NR5G BAND"));
    const pcisLteValues = pcisLte.map(
      (l) => l?.split(":")[1]?.split(",")[5] || "Unknown"
    );
    const pcisNr5gValues = pcisNr5g.map(
      (l) => l?.split(":")[1]?.split(",")[4] || "Unknown"
    );
    return [...pcisLteValues, ...pcisNr5gValues];
  }

  return ["Unknown"];
};

const getCurrentBandsRSRP = (
  response: string,
  networkType: string,
  servingCell: string
): string[] => {
  const extractRSRP = (lines: string[], index: number): string[] =>
    lines.map((line) => {
      const parts = line.split(":")[1]?.split(",");
      const rsrpValue = parts?.[index]?.trim();
      return rsrpValue?.match(/-?\d+/)?.[0] || "Unknown";
    });

  if (networkType === "LTE") {
    return extractRSRP(response.split("\n").filter((l) => l.includes("LTE BAND")), 6);
  }

  if (networkType === "NR5G-SA") {
    const pccRSRP = servingCell
      .split("\n")
      .find((l) => l.includes("NR5G-SA"))
      ?.split(":")[1]
      ?.split(",")[12]
      ?.trim() || "Unknown";

    const sccRSRPs = extractRSRP(
      response.split("\n").filter((l) => l.includes("SCC") && l.includes("NR5G BAND")), 9);

    return [pccRSRP, ...sccRSRPs];
  }

  if (networkType === "NR5G-NSA") {
    const lteRSRPs = extractRSRP(response.split("\n").filter((l) => l.includes("LTE BAND")), 6);
    const nr5gServingRSRP = servingCell
      .split("\n")
      .find((l) => l.includes("NR5G-NSA"))
      ?.split(",")[4]
      ?.trim() || "Unknown";

    const nr5gSccRSRPs = extractRSRP(
      response.split("\n").filter((l) => l.includes("SCC") && l.includes("NR5G BAND")), 9);
    return [...lteRSRPs, nr5gServingRSRP, ...nr5gSccRSRPs].filter((rsrp) => rsrp !== "Unknown");
  }

  return ["Unknown"];
};

const getCurrentBandsRSRQ = (
  response: string,
  networkType: string,
  servingCell: string
): string[] => {
  const extractRSRQ = (lines: string[], index: number): string[] =>
    lines.map((line) => {
      const parts = line.split(":")[1]?.split(",");
      const rsrqValue = parts?.[index]?.trim();
      return rsrqValue?.match(/-?\d+/)?.[0] || "Unknown";
    });

  if (networkType === "LTE") {
    return extractRSRQ(response.split("\n").filter((l) => l.includes("LTE BAND")), 7);
  }

  if (networkType === "NR5G-SA") {
    const pccRSRQ = servingCell
      .split("\n")
      .find((l) => l.includes("NR5G-SA"))
      ?.split(":")[1]
      ?.split(",")[13]
      ?.trim() || "Unknown";

    const sccRSRQs = extractRSRQ(
      response.split("\n").filter((l) => l.includes("SCC") && l.includes("NR5G BAND")),
      10
    );

    return [pccRSRQ, ...sccRSRQs];
  }

  if (networkType === "NR5G-NSA") {
    const lteRSRQs = extractRSRQ(response.split("\n").filter((l) => l.includes("LTE BAND")), 7);

    const nr5gServingRSRQ = servingCell
      .split("\n")
      .find((l) => l.includes("NR5G-NSA"))
      ?.split(",")[6]
      ?.trim() || "Unknown";

    const nr5gSccRSRQs = extractRSRQ(
      response.split("\n").filter((l) => l.includes("SCC") && l.includes("NR5G BAND")),
      10
    );

    return [...lteRSRQs, nr5gServingRSRQ, ...nr5gSccRSRQs].filter((rsrq) => rsrq !== "Unknown");
  }

  return ["Unknown"];
};

const getCurrentBandsSINR = (
  response: string,
  networkType: string,
  servingCell: string
): string[] => {
  const extractSINR = (lines: string[], index: number): string[] =>
    lines.map((line) => {
      const parts = line.split(":")[1]?.split(",");
      const rawSINR = parts?.[index]?.trim();
      if (rawSINR === "-32768") return "-";
      const sinrValue = parseInt(rawSINR || "Unknown");
      return !isNaN(sinrValue) ? Math.round(sinrValue / 100).toString() : rawSINR || "Unknown";
    });

  if (networkType === "LTE") {
    return extractSINR(response.split("\n").filter((l) => l.includes("BAND")), 9);
  }

  if (networkType === "NR5G-SA") {
    const pccSINR = servingCell
      .split("\n")
      .find((l) => l.includes("NR5G-SA"))
      ?.split(":")[1]
      ?.split(",")[14]
      ?.trim();

      const pccValue = (() => {
        if (pccSINR === "-32768") return "-";
        const parsedSINR = parseInt(pccSINR || "Unknown");
        return !isNaN(parsedSINR) ? parsedSINR.toString() : pccSINR || "Unknown";
      })();

    const sccSINRs = extractSINR(
      response.split("\n").filter((l) => l.includes("SCC") && l.includes("NR5G BAND")),
      11
    );

    return [pccValue, ...sccSINRs];
  }

  if (networkType === "NR5G-NSA") {
    const lteSINRs = extractSINR(response.split("\n").filter((l) => l.includes("LTE BAND")), 9);
    const nr5gServingSINR = servingCell
      .split("\n")
      .find((l) => l.includes("NR5G-NSA"))
      ?.split(",")[5]
      ?.trim() || "Unknown";

    const nr5gSccSINRs = extractSINR(
      response.split("\n").filter((l) => l.includes("SCC") && l.includes("NR5G BAND")), 11);

    return [...lteSINRs, nr5gServingSINR, ...nr5gSccSINRs].filter((sinr) => sinr !== "Unknown");
  }

  return ["Unknown"];
};

const getMimoLayers = (response: string): string => {
  const INVALID_VALUES = [-32768, -140];

  // Helper function to extract and filter RSRP values
  const extractRSRP = (line?: string): number[] =>
    line
      ?.split(":")[1]
      ?.split(",")
      .slice(0, 4)
      .map((v) => parseInt(v.trim()))
      .filter((v) => !INVALID_VALUES.includes(v)) || [];

  // Extract RSRP values for LTE and NR5G
  const lteRSRPCount = extractRSRP(response.split("\n").find((l) => l.includes("LTE"))).length;
  const nr5gRSRPCount = extractRSRP(response.split("\n").find((l) => l.includes("NR5G"))).length;

  // Determine MIMO layers
  if (lteRSRPCount && nr5gRSRPCount) return `LTE ${lteRSRPCount} / NR ${nr5gRSRPCount}`;
  if (lteRSRPCount) return `LTE ${lteRSRPCount}`;
  if (nr5gRSRPCount) return `NR ${nr5gRSRPCount}`;
  return "Unknown";
};

// Add this helper function in your file (outside the React component)
const formatDottedIPv6 = (dottedIPv6: string): string => {
  try {
    const parts = dottedIPv6.split(".");
    if (parts.length < 8) return dottedIPv6; // Return as-is if not a valid dotted IPv6

    // Convert each decimal to 2-digit hex
    const hexParts = parts.map((part) => parseInt(part, 10).toString(16).padStart(2, "0"));

    // Group into 8 blocks of 2 bytes each
    const ipv6Blocks = Array.from({ length: 8 }, (_, i) =>
      hexParts[i * 2] + (hexParts[i * 2 + 1] || "00")
    );

    // Remove leading zeros from each block
    const cleanedBlocks = ipv6Blocks.map((block) => block.replace(/^0+/, "") || "0");

    // Find the longest run of consecutive zeros for compression
    const zeroRun = cleanedBlocks.reduce(
      (acc, block, i) => {
        if (block === "0") {
          acc.current.push(i);
          if (acc.current.length > acc.longest.length) acc.longest = [...acc.current];
        } else {
          acc.current = [];
        }
        return acc;
      },
      { current: [] as number[], longest: [] as number[] }
    ).longest;

    // Apply zero compression if applicable
    if (zeroRun.length >= 2) {
      return cleanedBlocks
        .map((block, i) => (i === zeroRun[0] ? "" : zeroRun.includes(i) ? null : block))
        .filter((block) => block !== null)
        .join(":")
        .replace(/::+/g, "::");
    }

    return cleanedBlocks.join(":"); // Return without compression if no zero run
  } catch (err) {
    console.error("Error formatting IPv6:", err);
    return dottedIPv6;
  }
};

export default useHomeData;
