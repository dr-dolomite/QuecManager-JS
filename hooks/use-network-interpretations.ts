import { useState, useEffect, useCallback } from "react";

export interface NetworkInterpretation {
  datetime: string;
  interpretation: string;
}

export const useNetworkInterpretations = (autoRefreshInterval = 30000) => {
  const [interpretations, setInterpretations] = useState<
    NetworkInterpretation[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchInterpretations = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(
        "/cgi-bin/quecmanager/experimental/fetch_interpretations.sh",
        {
          cache: "no-cache",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: Failed to fetch interpretations`
        );
      }

      const data = await response.json();

      const interpretationArray = Array.isArray(data) ? data : [];

      setInterpretations(interpretationArray);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Failed to fetch interpretations:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterpretations();

    if (autoRefreshInterval > 0) {
      const interval = setInterval(fetchInterpretations, autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchInterpretations, autoRefreshInterval]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchInterpretations();
  }, [fetchInterpretations]);

  return {
    interpretations,
    loading,
    error,
    lastUpdate,
    refresh,
  };
};
