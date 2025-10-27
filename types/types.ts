// types.ts

export interface SimCardData {
  slot: string;
  state: "Inserted" | "Not Inserted" | "Unknown" | "Waiting for Password" | "Waiting for PIN" | "SMS-Tool Failed Token";
  provider: string;
  phoneNumber: string;
  imsi: string;
  iccid: string;
  imei: string;
}

export interface ConnectionData {
  apn: string;
  operatorState:
    | "Registered"
    | "Searching"
    | "Denied"
    | "Unknown"
    | "Roaming"
    | "Not Registered";
  functionalityState: "Full Functionality" | "Limited Functionality";
  networkType: "NR5G-NSA" | "LTE" | "NR5G-SA" | "No Signal";
  modemTemperature: string;
  accessTechnology: string;
}

export interface DataTransmissionData {
  carrierAggregation: "Multi" | "Inactive";
  bandwidth?: string | string[];
  connectedBands: string;
  signalStrength?: string;
  mimoLayers: string;
}

export interface CellularInfoData {
  cellId?: string;
  trackingAreaCode?: string;
  physicalCellId?: string;
  cellIdRaw: string,
  trackingAreaCodeRaw: string,
  earfcn?: string;
  mcc?: string;
  mnc?: string;
  signalQuality?: string;
}

export interface CurrentBandsData {
  id?: number[],
  bandNumber?: string[];
  earfcn?: string[];
  bandwidth?: string[];
  pci?: string[];
  rsrp?: string[];
  rsrq?: string[];
  sinr?: string[];
}

export interface NetworkAddressingData {
  publicIPv4: string;
  cellularIPv4: string;
  cellularIPv6: string;
  carrierPrimaryDNS: string;
  carrierSecondaryDNS: string;
  rawCarrierPrimaryDNS: string;
  rawCarrierSecondaryDNS: string;
}

export interface timeAdvanceData {
  lteTimeAdvance: string;
  nrTimeAdvance: string;
}

export interface HomeData {
  simCard: SimCardData;
  connection: ConnectionData;
  dataTransmission: DataTransmissionData;
  cellularInfo: CellularInfoData;
  currentBands: CurrentBandsData;
  networkAddressing: NetworkAddressingData;
  timeAdvance: timeAdvanceData;
}

export interface Band {
  id: number;
  bandNumber: string;
  earfcn: string;
  bandwidth: string;
  pci: string;
  rsrp: string;
  rsrq: string;
  sinr: string;
}

export interface CellSettingsData {
  APNProfiles?: string[];
  apnPDPType?: string;
  preferredNetworkType?: string;
  nr5gMode?: string;
  simSlot?: string;
  cfunState?: string;
  autoSelState?: string;
  selectedMbnProfile?: string;
  mbnProfilesList: string[];
  dataProfileIndex: string;
  lteAMBR: string[];
  nr5gAMBR: string[];
}

export interface AboutData {
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  lteCategory?: string;
  phoneNum?: string;
  imsi?: string;
  iccid?: string;
  imei?: string;
  currentDeviceIP?: string;
  lanGateway?: string;
  wwanIPv4?: string;
  wwanIPv6?: string;
  deviceUptime?: string;
  LTE3GppRel?: string;
  NR3GppRel?: string;
}

export interface DiagnosticsData {
  id?: string;
  timestamp?: string;
  netRegistration?: string;
  simState?: string;
  manualAPN?: string;
  wanIP?: string;
  cellSignal?: string;
  modemTemp?: string;
  netReject?: string;
  rawData?: any[];
  // Add detailed reject causes
  rejectCauses?: {
    emm?: {
      code: string;
      description: string;
    };
    esm?: {
      code: string;
      description: string;
    };
    nrmm?: {
      code: string;
      description: string;
    };
  };
}

// You might also want to define some utility types for the bandwidth maps and access tech map

export type BandwidthMap = {
  [key: string]: string;
};

export type AccessTechMap = {
  [key: string]: string;
};

const BANDWIDTH_MAP: BandwidthMap = {
  "0": "1.4 MHz",
  "1": "3 MHz",
  "2": "5 MHz",
  "3": "10 MHz",
  "4": "15 MHz",
  "5": "20 MHz",
  "6": "40 MHz",
  "7": "80 MHz",
  "8": "100 MHz",
  "9": "200 MHz",
};

const NR_BANDWIDTH_MAP: BandwidthMap = {
  "0": "5 MHz",
  "1": "10 MHz",
  "2": "15 MHz",
  "3": "20 MHz",
  "4": "25 MHz",
  "5": "30 MHz",
  "6": "40 MHz",
  "7": "50 MHz",
  "8": "60 MHz",
  "9": "80 MHz",
  "10": "100 MHz",
  "11": "200 MHz",
};

