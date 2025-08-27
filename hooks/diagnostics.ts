/**
 * A custom React hook for running network diagnostics on cellular modem devices.
 *
 * This hook provides functionality to fetch and analyze various cellular network metrics
 * including registration status, SIM state, APN configuration, WAN IP connectivity,
 * signal strength, modem temperature, and network rejection causes.
 *
 * @returns An object containing:
 *   - `isRunningDiagnostics` - Boolean indicating if diagnostics are currently running
 *   - `runDiagnosticsData` - Processed diagnostics data or null if not yet run
 *   - `startDiagnostics` - Async function that initiates the diagnostics process
 *
 * @example
 * ```tsx
 * const { isRunningDiagnostics, runDiagnosticsData, startDiagnostics } = useRunDiagnostics();
 *
 * const handleRunDiagnostics = async () => {
 *   try {
 *     const data = await startDiagnostics();
 *     console.log('Diagnostics completed:', data);
 *   } catch (error) {
 *     console.error('Failed to run diagnostics:', error);
 *   }
 * };
 * ```
 */
import { useState } from "react";
import { DiagnosticsData } from "@/types/types";
import {
  EMM_REJECT_CAUSE_MAP,
  ESM_REJECT_CAUSE_MAP,
  NRMM_REJECT_CAUSE_MAP,
} from "@/types/types";

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
      ?.split(":")[1]
      ?.split(",")[1]
      .trim();
    const reg5GStatus = registration5GStatus
      .split("\n")[1]
      ?.split(":")[1]
      ?.split(",")[1]
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
      ?.split(":")[1]
      ?.split(",")[2]
      .replace(/"/g, "")
      .trim();
    const activeAPN = currentActiveAPN
      .split("\n")[1]
      ?.split(":")[1]
      ?.split(",")[2]
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
      ?.split(":")[1]
      ?.split(",")[1]
      .trim();
    const currentWANIPv6 = wanIP
      .split("\n")[2]
      ?.split(":")[1]
      ?.split(",")[1]
      .trim();

    if (
      (currentWANIPv4 && currentWANIPv4 === "1") ||
      (currentWANIPv6 && currentWANIPv6 === "1")
    ) {
      return "Connected";
    } else {
      return "Disconnected";
    }
  };

  const getCellSignalStrength = (cellSignal: string) => {
    try {
      // Remove any trailing whitespace and split into lines
      const lines = cellSignal
        .trim()
        .split("\n")
        .map((line) => line.trim());

      // Find the lines containing RSRP values
      const lteRsrpLine = lines.find(
        (line) => line.includes("+QRSRP:") && line.includes("LTE")
      );
      const nr5gRsrpLine = lines.find(
        (line) => line.includes("+QRSRP:") && line.includes("NR5G")
      );

      // Extract LTE values
      let lteRsrpValues: number[] = [];
      if (lteRsrpLine) {
        lteRsrpValues = lteRsrpLine
          ?.split(":")[1]
          ?.split(",")
          ?.slice(0, 4)
          .map((value) => value.trim())
          .filter((value) => !isNaN(parseInt(value)))
          .map((value) => parseInt(value));
      }

      // Extract 5G values
      let nr5gRsrpValues: number[] = [];
      if (nr5gRsrpLine) {
        nr5gRsrpValues = nr5gRsrpLine
          ?.split(":")[1]
          ?.split(",")
          ?.slice(0, 4)
          .map((value) => value.trim())
          .filter((value) => !isNaN(parseInt(value)))
          .map((value) => parseInt(value));
      }

      // remove -32768 values from the array
      lteRsrpValues = lteRsrpValues.filter((value) => value !== -32768);
      nr5gRsrpValues = nr5gRsrpValues.filter((value) => value !== -32768);

      // remove -140 values from the array
      lteRsrpValues = lteRsrpValues.filter((value) => value !== -140);
      nr5gRsrpValues = nr5gRsrpValues.filter((value) => value !== -140);

      // Calculate signal strength
      if (lteRsrpValues.length > 0) {
        const lteRsrpAverage =
          lteRsrpValues.reduce((acc, value) => acc + value, 0) /
          lteRsrpValues.length;

        // If both LTE and 5G values exist (NSA scenario)
        if (nr5gRsrpValues.length > 0) {
          const nr5gRsrpAverage =
            nr5gRsrpValues.reduce((acc, value) => acc + value, 0) /
            nr5gRsrpValues.length;

          const combinedRsrpAverage = (lteRsrpAverage + nr5gRsrpAverage) / 2;
          return combinedRsrpAverage < -100 ? "Poor" : "Good";
        }

        // LTE only scenario
        return lteRsrpAverage < -100 ? "Poor" : "Good";
      } else if (nr5gRsrpValues.length > 0) {
        // 5G only scenario
        const nr5gRsrpAverage =
          nr5gRsrpValues.reduce((acc, value) => acc + value, 0) /
          nr5gRsrpValues.length;

        return nr5gRsrpAverage < -100 ? "Poor" : "Good";
      }

      return "N/A";
    } catch (error) {
      console.error("Error processing cell signal:", error);
      return "N/A";
    }
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
      ?.split(":")[1]
      ?.split(",")[1]
      .trim();

    const esmCause = netReject
      .split("\n")[2]
      ?.split(":")[1]
      ?.split(",")[1]
      .trim();

    const mm5GCause = netReject
      .split("\n")[3]
      ?.split(":")[1]
      ?.split(",")[1]
      .trim();

    const causes = [
      emmCause !== "0" ? `EMM: ${emmCause}` : null,
      esmCause !== "0" ? `ESM: ${esmCause}` : null,
      mm5GCause !== "0" ? `NRMM: ${mm5GCause}` : null,
    ].filter(Boolean);

    return causes.length > 0 ? causes.join(", ") : "None";
  };

  const getDetailedRejectCauses = (netReject: string) => {
    const emmCause = netReject
      .split("\n")[1]
      ?.split(":")[1]
      ?.split(",")[1]
      .trim();

    const esmCause = netReject
      .split("\n")[2]
      ?.split(":")[1]
      ?.split(",")[1]
      .trim();

    const mm5GCause = netReject
      .split("\n")[3]
      ?.split(":")[1]
      ?.split(",")[1]
      .trim();

    const rejectCauses: any = {};

    if (emmCause && emmCause !== "0") {
      rejectCauses.emm = {
        code: emmCause,
        description:
          EMM_REJECT_CAUSE_MAP[emmCause as keyof typeof EMM_REJECT_CAUSE_MAP] ||
          "Unknown EMM cause",
      };
    }

    if (esmCause && esmCause !== "0") {
      rejectCauses.esm = {
        code: esmCause,
        description:
          ESM_REJECT_CAUSE_MAP[esmCause as keyof typeof ESM_REJECT_CAUSE_MAP] ||
          "Unknown ESM cause",
      };
    }

    if (mm5GCause && mm5GCause !== "0") {
      rejectCauses.nrmm = {
        code: mm5GCause,
        description:
          NRMM_REJECT_CAUSE_MAP[
            mm5GCause as keyof typeof NRMM_REJECT_CAUSE_MAP
          ] || "Unknown NRMM cause",
      };
    }

    return Object.keys(rejectCauses).length > 0 ? rejectCauses : null;
  };

  const startDiagnostics = async (): Promise<DiagnosticsData> => {
    setIsRunningDiagnostics(true);

    const timestamp = new Date().toISOString();

    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=6"
      );
      const data = await response.json();

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
        rejectCauses: getDetailedRejectCauses(data[8].response), // Add this line
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
