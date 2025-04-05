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
          slot:
            rawData[0].response.split("\n")[1]?.split(":")[1].trim() ||
            "Unknown",
          state: rawData[6].response.match("READY")
            ? "Inserted"
            : "Not Inserted",
          provider: getProviderName(rawData[2].response) || "Unknown",
          phoneNumber:
            rawData[1].response
              .split("\n")[1]
              ?.split(":")[1]
              ?.split(",")[1]
              .replace(/"/g, "")
              .trim() || "Unknown",
          imsi: rawData[3].response.split("\n")[1].trim() || "Unknown",
          iccid:
            rawData[4].response.split("\n")[1]?.split(":")[1].trim() ||
            "Unknown",
          imei: rawData[5].response.split("\n")[1].trim() || "Unknown",
        },
        connection: {
          apn:
            rawData[7].response
              .split("\n")[1]
              ?.split(":")[1]
              ?.split(",")[2]
              .replace(/"/g, "")
              .trim() ||
            rawData[12].response
              .split("\n")[1]
              ?.split(":")[1]
              ?.split(",")[2]
              .replace(/"/g, "")
              .trim() ||
            "Unknown",
          operatorState:
            getOperatorState(rawData[8].response, rawData[16].response) ||
            "Unknown",
          functionalityState:
            rawData[9].response.split("\n")[1]?.split(":")[1].trim() === "1"
              ? "Enabled"
              : "Disabled",
          networkType: getNetworkType(rawData[13].response) || "No Signal",
          modemTemperature:
            getModemTemperature(rawData[11].response) || "Unknown",
          accessTechnology:
            getAccessTechnology(rawData[2].response) || "Unknown",
        },
        dataTransmission: {
          carrierAggregation:
            rawData[13].response.match(/"LTE BAND \d+"|"NR5G BAND \d+"/g)
              ?.length > 1
              ? "Multi"
              : "Inactive",
          bandwidth:
            getBandwidth(
              rawData[13].response,
              getNetworkType(rawData[13].response)
            ) || "Unknown",
          connectedBands: getConnectedBands(rawData[13].response) || "Unknown",
          signalStrength: getSignalStrength(rawData[14].response) || "Unknown",
          mimoLayers: getMimoLayers(rawData[14].response) || "Unknown",
        },
        cellularInfo: {
          cellId:
            getCellID(
              rawData[10].response,
              getNetworkType(rawData[13].response)
            ) || "Unknown",
          trackingAreaCode:
            getTAC(
              rawData[10].response,
              getNetworkType(rawData[13].response)
            ) || "Unknown",
          physicalCellId: getPhysicalCellIDs(
            rawData[13].response,
            getNetworkType(rawData[13].response)
          ),
          earfcn: getEARFCN(rawData[13].response),
          mcc:
            getMCC(
              rawData[10].response,
              getNetworkType(rawData[13].response)
            ) || "Unknown",
          mnc:
            getMNC(
              rawData[10].response,
              getNetworkType(rawData[13].response)
            ) || "Unknown",
          signalQuality: getSignalQuality(rawData[19].response) || "Unknown",
        },
        currentBands: {
          // id is length of bandNumber
          id: Array.from(
            {
              length:
                getCurrentBandsBandNumber(rawData[13].response)?.length ?? 0,
            },
            (_, i) => i + 1
          ) || [1],
          bandNumber: getCurrentBandsBandNumber(rawData[13].response) || [
            "Unknown",
          ],
          earfcn: getCurrentBandsEARFCN(rawData[13].response),
          bandwidth: getCurrentBandsBandwidth(rawData[13].response) || [
            "Unknown",
          ],
          pci: getCurrentBandsPCI(
            rawData[13].response,
            getNetworkType(rawData[13].response)
          ) || ["Unknown"],
          rsrp: getCurrentBandsRSRP(
            rawData[13].response,
            getNetworkType(rawData[13].response),
            rawData[10].response
          ),
          rsrq: getCurrentBandsRSRQ(
            rawData[13].response,
            getNetworkType(rawData[13].response),
            rawData[10].response
          ) || ["Unknown"],
          sinr: getCurrentBandsSINR(
            rawData[13].response,
            getNetworkType(rawData[13].response),
            rawData[10].response
          ) || ["Unknown"],
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
          // Raw DNS addresses without formatting
          rawCarrierPrimaryDNS: (() => {
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
          lteTimeAdvance:
            rawData[21].response
              .split("\n")[1]
              ?.split(":")[1]
              ?.split(",")[2]
              .trim() || "Unknown",

          nrTimeAdvance:
            rawData[22].response
              .split("\n")[1]
              ?.split(":")[1]
              ?.split(",")[2]
              .trim() || "Unknown",
        },
      };

      setData(processedData);
      setRetryCount(0);
      setData(processedData);
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
const getProviderName = (response: string) => {
  //             rawData[2].response
  // ?.split("\n")[1]
  // ?.split(":")[1]
  // ?.split(",")[2]
  // .replace(/"/g, "")
  // .trim() || "Unknown",
  try {
    return (
      response
        ?.split("\n")[1]
        ?.split(":")[1]
        ?.split(",")[2]
        .replace(/"/g, "")
        .trim() || "Unknown"
    );
  } catch (error) {
    return "-";
  }
};

const getAccessTechnology = (response: string) => {
  try {
    return (
      response?.split("\n")[1]?.split(":")[1]?.split(",")[3].trim() || "Unknown"
    );
  } catch (error) {
    return "-";
  }
};

const getOperatorState = (lteResponse: string, nr5gResponse: string) => {
  const state =
    Number(lteResponse.split("\n")[1]?.split(":")[1]?.split(",")[1].trim()) ||
    Number(nr5gResponse.split("\n")[1]?.split(":")[1]?.split(",")[1].trim());
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

const getSignalStrength = (response: string) => {
  // const RSRP LTE line
  let rsrpLTE = response.split("\n").find((l) => l.includes("LTE"));
  let rsrpNR5G = response.split("\n").find((l) => l.includes("NR5G"));
  let rsrpLteArr: any[] = [];
  let rsrpNrArr: any[] = [];

  // if RSRP LTE exists
  if (rsrpLTE) {
    rsrpLteArr = rsrpLTE
      ?.split(":")[1]
      ?.split(",")
      .slice(0, 4)
      .map((v) => parseInt(v.trim()));
  }

  // If RSRP NR5G exists
  if (rsrpNR5G) {
    rsrpNrArr = rsrpNR5G
      ?.split(":")[1]
      ?.split(",")
      .slice(0, 4)
      .map((v) => parseInt(v.trim()));
  }

  // Filter out -140 and -37625 from the arrays
  rsrpLteArr = rsrpLteArr.filter(
    (v) => v !== -140 && v !== -37625 && v !== -32768
  );
  rsrpNrArr = rsrpNrArr.filter(
    (v) => v !== -140 && v !== -37625 && v !== -32768
  );

  // Calculate the average RSRP values average percentage where -75 is best and -125 is worst
  if (rsrpLteArr.length) {
    if (rsrpNrArr.length) {
      const lteAvg =
        rsrpLteArr.reduce((acc, v) => acc + v, 0) / rsrpLteArr.length;
      const nrAvg = rsrpNrArr.reduce((acc, v) => acc + v, 0) / rsrpNrArr.length;
      const ltePercentage = Math.max(
        0,
        Math.min(100, ((lteAvg + 125) / 50) * 100)
      );
      const nrPercentage = Math.max(
        0,
        Math.min(100, ((nrAvg + 125) / 50) * 100)
      );

      // Get the final average percentage
      const finalAverage = (ltePercentage + nrPercentage) / 2;
      return `${Math.round(finalAverage)}%`;
    } else {
      const lteAvg =
        rsrpLteArr.reduce((acc, v) => acc + v, 0) / rsrpLteArr.length;
      const ltePercentage = Math.max(
        0,
        Math.min(100, ((lteAvg + 125) / 50) * 100)
      );
      return `${Math.round(ltePercentage)}%`;
    }
  } else if (rsrpNrArr.length) {
    const nrAvg = rsrpNrArr.reduce((acc, v) => acc + v, 0) / rsrpNrArr.length;
    const nrPercentage = Math.max(0, Math.min(100, ((nrAvg + 125) / 50) * 100));
    return `${Math.round(nrPercentage)}%`;
  } else {
    return "Unknown%";
  }
};

const getCellID = (response: string, networkType: string) => {
  if (networkType === "NR5G-SA" || networkType === "LTE") {
    return response.split("\n")[1]?.split(":")[1]?.split(",")[6].trim();
  }

  if (networkType === "NR5G-NSA") {
    return response.split("\n")[2]?.split(":")[1]?.split(",")[4].trim();
  }

  return "Unknown";
};

const getTAC = (response: string, networkType: string) => {
  if (networkType === "NR5G-SA") {
    return response.split("\n")[1]?.split(":")[1]?.split(",")[8].trim();
  }

  if (networkType === "NR5G-NSA") {
    return response.split("\n")[2]?.split(":")[1]?.split(",")[10].trim();
  }

  if (networkType === "LTE") {
    return response.split("\n")[1]?.split(":")[1]?.split(",")[12].trim();
  }

  return "Unknown";
};

const getPhysicalCellIDs = (response: string, networkType: string) => {
  // Get the physical cell IDs for LTE
  if (networkType === "LTE" || networkType === "NR5G-NSA") {
    // Get the PCC PCI first
    let pccPCI = response.split("\n").find((l) => l.includes("PCC"));
    pccPCI = pccPCI?.split(":")[1]?.split(",")[5].trim();

    // Map the SCC PCIs lines
    let sccPCIsLTE = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("LTE"));
    sccPCIsLTE = sccPCIsLTE.map((l) => l?.split(":")[1]?.split(",")[5].trim());

    // Map the SCC PCIs lines for NR5G
    let sccPCIsNR5G = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("NR5G"));
    sccPCIsNR5G = sccPCIsNR5G.map((l) =>
      l?.split(":")[1]?.split(",")[4].trim()
    );

    // Combine the PCIs into a single string separated by commas
    // If only PCC PCI is present
    if (!sccPCIsLTE.length && !sccPCIsNR5G.length) {
      return pccPCI;
    }

    // If only LTE PCC and SCC PCIs are present
    if (networkType === "LTE") {
      return [pccPCI, ...sccPCIsLTE].join(", ");
    }

    // If both LTE and NR5G PCIs are present
    return [pccPCI, ...sccPCIsLTE, ...sccPCIsNR5G].join(", ");
  }

  // Get the physical cell IDs for NR5G
  if (networkType === "NR5G-SA") {
    // Get the PCC PCI first
    let pccPCI = response.split("\n").find((l) => l.includes("PCC"));
    pccPCI = pccPCI?.split(":")[1]?.split(",")[4].trim();

    // Map the SCC PCIs lines
    let sccPCIs = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("NR5G"));
    sccPCIs = sccPCIs.map((l) => l?.split(":")[1]?.split(",")[5].trim());

    // If only PCC PCI is present
    if (!sccPCIs.length) {
      return pccPCI;
    }

    // Combine the PCIs into a single string separated by commas
    return [pccPCI, ...sccPCIs].join(", ");
  }
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
) => {
  // Loop through the response and extract the RSRP
  if (networkType === "LTE") {
    const rsrps = response.split("\n").filter((l) => l.includes("LTE BAND"));
    return rsrps.map((l) => l?.split(":")[1]?.split(",")[6]);
  }

  if (networkType === "NR5G-SA") {
    // Existing NR5G-SA handling - no changes needed
    const pccRSRP = servingCell.split("\n").find((l) => l.includes("NR5G-SA"));
    const pccValue = pccRSRP
      ? pccRSRP?.split(":")[1]?.split(",")[9]
      : "Unknown";

    // Get all SCC RSRP values
    const sccLines = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("NR5G BAND"));

    // Process each SCC line to extract RSRP at index 9
    const sccValues = sccLines.map((line) => {
      const parts = line.split(":")[1].split(",");
      if (parts.length > 9) {
        const rsrpValue = parts[9];
        // Extract just the numeric value with negative sign if present
        const match = rsrpValue.match(/-?\d+/);
        return match ? match[0] : "Unknown";
      }
      return "Unknown";
    });

    // Return PCC and all SCC values in a single array
    return [pccValue, ...sccValues];
  }

  // Process NR5G-NSA bands
  if (networkType === "NR5G-NSA") {
    // Map all LTE bands RSRP values
    const lteRSRP = response
      .split("\n")
      .filter((l) => l.includes("LTE BAND"))
      .map((l) => l?.split(":")[1]?.split(",")[6]);

    // Handle NR5G bands differently
    const nr5gLines = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("NR5G BAND"));

    let nr5gRSRP: string[] = [];

    if (nr5gLines.length > 0) {
      // For the first NR5G band, get RSRP from serving cell data
      const nr5gServingData = servingCell
        .split("\n")
        .find((l) => l.includes("NR5G-NSA"));

      if (nr5gServingData) {
        // RSRP is the 5th field (index 4) in the NR5G-NSA serving cell line
        const servingCellParts = nr5gServingData.split(",");
        if (servingCellParts.length > 4) {
          const rsrpValue = servingCellParts[4].trim();
          nr5gRSRP.push(rsrpValue);
        } else {
          nr5gRSRP.push("Unknown");
        }
      } else {
        nr5gRSRP.push("Unknown");
      }

      // For any additional NR5G bands (2nd onwards),
      // continue using QCAINFO data at index 9
      if (nr5gLines.length > 1) {
        const additionalBands = nr5gLines.slice(1).map((line) => {
          const parts = line.split(":")[1].split(",");
          if (parts.length > 9) {
            const rsrpValue = parts[9];
            // Extract just the numeric value with negative sign if present
            const match = rsrpValue.match(/-?\d+/);
            return match ? match[0] : "Unknown";
          }
          return "Unknown";
        });

        nr5gRSRP = [...nr5gRSRP, ...additionalBands];
      }
    }

    // Combine results
    if (lteRSRP.length && nr5gRSRP.length) {
      return [...lteRSRP, ...nr5gRSRP];
    } else if (lteRSRP.length) {
      return lteRSRP;
    } else if (nr5gRSRP.length) {
      return nr5gRSRP;
    }
  }

  return ["Unknown"];
};

