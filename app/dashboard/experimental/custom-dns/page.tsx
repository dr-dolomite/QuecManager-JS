"use client";

import DNSCard from "@/components/pages/dns-card";
import React, { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const CustomDNSComponent = () => {
  const [passthrough, setPassthrough] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Parse the AT command response array to extract passthrough setting
  const parsePassthroughSetting = (data: any[]): string | null => {
    // Find the MPDN_rule command response
    const mpdnCommand = data.find(
      (item) =>
        item.command?.includes("MPDN_RULE") ||
        item.command?.includes("MPDN_rule")
    );

    if (!mpdnCommand || !mpdnCommand.response) {
      return "disabled";
    }

    const response = mpdnCommand.response;

    // Look for the first non-zero MPDN_rule (rules 0-3, we want the first active one)
    const lines = response.split("\n");
    for (const line of lines) {
      const match = line.match(
        /\+QMAP:\s*"MPDN_rule",(\d+),(\d+),(\d+),(\d+),(\d+)/
      );
      if (match) {
        const [_, ruleIndex, enabled, pdnIndex, interfaceType, ipType] =
          match.map(Number);

        // If enabled is 1, this rule is active
        if (enabled === 1) {
          // Interface type: 1 = ETH, 3 = USB
          return interfaceType === 1 ? "ETH" : "USB";
        }
      }
    }

    return "disabled";
  };

  useEffect(() => {
    const fetchPassthroughSetting = async () => {
      try {
        const response = await fetch(
          "/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=4"
        );
        const data = await response.json();

        const passthroughValue = parsePassthroughSetting(data);

        setPassthrough(passthroughValue);
      } catch (err) {
        console.error("Failed to fetch passthrough setting:", err);
        setPassthrough("disabled"); // Default to disabled on error
      } finally {
        setLoading(false);
      }
    };

    fetchPassthroughSetting();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">DNS Settings</h1>
          <p className="text-muted-foreground">
            Configure custom DNS settings for your device to enhance network
            performance and security.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Custom DNS Settings</CardTitle>
            <CardDescription>
              Configure custom DNS servers for your network
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DNSCard passthrough={passthrough} />;
};

export default CustomDNSComponent;
