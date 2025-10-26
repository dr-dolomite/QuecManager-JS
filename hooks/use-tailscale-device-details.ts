import { useState, useEffect } from "react";
import { TailscaleDeviceDetailsResponse } from "@/types/types";
import { useToast } from "@/hooks/use-toast";

interface UseTailscaleDeviceDetailsReturn {
  deviceDetails: TailscaleDeviceDetailsResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useTailscaleDeviceDetails = (): UseTailscaleDeviceDetailsReturn => {
  const { toast } = useToast();
  const [deviceDetails, setDeviceDetails] = useState<TailscaleDeviceDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeviceDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/cgi-bin/quecmanager/tailscale/device-details.sh");


      if (!response.ok) {
        // Try to get error details from response
        let errorDetail = `HTTP error! Status: ${response.status}`;
        try {
          const text = await response.text();
          errorDetail += ` - ${text.substring(0, 100)}`;
        } catch (e) {
          // Ignore text parsing errors
        }
        throw new Error(errorDetail);
      }

      const text = await response.text();
      
      const data: TailscaleDeviceDetailsResponse = JSON.parse(text);

      if (data.status === "error") {
        throw new Error(data.error || "Failed to fetch device details");
      }

      setDeviceDetails(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch device details";
      setError(errorMessage);
      toast({
        title: "Tailscale Device Details",
        description: `${errorMessage}`,
        duration: 3000,
        variant: "destructive",
      });

      console.error("Error fetching Tailscale device details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceDetails();
  }, []);

  return {
    deviceDetails,
    isLoading,
    error,
    refetch: fetchDeviceDetails,
  };
};
