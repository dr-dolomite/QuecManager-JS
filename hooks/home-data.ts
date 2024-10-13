// hooks/useHomeData.ts
import { useState, useEffect } from "react";
import { HomeData } from "@/types/types";
import { BANDWIDTH_MAP } from "@/constants/home/index";

const useHomeData = () => {
  const [data, setData] = useState<HomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/home-stats");
        const rawData = await response.json();
        console.log(rawData);

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
            bandwidth: getBandwidth(rawData[13].response),
            connectedBands: getConnectedBands(rawData[13].response),
            signalStrength: getSignalStrength(rawData[14].response),
            mimoLayers:
              rawData[14].response
                .split("\n")[1]
                .match(/\d+/g)
                ?.length.toString() || "Inactive",
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
        };

        setData(processedData);
      } catch (error) {
        console.error("Error fetching home data:", error);
      } finally {
        // Add a slight delay to prevent flickering
        // await new Promise((resolve) => setTimeout(resolve, 500));
        setIsLoading(false);
      }
    };

    fetchHomeData();
    // Set up an interval to fetch data every 5 seconds
    const intervalId = setInterval(fetchHomeData, 5000);

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return { data, isLoading };
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

const getBandwidth = (response: string) => {
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

  // Display the bandwidths in a human-readable format
  // If only PCC bandwidth is present
  if (pccBandwidth && !sccBandwidthLTE.length && !sccBandwidthNR5G.length) {
    return BANDWIDTH_MAP[pccBandwidth] || "Unknown";
  }

  // If PCC and SCC bandwidths are present for LTE
  if (pccBandwidth && sccBandwidthLTE.length && !sccBandwidthNR5G.length) {
    return `${BANDWIDTH_MAP[pccBandwidth]} + ${sccBandwidthLTE
      .map((bw) => BANDWIDTH_MAP[bw])
      .join("+ ")}`;
  }

  // If PCC and SCC bandwidths are present for NR5G
  if (pccBandwidth && !sccBandwidthLTE.length && sccBandwidthNR5G.length) {
    return `${BANDWIDTH_MAP[pccBandwidth]} + ${sccBandwidthNR5G
      .map((bw) => BANDWIDTH_MAP[bw])
      .join("+ ")}`;
  }

  // If PCC and SCC bandwidths are present for both LTE and NR5G
  if (pccBandwidth && sccBandwidthLTE.length && sccBandwidthNR5G.length) {
    return `${BANDWIDTH_MAP[pccBandwidth]} + ${sccBandwidthLTE
      .map((bw) => BANDWIDTH_MAP[bw])
      .join("+ ")} + ${sccBandwidthNR5G
      .map((bw) => BANDWIDTH_MAP[bw])
      .join("+ ")}`;
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
  const signalStrength = response
    .split("\n")[1]
    .match(/\d+/g)
    ?.map((num) => parseInt(num));
  if (!signalStrength) return "Unknown";
  const avgSignalStrength =
    signalStrength.reduce((acc, s) => acc + s, 0) / signalStrength.length;
  const signalStrengthPercentage = ((-avgSignalStrength + 140) / 70) * 100;
  return `${Math.round(signalStrengthPercentage)}%`;
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
    sccPCIsNR5G = sccPCIsNR5G.map((l) => l.split(":")[1].split(",")[5].trim());

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
  const sinrValues = response
    .split("\n")[1]
    .match(/\d+/g)
    ?.map((num) => parseInt(num));

  if (!sinrValues) return "Unknown";

  // Calculate the average SINR value and get its percentage where 0 is the worst and 20 is the best
  const avgSINR = sinrValues.reduce((acc, v) => acc + v, 0) / sinrValues.length;
  const sinrPercentage = (avgSINR / 20) * 100;

  // Return the percentage as a string
  return `${Math.round(sinrPercentage)}%`;
};

export default useHomeData;
