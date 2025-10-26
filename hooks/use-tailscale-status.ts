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
        throw new Error(data.error || "Failed to fetch Tailscale status");
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
