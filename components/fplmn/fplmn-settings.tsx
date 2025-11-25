"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import { atCommandSender } from "@/utils/at-command";

const CLEAN_FPLMN = "FFFFFFFFFFFFFFFFFFFFFFFF";

const FPLMNSettingsComponent = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [fplmnData, setFplmnData] = useState<string>("");
  const [needsClearing, setNeedsClearing] = useState(false);

  // Check FPLMN list
  const checkFPLMN = async () => {
    setIsLoading(true);
    try {
      // Send AT+CRSM command to read FPLMN data
      const response = await atCommandSender("AT+CRSM=176,28539,0,0,12");

      if (response.status === "error") {
        throw new Error("Failed to read FPLMN list");
      }

      // Extract the data from response
      // Expected format: +CRSM: 144,0,"FFFFFFFFFFFFFFFFFFFFFFFF"
      const lines = response.response.split("\n");
      const crsmLine = lines.find((line) => line.includes("+CRSM:"));

      if (!crsmLine) {
        throw new Error("Invalid response format");
      }

      // Extract the hex data from quotes
      const match = crsmLine.match(/"([A-F0-9]+)"/);
      if (!match || !match[1]) {
        throw new Error("Could not extract FPLMN data");
      }

      const hexData = match[1];
      setFplmnData(hexData);

      // Check if it needs clearing (anything other than 24 Fs)
      const needsClear = hexData !== CLEAN_FPLMN;
      setNeedsClearing(needsClear);

      toast({
        title: needsClear ? "FPLMN List Needs Clearing" : "FPLMN List is Clean",
        description: needsClear
          ? "The forbidden network list contains entries and should be cleared."
          : "The forbidden network list is already clear.",
        variant: needsClear ? "default" : "default",
      });
    } catch (error) {
      console.error("Error checking FPLMN:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to check FPLMN list",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Clear FPLMN list
  const clearFPLMN = async () => {
    setIsClearing(true);
    try {
      // Send AT+CRSM command to write clean FPLMN data
      const response = await atCommandSender(
        `AT+CRSM=214,28539,0,0,12,"${CLEAN_FPLMN}"`
      );

      if (response.status === "error") {
        throw new Error("Failed to clear FPLMN list");
      }

      // Check if the response indicates success
      const lines = response.response.split("\n");
      const crsmLine = lines.find((line) => line.includes("+CRSM:"));

      if (!crsmLine || !crsmLine.includes("144,0")) {
        throw new Error("Clear operation returned unexpected response");
      }

      toast({
        title: "Success",
        description: "FPLMN list has been cleared successfully.",
      });

      // Refresh the status
      await checkFPLMN();
    } catch (error) {
      console.error("Error clearing FPLMN:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to clear FPLMN list",
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Check FPLMN on component mount
  useEffect(() => {
    checkFPLMN();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">FPLMN Settings</h1>
        <p className="text-muted-foreground">
          Check the FPLMN (forbidden network) list on your device to see if it
          requires clearing for optimal network performance.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>FPLMN Status</CardTitle>
          <CardDescription>
            The FPLMN list stores networks that your device has been unable to
            connect to. Clearing this list may improve network connectivity and
            roaming performance.
            <a
              href="https://onomondo.com/blog/how-to-clear-the-fplmn-list-on-a-sim/"
              target="_blank"
              rel="noreferrer"
              className="underline ml-1"
            >
              Learn more
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-4 border rounded-lg">
                  {needsClearing ? (
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold">
                      {needsClearing
                        ? "FPLMN List Contains Entries"
                        : "FPLMN List is Clean"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {needsClearing
                        ? "The forbidden network list should be cleared for optimal performance."
                        : "The forbidden network list is empty and does not need clearing."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 justify-end">
                <Button
                  variant="destructive"
                  onClick={clearFPLMN}
                  disabled={isLoading || isClearing || !needsClearing}
                >
                  <Trash2 className="h-4 w-4" />
                  {isClearing ? "Clearing..." : "Clear FPLMN List"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={checkFPLMN}
                  disabled={isLoading || isClearing}
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FPLMNSettingsComponent;
