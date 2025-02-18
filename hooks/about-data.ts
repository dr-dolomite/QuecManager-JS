import { useState, useEffect, useCallback } from "react";
import { AboutData } from "@/types/types";

const useAboutData = () => {
  const [data, setData] = useState<AboutData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUptime = useCallback(async () => {
    try {
      const uptimeResponse = await fetch("/api/cgi-bin/quecmanager/settings/device-uptime.sh");
      const uptimeData = await uptimeResponse.json();
      
      setData(prevData => {
        if (!prevData) return prevData;
        return {
          ...prevData,
          deviceUptime: uptimeData.uptime.formatted || "N/A"
        };
      });
    } catch (error) {
      console.error("Error fetching uptime:", error);
    }
  }, []);

  const fetchAboutData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch both device info and initial uptime in parallel
      const [deviceResponse, uptimeResponse] = await Promise.all([
        fetch("/api/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=3"),
        fetch("/api/cgi-bin/quecmanager/settings/device-uptime.sh")
      ]);

      const [rawData, uptimeData] = await Promise.all([
        deviceResponse.json(),
        uptimeResponse.json()
      ]);

      console.log("Fetched about data:", rawData);
      console.log("Fetched uptime data:", uptimeData);

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
        deviceUptime: uptimeData.uptime.formatted || "N/A"
      };

      setData(processedData);
      console.log("Processed data:", processedData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAboutData();

    // Set up interval for uptime updates
    const uptimeInterval = setInterval(fetchUptime, 1000);

    // Cleanup on unmount
    return () => {
      clearInterval(uptimeInterval);
    };
  }, [fetchAboutData, fetchUptime]);

  return { data, isLoading, fetchAboutData };
};

export default useAboutData;