const ACCESS_TECH_MAP: AccessTechMap = {
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

// If you need to use these types with the existing constants, you can do:
// const BANDWIDTH_MAP: BandwidthMap = { ... };
// const NR_BANDWIDTH_MAP: BandwidthMap = { ... };
// const ACCESS_TECH_MAP: AccessTechMap = { ... };

export interface APNProfile {
  iccid: string;
  apn: string;
  pdpType: string;
}

export interface ServiceStatus {
  status: "running" | "stopped";
  enabled: boolean;
  script: "present" | "missing";
  initScript: "present" | "missing";
}

export interface APNProfileResponse {
  status: "active" | "inactive" | "error";
  message?: string;
  service?: ServiceStatus;
  profiles: {
    profile1?: APNProfile;
    profile2?: APNProfile;
  };
  lastActivity?: string;
}

export const LTE_RB_BANDWIDTH_MAP: BandwidthMap = {
  "6": "1.4 MHz",
  "15": "3 MHz",
  "25": "5 MHz",
  "50": "10 MHz",
  "75": "15 MHz",
  "100": "20 MHz",
  "-": "-"
};

export const EMM_REJECT_CAUSE_MAP = {
  "0": "No cause",
  "2": "IMSI unknown in HSS",
  "3": "Illegal UE",
  "5": "IMEI not accepted",
  "6": "Illegal ME",
  "7": "EPS services not allowed",
  "8": "EPS services and non-EPS services not allowed",
  "9": "UE identity cannot be derived by the network",
  "10": "Implicitly detached",
  "11": "PLMN not allowed",
  "12": "Tracking Area not allowed",
  "13": "Roaming not allowed in this tracking area",
  "14": "EPS services not allowed in this PLMN",
  "15": "No Suitable Cells in tracking area",
  "16": "MSC temporarily not reachable",
  "17": "Network failure",
  "18": "CS domain not available",
  "19": "ESM failure",
  "20": "MAC failure",
  "21": "Synch failure",
  "22": "Congestion",
  "23": "UE security capabilities mismatch",
  "24": "Security mode rejected, unspecified",
  "25": "Not authorized for this CSG",
  "26": "Non-EPS authentication unacceptable",
  "31": "Redirection to 5GCN required",
  "35": "Requested service option not authorized in this PLMN",
  "39": "CS service temporarily not available",
  "40": "No EPS bearer context activated",
  "42": "Severe network failure",
  "95": "Semantically incorrect message",
  "96": "Invalid mandatory information",
  "97": "Message type non-existent or not implemented",
  "98": "Message type not compatible with the protocol state",
  "99": "Information element non-existent or not implemented",
  "100": "Conditional IE error",
  "101": "Message not compatible with the protocol state",
  "111": "Protocol error, unspecified",
};

export const ESM_REJECT_CAUSE_MAP = {
  "0": "No cause",
  "8": "Operator Determined Barring",
  "26": "Insufficient resources",
  "27": "Missing or unknown APN",
  "28": "Unknown PDN type",
  "29": "User authentication failed",
  "30": "Request rejected by Serving GW or PDN GW",
  "31": "Request rejected, unspecified",
  "32": "Service option not supported",
  "33": "Requested service option not subscribed",
  "34": "Service option temporarily out of order",
  "35": "PTI already in use",
  "36": "Regular deactivation",
  "37": "EPS QoS not accepted",
  "38": "Network failure",
  "39": "Reactivation requested",
  "41": "Semantic error in the TFT operation",
  "42": "Syntactical error in the TFT operation",
  "43": "Invalid EPS bearer identity",
  "44": "Semantic errors in packet filter(s)",
  "45": "Syntactical errors in packet filter(s)",
  "46": "Unused (see NOTE 2)",
  "47": "PTI mismatch",
  "49": "Last PDN disconnection not allowed",
  "50": "PDN type IPv4 only allowed",
  "51": "PDN type IPv6 only allowed",
  "52": "Single address bearers only allowed",
  "53": "ESM information not received",
  "54": "PDN connection does not exist",
  "55": "Multiple PDN connections for a given APN not allowed",
  "56": "Collision with network initiated request",
  "57": "PDN type IPv4v6 only allowed",
  "58": "PDN type non IP only allowed",
  "59": "Unsupported QCI value",
  "60": "Bearer handling not supported",
  "61": "PDN type Ethernet only allowed",
  "65": "Maximum number of EPS bearers reached",
  "66": "Requested APN not supported in current RAT and PLMN combination",
  "81": "Invalid PTI value",
  "95": "Semantically incorrect message",
  "96": "Invalid mandatory information",
  "97": "Message type non-existent or not implemented",
  "98": "Message type not compatible with the protocol state",
  "99": "Information element non-existent or not implemented",
  "100": "Conditional IE error",
  "101": "Message not compatible with the protocol state",
  "111": "Protocol error, unspecified",
  "112": "APN restriction value incompatible with active EPS bearer context",
  "113": "Multiple accesses to a PDN connection not allowed",
};

export const NRMM_REJECT_CAUSE_MAP = {
  "0": "No cause",
  "3": "Illegal UE",
  "5": "PEI not accepted",
  "6": "Illegal ME",
  "7": "5GS services not allowed",
  "9": "UE identity cannot be derived by the network",
  "10": "Implicitly de-registered",
  "11": "PLMN not allowed",
  "12": "Tracking area not allowed",
  "13": "Roaming not allowed in this tracking area",
  "15": "No suitable cells in tracking area",
  "20": "MAC failure",
  "21": "Synch failure",
  "22": "Congestion",
  "23": "UE security capabilities mismatch",
  "24": "Security mode rejected, unspecified",
  "26": "Non-5G authentication unacceptable",
  "27": "N1 mode not allowed",
  "28": "Restricted service area",
  "31": "Redirection to EPC required",
  "43": "LADN not available",
  "62": "No network slices available",
  "65": "Maximum number of PDU sessions reached",
  "67": "Insufficient resources for specific slice and DNN",
  "69": "Insufficient resources for specific slice",
  "71": "ngKSI already in use",
  "72": "Non-3GPP access to 5GCN not allowed",
  "73": "Serving network not authorized",
  "74": "Temporarily not authorized for this SNPN",
  "75": "Permanently not authorized for this SNPN",
  "76": "Not authorized for this CAG or authorized for CAG cells only",
  "77": "Wireline access area not allowed",
  "78": "PLMN not allowed to operate at the present UE location",
  "79": "UAS services not allowed",
  "90": "Payload was not forwarded",
  "91": "DNN not supported or not subscribed in the slice",
  "92": "Insufficient user-plane resources for the PDU session",
  "95": "Semantically incorrect message",
  "96": "Invalid mandatory information",
  "97": "Message type non-existent or not implemented",
  "98": "Message type not compatible with the protocol state",
  "99": "Information element non-existent or not implemented",
  "100": "Conditional IE error",
  "101": "Message not compatible with the protocol state",
  "111": "Protocol error, unspecified",
}
// Bandwidth monitoring types
export interface BandwidthDataPoint {
  timestamp: string;
  download: number; // in bytes/second
  upload: number; // in bytes/second
}

export interface BandwidthData {
  timestamp: string;
  downloadSpeed: number; // in bytes/second
  uploadSpeed: number; // in bytes/second
  totalDownload: number; // total bytes downloaded
  totalUpload: number; // total bytes uploaded
  latency?: number; // in milliseconds
  signalStrength?: number; // in dBm
}

export interface BandwidthHistoryData {
  current: BandwidthDataPoint;
  history: BandwidthDataPoint[]; // 30-second rolling history
  averageDownloadSpeed: number;
  averageUploadSpeed: number;
  maxDownloadSpeed: number;
  maxUploadSpeed: number;
}

export interface WebSocketBandwidthMessage {
  type: 'bandwidth' | 'error' | 'status';
  data: BandwidthData | string;
}

// New multi-interface bandwidth monitoring types
export interface InterfaceTrafficStats {
  bytes_total: number;
  packets_total: number;
  bps: number; // bits per second
  packets_per_sec: number;
}

export interface NetworkInterfaceData {
  name: string;
  state: 'up' | 'down';
  rx: InterfaceTrafficStats;
  tx: InterfaceTrafficStats;
}

export interface MultiInterfaceBandwidthData {
  timestamp: number | string; // Unix timestamp in seconds or string format "YYYY-MM-DD HH:MM:SS"
  interval_seconds: number;
  interfaces: NetworkInterfaceData[];
}

// Tailscale Types
export interface TailscaleStatus {
  status: "success" | "error";
  installed: boolean;
  running: boolean;
  authenticated: boolean;
  login_url?: string;
  message: string;
  error?: string;
}

export interface TailscaleInstallResponse {
  status: "success" | "error";
  message: string;
  already_installed?: boolean;
  rebooting?: boolean;
  error?: string;
}

export interface TailscalePeer {
  ip: string;
  hostname: string;
  user: string;
  os: string;
  status: "online" | "offline";
}

export interface TailscalePeersResponse {
  status: "success" | "error";
  peers: TailscalePeer[];
  total: number;
  online: number;
  offline: number;
  message: string;
  error?: string;
}

export interface TailscaleDeviceDetails {
  hostname: string;
  tailscale_ip: string;
  dns_name: string;
  relay: string;
  backend_state: string;
  online: boolean;
  key_expiry: string;
}

export interface TailscaleNetworkInfo {
  tailnet_name: string;
  magic_dns_enabled: boolean;
  total_peers: number;
  online_peers: number;
}

export interface TailscaleDeviceDetailsResponse {
  status: "success" | "error";
  device: TailscaleDeviceDetails;
  network: TailscaleNetworkInfo;
  message: string;
  error?: string;
}

export interface TailscaleToggleResponse {
  status: "success" | "error";
  action: "up" | "down";
  message: string;
  rebooting?: boolean;
  error?: string;
}

export interface TailscaleUninstallResponse {
  status: "success" | "error";
  message: string;
  rebooting?: boolean;
  error?: string;
}
