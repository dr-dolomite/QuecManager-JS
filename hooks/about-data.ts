/**
 * A custom hook that fetches and manages device information data.
 *
 * This hook retrieves various device details including manufacturer, model,
 * firmware version, network information, and real-time uptime status.
 *
 * @returns {Object} An object containing:
 *   - data: The fetched device information data (AboutData | null)
 *   - isLoading: Boolean indicating if data is currently being fetched
 *   - fetchAboutData: Function to manually trigger a refresh of all device data
 *
 * @remarks
 * - Automatically fetches data on component mount
 * - Updates device uptime every second
 * - Cleans up intervals when the component unmounts
 * - Requires the AboutData type to be defined elsewhere in your application
 * - Makes API calls to backend CGI scripts to fetch device information
 *
 * @example
 * ```tsx
 * const { data, isLoading, fetchAboutData } = useAboutData();
 *
 * if (isLoading) return <LoadingSpinner />;
 *
 * return (
 *   <div>
 *     <h1>Device Information</h1>
 *     <p>Model: {data?.model}</p>
 *     <p>Uptime: {data?.deviceUptime}</p>
 *     <button onClick={fetchAboutData}>Refresh</button>
 *   </div>
 * );
 * ```
 */

import { useState, useEffect, useCallback } from "react";
import { AboutData } from "@/types/types";

const useAboutData = () => {
  const [data, setData] = useState<AboutData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUptime = useCallback(async () => {
    try {
      const uptimeResponse = await fetch(
        "/cgi-bin/quecmanager/settings/device-uptime.sh"
      );
      const uptimeData = await uptimeResponse.json();

      setData((prevData) => {
        if (!prevData) return prevData;
        return {
          ...prevData,
          deviceUptime: uptimeData.uptime.formatted || "N/A",
        };
      });
    } catch (error) {
      console.error("Error fetching uptime:", error);
    }
    ``;
  }, []);

  const fetchAboutData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch both device info and initial uptime in parallel
      const [deviceResponse, uptimeResponse] = await Promise.all([
        fetch("/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=3"),
        fetch("/cgi-bin/quecmanager/settings/device-uptime.sh"),
      ]);

      const [rawData, uptimeData] = await Promise.all([
        deviceResponse.json(),
        uptimeResponse.json(),
      ]);

      console.log("Raw data:", rawData);

      const processedData: AboutData = {
        manufacturer: rawData[0].response.split("\n")[1].trim(),
        model: rawData[1].response.split("\n")[1].trim(),
        firmwareVersion: rawData[2].response.split("\n")[1].trim(),
        phoneNum: rawData[3].response
          .split("\n")[1]
          .split(":")[1]
          .split(",")[1]
          .replace(/"/g, "")
          .trim(),
        imsi: rawData[4].response.split("\n")[1].trim(),
        iccid: rawData[5].response.split("\n")[1].split(":")[1].trim(),
        imei: rawData[6].response.split("\n")[1].trim(),
        currentDeviceIP: rawData[7].response
          .split("\n")[1]
          .split(",")[1]
          .replace(/"/g, "")
          .trim(),
        lanGateway: rawData[7].response
          .split("\n")[1]
          .split(":")[1]
          .split(",")[3]
          .replace(/"/g, "")
          .trim(),
        wwanIPv4: rawData[8].response
          .split("\n")[1]
          .split(":")[1]
          .split(",")[4]
          .replace(/"/g, "")
          .trim(),
        wwanIPv6: rawData[8].response
          .split("\n")[2]
          .split(",")[4]
          .replace(/"/g, "")
          .trim(),
        lteCategory: rawData[9].response.split("\n")[5].split(":")[2].trim(),
        deviceUptime: uptimeData.uptime.formatted || "N/A",
        // > AT+QNWCFG="3gpp_rel"
        // AT+QNWCFG="3gpp_rel"
        // +QNWCFG: "3gpp_rel",R17,R17

        // OK
        //
        LTE3GppRel: rawData[10].response
          .split("\n")[1]
          .split(":")[1]
          .split(",")[1]
          .replace(/R/g, "")
          .trim(),
        NR3GppRel: rawData[10].response
          .split("\n")[1]
          .split(":")[1]
          .split(",")[2]
          .replace(/R/g, "")
          .trim(),
      };

      setData(processedData);
      // console.log("Processed data:", processedData);
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
