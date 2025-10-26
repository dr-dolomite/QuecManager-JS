import { useState, useEffect } from "react";
import { TailscalePeersResponse } from "@/types/types";
import { useToast } from "@/hooks/use-toast";

interface UseTailscalePeersReturn {
  peers: TailscalePeersResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useTailscalePeers = (): UseTailscalePeersReturn => {
  const { toast } = useToast();
  const [peers, setPeers] = useState<TailscalePeersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPeers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/cgi-bin/quecmanager/tailscale/fetch-peers.sh");

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: TailscalePeersResponse = await response.json();

      // Log the full response for debugging
      console.log("Tailscale Peers Response:", JSON.stringify(data, null, 2));

      if (data.status === "error") {
        throw new Error(data.error || "Failed to fetch Tailscale peers");
      }

      setPeers(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch Tailscale peers";
      setError(errorMessage);
      toast({
        title: "Tailscale Peers",
        description: `${errorMessage}`,
        duration: 3000,
        variant: "destructive",
      });

      console.error("Error fetching Tailscale peers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPeers();
  }, []);

  return {
    peers,
    isLoading,
    error,
    refetch: fetchPeers,
  };
};
