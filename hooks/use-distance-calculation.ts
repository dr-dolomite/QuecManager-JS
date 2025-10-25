import { useState, useEffect, useMemo } from "react";

interface MeasurementUnitResponse {
  status: string;
  message: string;
  data?: {
    unit: "km" | "mi";
    isDefault: boolean;
  };
}

interface DistanceResult {
  formatted: string;
  rawKm: number;
}

export const useDistanceCalculation = (
  lteTimeAdvance?: string,
  nrTimeAdvance?: string
) => {
  const [measurementUnit, setMeasurementUnit] = useState<"km" | "mi">("km");
  const [isUnitLoading, setIsUnitLoading] = useState<boolean>(true);

  // Fetch measurement unit preference on component mount
  useEffect(() => {
    const fetchMeasurementUnit = async () => {
      try {
        setIsUnitLoading(true);
        const response = await fetch(
          "/cgi-bin/quecmanager/settings/measurement_units.sh"
        );
        const data: MeasurementUnitResponse = await response.json();

        if (data.status === "success" && data.data) {
          setMeasurementUnit(data.data.unit);
        }
      } catch (error) {
        console.error("Error fetching measurement unit:", error);
        // Default to km if fetch fails
        setMeasurementUnit("km");
      } finally {
        setIsUnitLoading(false);
      }
    };

    fetchMeasurementUnit();
  }, []);

  // Calculate distance for LTE (TA input is the index value)
  const calculateLteDistance = (ta: number): number => {
    // Validate TA range for LTE (0-1282)
    if (ta < 0 || ta > 1282) {
      console.warn(`Invalid LTE TA value: ${ta}, using 0 instead`);
      ta = 0;
    }

    // Calculate NTA = 16 * TA
    const NTA = 16 * ta;

    // TS = 1/(2048×15000) seconds for LTE
    const TS = 1 / 30720000;

    // Calculate timing offset
    const timeOffset = NTA * TS;

    // Speed of light in m/s
    const SPEED_OF_LIGHT = 3 * 10 ** 8;

    // Distance = (c * timeOffset) / 2
    return (SPEED_OF_LIGHT * timeOffset) / 2 / 1000; // Convert to km
  };

  // Calculate distance for NR (input is already NTA value according to your implementation)
  // Note: In 5G NR, when TA=1, NTA=1024 as shown in the PDF
  const calculateNrDistance = (nta: number): number => {
    // Handle negative NTA values
    if (nta < 0) {
      console.warn(`Invalid negative NTA value: ${nta}, using 0 instead`);
      nta = 0;
    }

    // TC = Basic time unit for NR = 1/(480*10^3*4096) seconds
    const TC = 1 / (480 * 1000 * 4096);

    // Speed of light in m/s
    const SPEED_OF_LIGHT = 3 * 10 ** 8;

    // Distance = (c * NTA * TC) / 2
    return (SPEED_OF_LIGHT * nta * TC) / 2 / 1000; // Convert to km
  };

  // Parse timing advance values, handling special cases
  const getLteTa = (): number => {
    if (
      !lteTimeAdvance ||
      lteTimeAdvance === "Unknown" ||
      lteTimeAdvance === "-"
    ) {
      return 0;
    }
    return parseInt(lteTimeAdvance, 10) || 0;
  };

  const getNrTa = (): number => {
    if (
      !nrTimeAdvance ||
      nrTimeAdvance === "Unknown" ||
      nrTimeAdvance === "-"
    ) {
      return 0;
    }
    return parseInt(nrTimeAdvance, 10) || 0;
  };

  // Convert kilometers to miles
  const kmToMiles = (km: number): number => {
    return km * 0.621371;
  };

  // Format distances for display based on preferred unit
  const formatDistance = (distanceInKm: number): string => {
    if (distanceInKm === 0) return "-";

    if (measurementUnit === "mi") {
      // Convert to miles
      const distanceInMiles = kmToMiles(distanceInKm);

      // If the distance is less than 1 mile, show in feet
      if (distanceInMiles < 1) {
        const distanceInFeet = distanceInMiles * 5280;
        return `${distanceInFeet.toFixed(0)} ft`;
      }
      return `${distanceInMiles.toFixed(2)} mi`;
    } else {
      // Display in kilometers/meters
      // If the distance is less than 1 km, show in meters
      if (distanceInKm < 1) {
        return `${(distanceInKm * 1000).toFixed(0)} m`;
      }
      return `${distanceInKm.toFixed(2)} km`;
    }
  };

  // Calculate distances using useMemo to avoid recalculation on every render
  const distances = useMemo(() => {
    const lteTa = getLteTa();
    const nrTa = getNrTa();

    const lteDistanceKm = lteTa > 0 ? calculateLteDistance(lteTa) : 0;
    const nrDistanceKm = nrTa > 0 ? calculateNrDistance(nrTa) : 0;

    return {
      lte: {
        formatted: formatDistance(lteDistanceKm),
        rawKm: lteDistanceKm,
        ta: lteTa,
      },
      nr: {
        formatted: formatDistance(nrDistanceKm),
        rawKm: nrDistanceKm,
        ta: nrTa,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lteTimeAdvance, nrTimeAdvance, measurementUnit]);

  return {
    lteDistance: distances.lte,
    nrDistance: distances.nr,
    measurementUnit,
    isUnitLoading,
  };
};