const getCurrentBandsRSRQ = (
  response: string,
  networkType: string,
  servingCell: string
) => {
  // Loop through the response and extract the RSRQ
  if (networkType === "LTE") {
    const rsrqs = response.split("\n").filter((l) => l.includes("BAND"));
    return rsrqs.map((l) => l?.split(":")[1]?.split(",")[7]);
  }

  if (networkType === "NR5G-SA") {
    // Existing NR5G-SA handling - no changes needed
    const pccRSRQ = servingCell.split("\n").find((l) => l.includes("NR5G-SA"));
    const pccValue = pccRSRQ
      ? pccRSRQ?.split(":")[1]?.split(",")[10]
      : "Unknown";

    // Get all SCC RSRQ values
    const sccLines = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("NR5G BAND"));

    // Process each SCC line to extract RSRQ at index 10
    const sccValues = sccLines.map((line) => {
      const parts = line.split(":")[1].split(",");
      if (parts.length > 10) {
        const rsrqValue = parts[10];
        // Extract just the numeric value with negative sign if present
        const match = rsrqValue.match(/-?\d+/);
        return match ? match[0] : "Unknown";
      }
      return "Unknown";
    });

    // Return PCC and all SCC values in a single array
    return [pccValue, ...sccValues];
  }

  // Process NR5G-NSA bands
  if (networkType === "NR5G-NSA") {
    // Map all LTE bands RSRQ values
    const lteRSRQ = response
      .split("\n")
      .filter((l) => l.includes("LTE BAND"))
      .map((l) => l?.split(":")[1]?.split(",")[7]);

    // Handle NR5G bands differently
    const nr5gLines = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("NR5G BAND"));

    let nr5gRSRQ: string[] = [];

    if (nr5gLines.length > 0) {
      // For the first NR5G band, get RSRQ from serving cell data
      const nr5gServingData = servingCell
        .split("\n")
        .find((l) => l.includes("NR5G-NSA"));

      if (nr5gServingData) {
        // RSRQ is the 7th field (index 6) in the NR5G-NSA serving cell line
        const servingCellParts = nr5gServingData.split(",");
        if (servingCellParts.length > 6) {
          const rsrqValue = servingCellParts[6].trim();
          nr5gRSRQ.push(rsrqValue);
        } else {
          nr5gRSRQ.push("Unknown");
        }
      } else {
        nr5gRSRQ.push("Unknown");
      }

      // For any additional NR5G bands (2nd onwards),
      // continue using QCAINFO data at index 10
      if (nr5gLines.length > 1) {
        const additionalBands = nr5gLines.slice(1).map((line) => {
          const parts = line.split(":")[1].split(",");
          if (parts.length > 10) {
            const rsrqValue = parts[10];
            // Extract just the numeric value with negative sign if present
            const match = rsrqValue.match(/-?\d+/);
            return match ? match[0] : "Unknown";
          }
          return "Unknown";
        });

        nr5gRSRQ = [...nr5gRSRQ, ...additionalBands];
      }
    }

    // Combine results
    if (lteRSRQ.length && nr5gRSRQ.length) {
      return [...lteRSRQ, ...nr5gRSRQ];
    } else if (lteRSRQ.length) {
      return lteRSRQ;
    } else if (nr5gRSRQ.length) {
      return nr5gRSRQ;
    }
  }

  return ["Unknown"];
};

