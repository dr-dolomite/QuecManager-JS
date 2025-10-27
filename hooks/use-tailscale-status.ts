import { useState, useEffect } from "react";
import { TailscaleStatus } from "@/types/types";
import { useToast } from "@/hooks/use-toast";

interface UseTailscaleStatusReturn {
  status: TailscaleStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useTailscaleStatus = (): UseTailscaleStatusReturn => {
  const { toast } = useToast();
  const [status, setStatus] = useState<TailscaleStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/cgi-bin/quecmanager/tailscale/status.sh");

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: TailscaleStatus = await response.json();

      if (data.status === "error") {
        // Handle specific error types
        if (data.error === "no_internet") {
          setError("Device has no internet connection");
          setStatus(null);
          toast({
            title: "No Internet Connection",
            description: "Tailscale requires internet access to authenticate and connect.",
            duration: 5000,
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(data.message || "Failed to fetch Tailscale status");
      }

      setStatus(data);
      toast({
        title: "Tailscale Status",
        description: "Successfully fetched Tailscale status.",
        duration: 3000,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch Tailscale status";
      setError(errorMessage);
      toast({
        title: "Tailscale Status",
        description: `${errorMessage}`,
        duration: 3000,
        variant: "destructive",
      });

      console.error("Error fetching Tailscale status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return {
    status,
    isLoading,
    error,
    refetch: fetchStatus,
  };
};
