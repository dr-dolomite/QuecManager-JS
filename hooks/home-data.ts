// hooks/useHomeData.ts
import { useState, useEffect, useCallback } from "react";
import { HomeData } from "@/types/types";
import { BANDWIDTH_MAP, NR_BANDWIDTH_MAP } from "@/constants/home/index";

const useHomeData = () => {
  const [data, setData] = useState<HomeData | null>(null);
  const [refreshRate, setRefreshRate] = useState(60000);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRefreshRate = async () => {
    try {
      // const refreshRateResponse = await fetch("/api/config-fetch");
      const refreshRateResponse = await fetch("/cgi-bin/settings/fetch-config.sh");
      const refreshRateData = await refreshRateResponse.json();
      // Convert to number and ensure it's at least 1000ms
      const newRate = Math.max(1000, parseInt(refreshRateData.data_refresh_rate));
      setRefreshRate(newRate);
    } catch (error) {
      console.error("Error fetching refresh rate:", error);
    }
  };

  const fetchHomeData = useCallback(async () => {
    try {
      setIsLoading(true);
      // const response = await fetch("/api/home-stats");
      const response = await fetch("/cgi-bin/fetch_data.sh?set=1");
      const rawData = await response.json();
      console.log(rawData);

      await fetchRefreshRate();

      // Process the raw data into the HomeData format
      const processedData: HomeData = {
        simCard: {
          slot:
            rawData[0].response.split("\n")[1].split(":")[1].trim() ||
            "Unknown",
          state: rawData[6].response.match("READY")
            ? "Inserted"
            : "Not Inserted",
          provider:
            rawData[2].response
              .split("\n")[1]
              .split(":")[1]
              .split(",")[2]
              .replace(/"/g, "")
              .trim() || "Unknown",
          phoneNumber:
            rawData[1].response
              .split("\n")[1]
              .split(":")[1]
              .split(",")[1]
              .replace(/"/g, "")
              .trim() || "Unknown",
          imsi: rawData[3].response.split("\n")[1].trim() || "Unknown",
          iccid:
            rawData[4].response.split("\n")[1].split(":")[1].trim() ||
            "Unknown",
          imei: rawData[5].response.split("\n")[1].trim() || "Unknown",
        },
        connection: {
          apn:
            rawData[7].response
              .split("\n")[1]
              .split(":")[1]
              .split(",")[2]
              .replace(/"/g, "")
              .trim() ||
            rawData[12].response
              .split("\n")[1]
              .split(":")[1]
              .split(",")[2]
              .replace(/"/g, "")
              .trim() ||
            "Unknown",
          operatorState: getOperatorState(
            rawData[8].response,
            rawData[16].response
          ),
          functionalityState:
            rawData[9].response.split("\n")[1].split(":")[1].trim() === "1"
              ? "Enabled"
              : "Disabled",
          networkType: getNetworkType(rawData[13].response),
          modemTemperature: getModemTemperature(rawData[11].response),
          accessTechnology: rawData[2].response
            .split("\n")[1]
            .split(":")[1]
            .split(",")[3]
            .trim(),
        },
        dataTransmission: {
          carrierAggregation:
            rawData[13].response.match(/"LTE BAND \d+"|"NR5G BAND \d+"/g)
              ?.length > 1
              ? "Multi"
              : "Inactive",
          bandwidth: getBandwidth(
            rawData[13].response,
            getNetworkType(rawData[13].response)
          ),
          connectedBands: getConnectedBands(rawData[13].response),
          signalStrength: getSignalStrength(rawData[14].response),
          mimoLayers:
            rawData[14].response
              .split("\n")[1]
              .match(/\d+/g)
              ?.filter((v: string) => v !== "-32768")
              .length.toString() || "Inactive",
        },
        cellularInfo: {
          cellId: getCellID(
            rawData[10].response,
            getNetworkType(rawData[13].response)
          ),
          trackingAreaCode: getTAC(
            rawData[10].response,
            getNetworkType(rawData[13].response)
          ),
          physicalCellId: getPhysicalCellIDs(
            rawData[13].response,
            getNetworkType(rawData[13].response)
          ),
          earfcn: getEARFCN(rawData[13].response),
          mcc: getMCC(
            rawData[10].response,
            getNetworkType(rawData[13].response)
          ),
          mnc: getMNC(
            rawData[10].response,
            getNetworkType(rawData[13].response)
          ),
          signalQuality: getSignalQuality(rawData[19].response),
        },
        currentBands: {
          // id is length of bandNumber
          id: Array.from(
            {
              length:
                getCurrentBandsBandNumber(rawData[13].response)?.length ?? 0,
            },
            (_, i) => i + 1
          ),
          bandNumber: getCurrentBandsBandNumber(rawData[13].response),
          earfcn: getCurrentBandsEARFCN(rawData[13].response),
          bandwidth: getCurrentBandsBandwidth(rawData[13].response),
          pci: getCurrentBandsPCI(
            rawData[13].response,
            getNetworkType(rawData[13].response)
          ),
          rsrp: getCurrentBandsRSRP(
            rawData[13].response,
            getNetworkType(rawData[13].response),
            rawData[10].response
          ),
          rsrq: getCurrentBandsRSRQ(
            rawData[13].response,
            getNetworkType(rawData[13].response),
            rawData[10].response
          ),
          sinr: getCurrentBandsSINR(
            rawData[13].response,
            getNetworkType(rawData[13].response),
            rawData[10].response
          ),
        },
      };

      setData(processedData);
    } catch (error) {
      console.error("Error fetching home data:", error);
    } finally {
      // Add a delay to prevent flickering
      setTimeout(() => setIsLoading(false), 300);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchHomeData();

    // Set up interval with current refresh rate
    const intervalId = setInterval(fetchHomeData, refreshRate);

    // Clean up interval on unmount or when refresh rate changes
    return () => clearInterval(intervalId);
  }, [fetchHomeData, refreshRate]); // Add refreshRate to dependencies

  return { data, isLoading, refresh: fetchHomeData };
};

// Helper functions for data processing
const getOperatorState = (lteResponse: string, nr5gResponse: string) => {
  const state =
    lteResponse.split("\n")[1].split(":")[1].split(",")[1].trim() ||
    nr5gResponse.split("\n")[1].split(":")[1].split(",")[1].trim();
  switch (state) {
    case "1":
      return "Registered";
    case "2":
      return "Searching";
    case "3":
      return "Denied";
    case "4":
      return "Unknown";
    case "5":
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
    return parseInt(line!.split(":")[1].split(",")[1].replace(/"/g, "").trim());
  });
  const avgTemp = temps.reduce((acc, t) => acc + t, 0) / temps.length;
  return `${Math.round(avgTemp)}°C`;
};

const getBandwidth = (response: string, networkType: string) => {
  // Get PCC bandwidth line
  let pccBandwidth = response.split("\n").find((l) => l.includes("PCC"));
  pccBandwidth = pccBandwidth?.split(":")[1].split(",")[2].trim();

  // Get LTE SCC bandwidth lines and append it to an array
  let sccBandwidthLTE = response
    .split("\n")
    .filter((l) => l.includes("SCC") && l.includes("LTE"));
  sccBandwidthLTE = sccBandwidthLTE.map((l) =>
    l.split(":")[1].split(",")[2].trim()
  );

  // Get NR5G SCC bandwidth lines and append it to an array
  let sccBandwidthNR5G = response
    .split("\n")
    .filter((l) => l.includes("SCC") && l.includes("NR5G"));
  sccBandwidthNR5G = sccBandwidthNR5G.map((l) =>
    l.split(":")[1].split(",")[2].trim()
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
};

const getConnectedBands = (response: string) => {
  const bands = response.match(/"LTE BAND \d+"|"NR5G BAND \d+"/g);
  return (
    bands
      ?.map((band) => {
        if (band.includes("LTE")) return `B${band.match(/\d+/)}`;
        if (band.includes("NR5G"))
          return `N${band.split(" ")[2].replace(/"/g, "").trim()}`;
      })
      .join(", ") || "Unknown"
  );
};

const getSignalStrength = (response: string) => {
  // const RSRP LTE line
  let rsrpLTE = response.split("\n").find((l) => l.includes("LTE"));
  let rsrpNR5G = response.split("\n").find((l) => l.includes("NR5G"));

  // Get the RSRP negative numerical values from rsrpLTE except -32768
  if (rsrpLTE) {
    let rsrpValuesLTE = rsrpLTE
      .match(/\d+/g)
      ?.map((num) => parseInt(num))
      .filter((num) => num !== -32768);

    if (rsrpNR5G) {
      // Match all numerical values except for the 5 in NR5G and filter out -32768
      let rsrpValuesNR5G = rsrpNR5G
        .match(/\d+/g)
        ?.map((num) => parseInt(num))
        .filter((num) => num !== -32768);

      // Remove the last value of the array
      if (rsrpValuesNR5G && rsrpValuesNR5G.length > 1) {
        rsrpValuesNR5G.pop();

        // Combine the two arrays and calculate the average
        if (rsrpValuesLTE) {
          const rsrpValues = [...rsrpValuesLTE, ...rsrpValuesNR5G];
          const avgRsrp =
            rsrpValues.reduce((acc, v) => acc + v, 0) / rsrpValues.length;
          // calculate the percentage where -140 is the worst and -75 is the best
          const rsrpPercentage = ((-avgRsrp - -140) / (-75 - -140)) * 100;
          // Return the percentage as a string
          return `${Math.round(rsrpPercentage)}%`;
        }
      }
    }

    // Calculate the average RSRP value and get its percentage where -140 is the worst and -75 is the best
    if (rsrpValuesLTE) {
      const avgRsrp =
        rsrpValuesLTE.reduce((acc, v) => acc + v, 0) / rsrpValuesLTE.length;
      const rsrpPercentage = ((-avgRsrp - -140) / (-75 - -140)) * 100;
      return `${Math.round(rsrpPercentage)}%`;
    }
  } else if (rsrpNR5G && !rsrpLTE) {
    // Match all numerical values except for the 5 in NR5G and filter out -32768
    let rsrpValuesNR5G = rsrpNR5G
      .match(/\d+/g)
      ?.map((num) => parseInt(num))
      .filter((num) => num !== -32768);

    // Remove the last value of the array
    if (rsrpValuesNR5G && rsrpValuesNR5G.length > 1) {
      rsrpValuesNR5G.pop();

      // Calculate the average RSRP value and get its percentage where -140 is the worst and -75 is the best
      const avgRsrp =
        rsrpValuesNR5G.reduce((acc, v) => acc + v, 0) / rsrpValuesNR5G.length;
      const rsrpPercentage = ((-avgRsrp - -140) / (-75 - -140)) * 100;
      return `${Math.round(rsrpPercentage)}%`;
    }
  } else {
    return "Unknown%";
  }
};

const getCellID = (response: string, networkType: string) => {
  if (networkType === "NR5G-SA" || networkType === "LTE") {
    return response.split("\n")[1].split(":")[1].split(",")[6].trim();
  }

  if (networkType === "NR5G-NSA") {
    return response.split("\n")[2].split(":")[1].split(",")[4].trim();
  }

  return "Unknown";
};

const getTAC = (response: string, networkType: string) => {
  if (networkType === "NR5G-SA") {
    return response.split("\n")[1].split(":")[1].split(",")[8].trim();
  }

  if (networkType === "NR5G-NSA") {
    return response.split("\n")[2].split(":")[1].split(",")[9].trim();
  }

  if (networkType === "LTE") {
    return response.split("\n")[1].split(":")[1].split(",")[12].trim();
  }

  return "Unknown";
};

const getPhysicalCellIDs = (response: string, networkType: string) => {
  // Get the physical cell IDs for LTE
  if (networkType === "LTE" || networkType === "NR5G-NSA") {
    // Get the PCC PCI first
    let pccPCI = response.split("\n").find((l) => l.includes("PCC"));
    pccPCI = pccPCI?.split(":")[1].split(",")[5].trim();

    // Map the SCC PCIs lines
    let sccPCIsLTE = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("LTE"));
    sccPCIsLTE = sccPCIsLTE.map((l) => l.split(":")[1].split(",")[5].trim());

    // Map the SCC PCIs lines for NR5G
    let sccPCIsNR5G = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("NR5G"));
    sccPCIsNR5G = sccPCIsNR5G.map((l) => l.split(":")[1].split(",")[4].trim());

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
    pccPCI = pccPCI?.split(":")[1].split(",")[4].trim();

    // Map the SCC PCIs lines
    let sccPCIs = response
      .split("\n")
      .filter((l) => l.includes("SCC") && l.includes("NR5G"));
    sccPCIs = sccPCIs.map((l) => l.split(":")[5].split(",")[6].trim());

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
  pccEARFCN = pccEARFCN?.split(":")[1].split(",")[1].trim();

  // Map the SCC EARFCN lines
  let sccEARFCNsLTE = response
    .split("\n")
    .filter((l) => l.includes("SCC") && l.includes("LTE"));
  sccEARFCNsLTE = sccEARFCNsLTE.map((l) =>
    l.split(":")[1].split(",")[1].trim()
  );

  let sccEARFCNsNR5G = response
    .split("\n")
    .filter((l) => l.includes("SCC") && l.includes("NR5G"));
  sccEARFCNsNR5G = sccEARFCNsNR5G.map((l) =>
    l.split(":")[1].split(",")[1].trim()
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
    return response.split("\n")[1].split(":")[1].split(",")[4].trim();
  }

  if (networkType === "NR5G-NSA") {
    return response.split("\n")[2].split(":")[1].split(",")[2].trim();
  }
};

const getMNC = (response: string, networkType: string) => {
  if (networkType === "LTE" || networkType === "NR5G-SA") {
    return response.split("\n")[1].split(":")[1].split(",")[5].trim();
  }

  if (networkType === "NR5G-NSA") {
    return response.split("\n")[2].split(":")[1].split(",")[3].trim();
  }
};

const getSignalQuality = (response: string) => {
  let sinrLTE = response.split("\n").find((l) => l.includes("LTE"));
  let sinrNR5G = response.split("\n").find((l) => l.includes("NR5G"));

  // Get the SINR numerical values from sinrLTE except -32768
  if (sinrLTE) {
    let sinrValuesLTE = sinrLTE
      .match(/\d+/g)
      ?.map((num) => parseInt(num))
      .filter((num) => num !== -32768);

    if (sinrNR5G) {
      // Match all numerical values except for the 5 in NR5G and filter out -32768
      let sinrValuesNR5G = sinrNR5G
        .match(/\d+/g)
        ?.map((num) => parseInt(num))
        .filter((num) => num !== -32768);

      // Remove the last value of the array
      if (sinrValuesNR5G && sinrValuesNR5G.length > 1) {
        sinrValuesNR5G.pop();

        // Combine the two arrays and calculate the average
        if (sinrValuesLTE) {
          const sinrValues = [...sinrValuesLTE, ...sinrValuesNR5G];
          const avgSinr =
            sinrValues.reduce((acc, v) => acc + v, 0) / sinrValues.length;

          // calculate the percentage where 0 is the worst and 40 is the best
          const sinrPercentage = (avgSinr / 40) * 100;

          // Return the percentage as a string
          return `${Math.round(sinrPercentage)}%`;
        }
      }
    }

    // Calculate the average SINR value and get its percentage where 0 is the worst and 40 is the best
    if (sinrValuesLTE) {
      const avgSinr =
        sinrValuesLTE.reduce((acc, v) => acc + v, 0) / sinrValuesLTE.length;
      const sinrPercentage = (avgSinr / 40) * 100;
      return `${Math.round(sinrPercentage)}%`;
    }
  } else if (sinrNR5G && !sinrLTE) {
    // Match all numerical values except for the 5 in NR5G and filter out -32768
    let sinrValuesNR5G = sinrNR5G
      .match(/\d+/g)
      ?.map((num) => parseInt(num))
      .filter((num) => num !== -32768);

    // Remove the last value of the array
    if (sinrValuesNR5G && sinrValuesNR5G.length > 1) {
      sinrValuesNR5G.pop();

      // Calculate the average SINR value and get its percentage where 0 is the worst and 40 is the best
      const avgSinr =
        sinrValuesNR5G.reduce((acc, v) => acc + v, 0) / sinrValuesNR5G.length;
      const sinrPercentage = (avgSinr / 40) * 100;
      return `${Math.round(sinrPercentage)}%`;
    }
  } else {
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
      l.split(":")[1].split(",")[3].replace(/"/g, "")
    );
  } else if (bandsLte.length) {
    return bandsLte.map((l) => l.split(":")[1].split(",")[3].replace(/"/g, ""));
  } else if (bandsNr5g.length) {
    return bandsNr5g.map((l) =>
      l.split(":")[1].split(",")[3].replace(/"/g, "")
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
      (l) => l.split(":")[1].split(",")[1]
    );
  } else if (earfcnsLte.length) {
    return earfcnsLte.map((l) => l.split(":")[1].split(",")[1]);
  } else if (earfcnsNr5g.length) {
    return earfcnsNr5g.map((l) => l.split(":")[1].split(",")[1]);
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
    (l) => BANDWIDTH_MAP[l.split(":")[1].split(",")[2]]
  );
  const parsedBandwidthsNr5g = bandwidthsNr5g.map(
    (l) => NR_BANDWIDTH_MAP[l.split(":")[1].split(",")[2]]
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
  // Loop through the response and extract the PCI
  if (networkType === "LTE" || networkType === "NR5G-SA") {
    const pcis = response.split("\n").filter((l) => l.includes("BAND"));
    return pcis.map((l) => l.split(":")[1].split(",")[5]);
  } else if (networkType === "NR5G-NSA") {
    const pcisLte = response.split("\n").filter((l) => l.includes("LTE BAND"));
    const pcisNr5g = response
      .split("\n")
      .filter((l) => l.includes("NR5G BAND"));

    const pcisLteValues = pcisLte.map((l) => l.split(":")[1].split(",")[5]);
    const pcisNr5gValues = pcisNr5g.map((l) => l.split(":")[1].split(",")[4]);

    return [...pcisLteValues, ...pcisNr5gValues];
  }
};

const getCurrentBandsRSRP = (
  response: string,
  networkType: string,
  servingCell: string
) => {
  // Loop through the response and extract the RSRP
  if (networkType === "LTE") {
    const rsrps = response.split("\n").filter((l) => l.includes("LTE BAND"));
    return rsrps.map((l) => l.split(":")[1].split(",")[6]);
  }

  if (networkType === "NR5G-NSA") {
    // Map all the RSRP values for LTE and NR5G
    let lteRSRP = response
      .split("\n")
      .filter((l) => l.includes("LTE BAND"))
      .map((l) => l.split(":")[1].split(",")[6]);

    const nr5gRSRP = servingCell
      .split("\n")
      .filter((l) => l.includes("NR5G-NSA"))
      .map((l) => l.split(":")[1].split(",")[4]);

    if (lteRSRP.length && nr5gRSRP.length) {
      return [...lteRSRP, ...nr5gRSRP];
    } else if (lteRSRP.length) {
      return lteRSRP;
    } else if (nr5gRSRP.length) {
      return nr5gRSRP;
    } else {
      return ["Unknown"];
    }
  }

  if (networkType === "NR5G-SA") {
    const pccRSRP = servingCell.split("\n").find((l) => l.includes("NR5G-SA"));

    if (pccRSRP) {
      return [pccRSRP.split(":")[1].split(",")[12]];
    } else {
      return ["Unknown"];
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
    return rsrqs.map((l) => l.split(":")[1].split(",")[7]);
  }

  if (networkType === "NR5G-SA") {
    const pccRSRQ = servingCell.split("\n").find((l) => l.includes("NR5G-SA"));

    if (pccRSRQ) {
      return [pccRSRQ.split(":")[1].split(",")[13]];
    } else {
      return ["Unknown"];
    }
  }

  if (networkType === "NR5G-NSA") {
    const lteRSRQ = response
      .split("\n")
      .filter((l) => l.includes("LTE BAND"))
      .map((l) => l.split(":")[1].split(",")[7]);

    const nr5gRSRQ = servingCell
      .split("\n")
      .filter((l) => l.includes("NR5G-NSA"))
      .map((l) => l.split(":")[1].split(",")[6]);

    if (lteRSRQ.length && nr5gRSRQ.length) {
      return [...lteRSRQ, ...nr5gRSRQ];
    } else if (lteRSRQ.length) {
      return lteRSRQ;
    } else if (nr5gRSRQ.length) {
      return nr5gRSRQ;
    } else {
      return ["Unknown"];
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
    return sinrs.map((l) => l.split(":")[1].split(",")[9]);
  }

  if (networkType === "NR5G-SA") {
    const pccSINR = servingCell.split("\n").find((l) => l.includes("NR5G-SA"));

    if (pccSINR) {
      return [pccSINR.split(":")[1].split(",")[14]];
    } else {
      return ["Unknown"];
    }
  }

  if (networkType === "NR5G-NSA") {
    const lteSINR = response
      .split("\n")
      .filter((l) => l.includes("LTE BAND"))
      .map((l) => l.split(":")[1].split(",")[9]);

    const nr5gSINR = servingCell
      .split("\n")
      .filter((l) => l.includes("NR5G-NSA"))
      .map((l) => l.split(":")[1].split(",")[5]);

    if (lteSINR.length && nr5gSINR.length) {
      return [...lteSINR, ...nr5gSINR];
    } else if (lteSINR.length) {
      return lteSINR;
    } else if (nr5gSINR.length) {
      return nr5gSINR;
    } else {
      return ["Unknown"];
    }
  }

  return ["Unknown"];
};

export default useHomeData;