const getCurrentBandsSINR = (
  response: string,
  networkType: string,
  servingCell: string
) => {
  // Loop through the response and extract the SINR
  if (networkType === "LTE") {
    const sinrs = response.split("\n").filter((l) => l.includes("BAND"));
    return sinrs.map((l) => l?.split(":")[1]?.split(",")[9]);
  }

  if (networkType === "NR5G-SA") {
    // Get PCC SINR from serving cell
    const pccSINR = servingCell.split("\n").find((l) => l.includes("NR5G-SA"));
    let pccValue = "Unknown";

    if (pccSINR) {
      const rawSINR = pccSINR?.split(":")[1]?.split(",")[11];
      // If value is -32768, use "-" instead of "Unknown"
      if (rawSINR === "-32768") {
        pccValue = "-";
      } else {
        // Apply the SNR conversion formula: SNR = value / 100
        const sinrValue = parseInt(rawSINR);
        if (!isNaN(sinrValue)) {
          // Return a whole number only and round up when necessary
          pccValue = Math.round(sinrValue / 100).toString();
        } else {
          pccValue = rawSINR || "Unknown";
        }
      }
    }

    // Get all SCC SINR values
    const sccLines = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("NR5G BAND"));

    // Process each SCC line to extract SINR at index 11
    const sccValues = sccLines.map((line) => {
      const parts = line.split(":")[1].split(",");
      if (parts.length > 11) {
        const rawSINR = parts[11];

        // Check for special -32768 value
        if (rawSINR === "-32768") return "-";

        // Extract numeric value and apply conversion
        const match = rawSINR.match(/-?\d+/);
        if (match) {
          const sinrValue = parseInt(match[0]);
          if (!isNaN(sinrValue)) {
            return Math.round(sinrValue / 100).toString();
          }
          return match[0];
        }
      }
      return "Unknown";
    });

    // Return PCC and all SCC values in a single array
    return [pccValue, ...sccValues];
  }

  // Process NR5G-NSA bands
  if (networkType === "NR5G-NSA") {
    // Map all LTE bands SINR values
    const lteSINR = response
      .split("\n")
      .filter((l) => l.includes("LTE BAND"))
      .map((l) => l?.split(":")[1]?.split(",")[9]);

    // Handle NR5G bands differently
    const nr5gLines = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("NR5G BAND"));

    let nr5gSINR: string[] = [];

    if (nr5gLines.length > 0) {
      // For the first NR5G band, get SINR from serving cell data
      const nr5gServingData = servingCell
        .split("\n")
        .find((l) => l.includes("NR5G-NSA"));

      if (nr5gServingData) {
        // SINR is the 6th field (index 5) in the NR5G-NSA serving cell line
        const servingCellParts = nr5gServingData.split(",");
        if (servingCellParts.length > 5) {
          const sinrValue = servingCellParts[5].trim();
          nr5gSINR.push(sinrValue);
        } else {
          nr5gSINR.push("Unknown");
        }
      } else {
        nr5gSINR.push("Unknown");
      }

      // For any additional NR5G bands (2nd onwards),
      // continue using QCAINFO data at index 11
      if (nr5gLines.length > 1) {
        const additionalBands = nr5gLines.slice(1).map((line) => {
          const parts = line.split(":")[1].split(",");
          const rawSINR = parts.length > 11 ? parts[11] : "Unknown";

          // Apply the SNR conversion formula for NR: SNR = value / 100
          if (rawSINR !== "Unknown" && rawSINR !== "-") {
            if (rawSINR === "-32768") return "-";

            const sinrValue = parseInt(rawSINR);
            if (!isNaN(sinrValue)) {
              return Math.round(sinrValue / 100).toString();
            }
          }
          return rawSINR;
        });

        nr5gSINR = [...nr5gSINR, ...additionalBands];
      }
    }

    if (lteSINR.length && nr5gSINR.length) {
      return [...lteSINR, ...nr5gSINR];
    } else if (lteSINR.length) {
      return lteSINR;
    } else if (nr5gSINR.length) {
      return nr5gSINR;
    }
  }

  return ["Unknown"];
};

