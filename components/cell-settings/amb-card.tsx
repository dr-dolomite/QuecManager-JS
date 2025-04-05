import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

interface AMBRCardProps {
  lteAMBR: string[];
  nr5gAMBR: string[];
}

// Helper function to format bit rate to Gbps, Mbps or Kbps
const formatBitRate = (value: string): string => {
  const bitRate = parseInt(value);
  if (isNaN(bitRate)) return "Unknown";

  // If greater than or equal to 1,000,000 Kbps (1000 Mbps), show as Gbps
  if (bitRate >= 1000000) {
    return `${(bitRate / 1000000).toFixed(2)} Gbps`;
  }

  // If greater than or equal to 1000 Kbps, show as Mbps
  if (bitRate >= 1000) {
    // Return as whole number. Round if needed
    return `${Math.round(bitRate / 1000)} Mbps`;
  }

  return `${bitRate} Kbps`;
};

const AMBRCard = ({ lteAMBR, nr5gAMBR }: AMBRCardProps) => {
  // Process LTE AMBR data - each APN has 3 consecutive values: [apn, download, upload]
  const lteProfiles = [];
  for (let i = 0; i < lteAMBR.length; i += 3) {
    if (i + 2 < lteAMBR.length) {
      lteProfiles.push({
        apn: lteAMBR[i],
        download: formatBitRate(lteAMBR[i + 1]),
        upload: formatBitRate(lteAMBR[i + 2]),
      });
    }
  }

  // Process NR5G AMBR data - each APN has 3 consecutive values: [apn, download, upload]
  const nr5gProfiles = [];
  for (let i = 0; i < nr5gAMBR.length; i += 3) {
    if (i + 2 < nr5gAMBR.length) {
      nr5gProfiles.push({
        apn: nr5gAMBR[i],
        download: formatBitRate(nr5gAMBR[i + 1]),
        upload: formatBitRate(nr5gAMBR[i + 2]),
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aggregate Maximum Bit Rate (AMBR)</CardTitle>
        <CardDescription>
          The Aggregate Maximum Bit Rate (AMBR) is a parameter that defines the
          maximum data rate that can be allocated to a user equipment (UE) in a
          mobile network.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {/* LTE AMBR Section */}
          {lteProfiles.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-2">LTE AMBR</h3>
              <div className="flex flex-col gap-2">
                {lteProfiles.map((profile, index) => (
                  <div
                    key={`lte-${index}`}
                    className="flex items-center justify-between border-b pb-2"
                  >
                    <span className="text-sm font-medium">{profile.apn}</span>
                    <span className="text-sm text-gray-500 font-semibold">
                      {profile.download} DL / {profile.upload} UL
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NR5G AMBR Section */}
          {nr5gProfiles.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-2">NR5G AMBR</h3>
              <div className="flex flex-col gap-2">
                {nr5gProfiles.map((profile, index) => (
                  <div
                    key={`nr5g-${index}`}
                    className="flex items-center justify-between border-b pb-2"
                  >
                    <span className="text-sm font-medium">{profile.apn}</span>
                    <span className="text-sm text-gray-500 font-semibold">
                      {profile.download} DL / {profile.upload} UL
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No data case */}
          {lteProfiles.length === 0 && nr5gProfiles.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              No AMBR information available
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <CardDescription>
          AMBR (Aggregate Maximum Bit Rate) is a network-enforced limit that
          caps the total bandwidth for non-priority data traffic (e.g., internet
          browsing) on LTE/5G connections. While devices can request specific
          AMBR values, operators may ignore these and enforce their own speed
          limits based on subscription plans, network policies, or congestion
          conditions.
        </CardDescription>
      </CardFooter>
    </Card>
  );
};

export default AMBRCard;
