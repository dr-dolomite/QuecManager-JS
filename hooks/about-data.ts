// hooks/cellSettingsData.ts
import { useState, useEffect, useCallback } from "react";
import { AboutData } from "@/types/types";

const useAboutData = () => {
  const [data, setData] = useState<AboutData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAboutData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/cgi-bin/fetch_data?set=3");
    // const response = await fetch("/fetch-about");
      const rawData = await response.json();
      console.log("Fetched about data:", rawData);

      const processedData: AboutData = {
        manufacturer: rawData[0].response.split("\n")[1].trim(),
        model: rawData[1].response.split("\n")[1].trim(),
        firmwareVersion: rawData[2].response.split("\n")[1].trim(),
        phoneNum: rawData[3].response.split("\n")[1].split(":")[1].split(",")[1].replace(/"/g, "").trim(),
        imsi: rawData[4].response.split("\n")[1].trim(),
        iccid: rawData[5].response.split("\n")[1].split(":")[1].trim(),
        imei: rawData[6].response.split("\n")[1].trim(),
        currentDeviceIP: rawData[7].response.split("\n")[1].split(",")[1].replace(/"/g, "").trim(),
        lanGateway: rawData[7].response.split("\n")[1].split(":")[1].split(",")[3].replace(/"/g, "").trim(),
        wwanIPv4: rawData[8].response.split("\n")[1].split(":")[1].split(",")[4].replace(/"/g, "").trim(),
        wwanIPv6: rawData[8].response.split("\n")[2].split(",")[4].replace(/"/g, "").trim(),
        lteCategory: rawData[9].response.split("\n")[5].split(":")[2].trim(),
        
      };

      setData(processedData);
      console.log("Processed cell settings data:", processedData);
    } catch (error) {
      console.error("Error fetching cell settings data:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAboutData();
  }, [fetchAboutData]);

  return { data, isLoading, fetchAboutData };
};

export default useAboutData;

// Helper functions