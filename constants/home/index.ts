// constants.ts

import { BandwidthMap, AccessTechMap } from "@/types/types"

export const BANDWIDTH_MAP: BandwidthMap = {
  "6": "1.4 MHz",
  "15": "3 MHz",
  "25": "5 MHz",
  "50": "10 MHz",
  "75": "15 MHz",
  "100": "20 MHz",
};

export const NR_BANDWIDTH_MAP: BandwidthMap = {
  "0": "5 MHz",
  "1": "10 MHz",
  "2": "15 MHz",
  "3": "20 MHz",
  "4": "25 MHz",
  "5": "30 MHz",
  "6": "40 MHz",
  "7": "50 MHz",
  "8": "60 MHz",
  "9": "70 MHz",
  "10": "80 MHz",
  "11": "90 MHz",
  "12": "100 MHz",
  "13": "200 MHz",
  "14": "400 MHz",
  "15": "35 MHz",
  "16": "45 MHz",
};

export const ACCESS_TECH_MAP: AccessTechMap = {
  "2": "UTRAN",
  "4": "HSDPA",
  "5": "HSUPA",
  "6": "HSDPA & HSUPA",
  "7": "E-UTRAN",
  "10": "E-UTRAN - 5GCN",
  "11": "NR - 5GCN",
  "12": "NG-RAN",
  "13": "E-UTRAN-NR Dual",
};

// Example usage:
export const getBandwidth = (key: string, isNR: boolean = false): string => {
  const map = isNR ? NR_BANDWIDTH_MAP : BANDWIDTH_MAP;
  return map[key] || "Unknown";
};

export const getAccessTech = (key: string): string => {
  return ACCESS_TECH_MAP[key] || "Unknown";
};