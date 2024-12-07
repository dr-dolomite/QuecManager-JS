import { useState } from "react";
import { DiagnosticsData } from "@/types/types";

const useRunDiagnostics = () => {
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticsData, setDiagnosticsData] =
    useState<DiagnosticsData | null>(null);

  const getRegistrationStatus = (
    registrationStatus: string,
    registration5GStatus: string
  ) => {
    const regLTEStatus = registrationStatus
      .split("\n")[1]
      .split(":")[1]
      .split(",")[1]
      .trim();
    const reg5GStatus = registration5GStatus
      .split("\n")[1]
      .split(":")[1]
      .split(",")[1]
      .trim();
    if (regLTEStatus === "1" || reg5GStatus === "1") {
      return "Registered";
    } else {
      return "Not Registered";
    }
  };

  const getManualAPNState = (
    customAPNProfile: string,
    currentActiveAPN: string
  ) => {
    const customAPN = customAPNProfile
      .split("\n")[1]
      .split(":")[1]
      .split(",")[2]
      .replace(/"/g, "")
      .trim();
    const activeAPN = currentActiveAPN
      .split("\n")[1]
      .split(":")[1]
      .split(",")[2]
      .replace(/"/g, "")
      .trim();

    if (customAPN === activeAPN) {
      return "Enabled";
    } else {
      return "Disabled";
    }
  };

  const getWANIPState = (wanIP: string) => {
    const currentWANIPv4 = wanIP
      .split("\n")[1]
      .split(":")[1]
      .split(",")[1]
      .trim();
    const currentWANIPv6 = wanIP
      .split("\n")[2]
      .split(":")[1]
      .split(",")[1]
      .trim();

    if (currentWANIPv4 && currentWANIPv4 === "1" || currentWANIPv6 && currentWANIPv6 === "1") {
      return "Connected";
    } else {
      return "Disconnected";
    }
  };

  const getCellSignalStrength = (cellSignal: string) => {
    const rsrpLTEValues = cellSignal
      .split("\n")[1]
      .split(":")[1]
      .split(",")
      .slice(0, 4)
      .map((value) => value.trim());

    // Check if "NR5G" is present in the cellSignal string
    const hasNR5G = cellSignal.includes("NR5G");
    let rsrp5GValues = null;

    if (hasNR5G) {
      rsrp5GValues = cellSignal
        .split("\n")[2]
        .split(":")[1]
        .split(",")
        .slice(0, 4)
        .map((value) => value.trim());
    }

    if (rsrpLTEValues && rsrpLTEValues.length > 0) {
      const rsrpLTEAverage =
        rsrpLTEValues.reduce((acc, value) => acc + parseInt(value), 0) /
        rsrpLTEValues.length;

      if (hasNR5G && rsrp5GValues && rsrp5GValues.length > 0) {
        const rsrp5GAverage =
          rsrp5GValues.reduce((acc, value) => acc + parseInt(value), 0) /
          rsrp5GValues.length;

        const rsrpAverage = (rsrpLTEAverage + rsrp5GAverage) / 2;
        return rsrpAverage < -100 ? "Poor" : "Good";
      } else {
        return rsrpLTEAverage < -100 ? "Poor" : "Good";
      }
    }

    return "N/A";
  };

  const getModemTempState = (modemTemp: string) => {
    const sanitizedTemperatures = modemTemp
      .split("\n")
      .filter((line) => line.startsWith("+QTEMP:"))
      .map((line) =>
        parseInt(line.split(":")[1].split(",")[1].replace(/"/g, "").trim())
      )
      .filter((temp) => temp >= 0 && temp < 99);

    const averageTemperature =
      sanitizedTemperatures.reduce((acc, temp) => acc + temp, 0) /
      sanitizedTemperatures.length;

    if (averageTemperature < 50) {
      return "Normal";
    } else {
      return "High";
    }
  };

  const getNetRejectCause = (netReject: string) => {
    const emmCause = netReject
      .split("\n")[1]
      .split(":")[1]
      .split(",")[1]
      .trim();

    const esmCause = netReject
      .split("\n")[2]
      .split(":")[1]
      .split(",")[1]
      .trim();

    const mm5GCause = netReject
      .split("\n")[3]
      .split(":")[1]
      .split(",")[1]
      .trim();

      const causes = [
        emmCause !== "0" ? `${emmCause}` : null,
        esmCause !== "0" ? `${esmCause}` : null,
        mm5GCause !== "0" ? `${mm5GCause}` : null
      ].filter(Boolean);
      
      return causes.length > 0 ? causes.join(", ") : "None";
      
  };

  const startDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const response = await fetch("/cgi-bin/fetch_data.sh?set=6");
      const data = await response.json();
      console.log("Diagnostics data:", data);

      const processedData: DiagnosticsData = {
        netRegistration: getRegistrationStatus(
          data[0].response,
          data[1].response
        ),
        simState: data[2].response.split("\n")[1].split(":")[1].trim(),
        manualAPN: getManualAPNState(data[3].response, data[4].response),
        wanIP: getWANIPState(data[5].response),
        cellSignal: getCellSignalStrength(data[6].response),
        modemTemp: getModemTempState(data[7].response),
        netReject: getNetRejectCause(data[8].response),
      };

      setDiagnosticsData(processedData);
      return processedData;
    } catch (error) {
      console.error("Error running diagnostics:", error);
      throw error;
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  return {
    isRunningDiagnostics,
    runDiagnosticsData: diagnosticsData,
    startDiagnostics,
  };
};

export default useRunDiagnostics;