const getMimoLayers = (response: string) => {
  // Constants for invalid signal values
  const INVALID_VALUES = [-32768, -140];
  const lteRSRPExists = response.split("\n").find((l) => l.includes("LTE"));
  const nr5gRSRPExists = response.split("\n").find((l) => l.includes("NR5G"));

  // Get the RSRP values for LTE and NR5G
  let lteRSRPArr: any[] = [];
  let nr5gRSRPArr: any[] = [];

  // If RSRP LTE exists
  if (lteRSRPExists) {
    lteRSRPArr = lteRSRPExists
      ?.split(":")[1]
      ?.split(",")
      .slice(0, 4)
      .map((v) => parseInt(v.trim()));
  }

  // If RSRP NR5G exists
  if (nr5gRSRPExists) {
    nr5gRSRPArr = nr5gRSRPExists
      ?.split(":")[1]
      ?.split(",")
      .slice(0, 4)
      .map((v) => parseInt(v.trim()));
  }

  // Filter out invalid values
  lteRSRPArr = lteRSRPArr.filter((v) => !INVALID_VALUES.includes(v));
  nr5gRSRPArr = nr5gRSRPArr.filter((v) => !INVALID_VALUES.includes(v));

  // Get the length of the arrays and return as MIMO layers
  if (lteRSRPArr.length) {
    if (nr5gRSRPArr.length) {
      return `LTE ${lteRSRPArr.length.toString()} / NR ${nr5gRSRPArr.length.toString()}`;
    } else {
      return `LTE ${lteRSRPArr.length.toString()}`;
    }
  } else if (nr5gRSRPArr.length) {
    return `NR ${nr5gRSRPArr.length.toString()}`;
  } else {
    return "Unknown";
  }
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
