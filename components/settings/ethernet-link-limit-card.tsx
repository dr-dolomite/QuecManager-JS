"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import GithubButtonToast from "@/components/github-button";

interface EthLinkLimitResponse {
  success: boolean;
  currentLimit: string;
  actualSpeed?: string;
  error?: string;
  message?: string;
}

const EthernetLinkLimitCard = () => {
  const { toast } = useToast();
  const [ethLinkLimit, setEthLinkLimit] = useState<string>("auto");
  const [initialEthLinkLimit, setInitialEthLinkLimit] = useState<string>("auto");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current Ethernet Link Limit settings
  const fetchEthLinkLimit = async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/advance/eth_link_limit.sh",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) throw new Error("Failed to fetch");

      const data: EthLinkLimitResponse = await response.json();
      if (data.success) {
        setEthLinkLimit(data.currentLimit || "auto");
        setInitialEthLinkLimit(data.currentLimit || "auto");
      }
    } catch (err) {
      console.error("Failed to fetch eth link limit:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch Ethernet link limit settings",
        action: <GithubButtonToast />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save Ethernet Link Limit
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/advance/eth_link_limit.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ limit: ethLinkLimit }),
        }
      );

      const data: EthLinkLimitResponse = await response.json();

      if (data.success) {
        setInitialEthLinkLimit(ethLinkLimit);
        toast({
          title: "Success",
          description: `Ethernet link limit set to ${
            ethLinkLimit === "auto" ? "Auto" : ethLinkLimit + " Mbps"
          }`,
        });
      } else {
        throw new Error(data.error || "Failed to save");
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Failed to save Ethernet link limit",
        action: <GithubButtonToast />,
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchEthLinkLimit();
  }, []);

  const hasChanges = ethLinkLimit !== initialEthLinkLimit;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ethernet Link Limit</CardTitle>
        <CardDescription>
          Limit the maximum negotiated Ethernet link speed. Useful for
          compatibility with older network equipment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full max-w-sm items-center gap-2">
          <Label htmlFor="ethLinkLimit">Maximum Link Speed</Label>
          {isLoading ? (
            <Skeleton className="w-full h-8" />
          ) : (
            <Select
              onValueChange={(value) => setEthLinkLimit(value)}
              value={ethLinkLimit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select maximum link speed" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Link Speed Limit</SelectLabel>
                  <SelectItem value="auto">Auto (No Limit)</SelectItem>
                  <SelectItem value="10">10 Mbps</SelectItem>
                  <SelectItem value="100">10/100 Mbps</SelectItem>
                  <SelectItem value="1000">10/100/1000 Mbps</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
      <CardFooter className="grid border-t py-4">
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? "Saving..." : "Apply"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EthernetLinkLimitCard;
