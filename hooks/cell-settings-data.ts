// hooks/cellSettingsData.ts
import { useState, useEffect, useCallback } from "react";
import { CellSettingsData } from "@/types/types";

const useCellSettingsData = () => {
  const [data, setData] = useState<CellSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCellSettingsData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/cgi-bin/fetch_data?set=2");
      const rawData = await response.json();
      console.log("Fetched cell settings data:", rawData);

      const processedData: CellSettingsData = {
        currentAPN: processAPN(rawData[0].response, rawData[1].response),
        apnPDPType: processAPNPDPType(rawData[0].response),
        preferredNetworkType: processPreferredNetworkType(rawData[2].response),
        nr5gMode: processNR5GMode(rawData[3].response),
        simSlot: processSimSlot(rawData[4].response),
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

// Helper functions
const processAPN = (manualAPNData: string, autoAPNData: string) => {
  const manualAPN = manualAPNData
    .split("\n")
    .find((line: string) => line.includes("+CGDCONT: 1"))
    ?.split(",")[2]
    .replace(/"/g, "");

  if (manualAPN === undefined || manualAPN === "") {
    const autoAPN = autoAPNData
      .split("\n")
      .find((line: string) => line.includes("+CGCONTRDP:"))
      ?.split(",")[2]
      .replace(/"/g, "");

    if (autoAPN === undefined || autoAPN === "") {
      return "No APN found";
    }
    return autoAPN;
  }

  return manualAPN;
};

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
}

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
}

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
}

const processSimSlot = (data: string) => {
    const simSlot = data
    .split("\n")
    .find((line: string) => line.includes('+QUIMSLOT:'))
    ?.split(":")[1]
    .trim();

    if (simSlot === undefined || simSlot === "") {
        return "Error fetching SIM slot";
    }

    return simSlot;
}
