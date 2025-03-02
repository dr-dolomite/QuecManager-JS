"use client";
import { useState, useEffect, useCallback } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { useIMEIConfig } from "@/hooks/imei-config";
import { atCommandSender } from "@/utils/at-command";

interface IMEIProfile {
  imei: string;
  iccid: string;
}

interface IMEIProfileFormData {
  profile1: IMEIProfile;
  profile2: IMEIProfile;
}

const INITIAL_PROFILE_STATE: IMEIProfile = {
  imei: "",
  iccid: "",
};

const INITIAL_FORM_STATE: IMEIProfileFormData = {
  profile1: { ...INITIAL_PROFILE_STATE },
  profile2: { ...INITIAL_PROFILE_STATE },
};

const IMEIManglingPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentIMEI, setCurrentIMEI] = useState("");
  const [newIMEI, setNewIMEI] = useState("");
  const { toast } = useToast();

  const fetchIMEI = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=3"
      );
      const rawData = await response.json();

      console.log(rawData);
      // Use the 6th index to get the IMEI
      const rawResult = rawData[6].response.split("\n")[1];
      console.log(rawResult);
      // Regex to match IMEI in a response format
      const imeiMatch = rawResult.match(/\d{15}/);
      const imei = imeiMatch ? imeiMatch[0] : null;

      if (imei) {
        setCurrentIMEI(imei);
        setNewIMEI(imei);
      } else {
        throw new Error("IMEI not found in response");
      }
    } catch (err) {
      toast({
        title: "Failed to fetch IMEI",
        description: "Failed to fetch IMEI from the device",
        variant: "destructive",
      });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // First effect just for fetching IMEI
  useEffect(() => {
    fetchIMEI();
  }, []); // No dependencies needed since fetchIMEI is stable

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Add checker for the new IMEI if it's valid (must be 15 digits and numbers only)
    if (newIMEI.length !== 15 || isNaN(Number(newIMEI))) {
      toast({
        title: "Invalid IMEI",
        description: "IMEI must be 15 digits and numbers only",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Use atCommandSender instead of direct fetch
      const command = `AT+EGMR=1,7,"${newIMEI}"`;
      const result = await atCommandSender(command, true);

      if (result.response?.status !== "success") {
        throw new Error(result.response?.raw_output || "Failed to update IMEI");
      }

      // If IMEI update successful, reboot the device
      const rebootResult = await atCommandSender("AT+QPOWD=1", true);

      if (rebootResult.response?.status !== "success") {
        throw new Error(
          rebootResult.response?.raw_output || "Failed to reboot device"
        );
      }

      toast({
        title: "Success",
        description: "IMEI has been updated successfully. Rebooting...",
        duration: 90000,
      });

      // After 90 seconds, refresh the page to show the new IMEI
      setTimeout(() => {
        window.location.reload();
      }, 90000);
    } catch (err) {
      toast({
        title: "Failed to update IMEI",
        description: "Failed to update IMEI on the device",
        variant: "destructive",
      });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-8">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>IMEI Mangling</CardTitle>
            <CardDescription className="flex items-center justify-between">
              Change the IMEI of the device.
              <span className="flex items-center text-orange-500">
                <TriangleAlert className="size-4 mr-1" />
                Do at your own risk!
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="IMEI">Change Current IMEI</Label>
              {isLoading ? (
                <Skeleton className="h-8" />
              ) : (
                <div className="grid gap-1.5">
                  <Input
                    type="text"
                    id="IMEI"
                    value={newIMEI}
                    onChange={(e) => setNewIMEI(e.target.value)}
                    placeholder={currentIMEI}
                  />
                  <p className="text-xs text-muted-foreground font-medium">
                    This will reboot the device.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="grid border-t py-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || newIMEI === currentIMEI}
            >
              {isLoading ? "Processing..." : "Change IMEI"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default IMEIManglingPage;
