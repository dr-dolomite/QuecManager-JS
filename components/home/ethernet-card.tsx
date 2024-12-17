import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface EthernetData {
  link_status: string;
  link_speed: string;
  auto_negotiation: string;
}

const EthernetCard = () => {
  const [ethernetData, setEthernetData] = useState<EthernetData>({
    link_status: "Loading...",
    link_speed: "Loading...",
    auto_negotiation: "Loading...",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEthernetInfo = async () => {
      try {
        const response = await fetch(
          "http://192.168.224.1/cgi-bin/home/ethtool.sh",
          {
            method: "GET",
            cache: "no-store", // Disable caching to get fresh data
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data: EthernetData = await response.json();
        setEthernetData(data);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to fetch Ethernet information");
        setIsLoading(false);
      }
    };

    fetchEthernetInfo();
  }, []);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ethernet</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <div className="text-red-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ethernet</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-3 grid-cols-2 grid-flow-row gap-4 col-span-3">
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Link Status</span>
            <span className="text-base font-bold">
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : ethernetData.link_status === "yes" ? (
                "Active"
              ) : (
                "Inactive"
              )}
            </span>
          </div>

          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Link Speed</span>
            <span className="text-base font-bold">
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                ethernetData.link_speed
              )}
            </span>
          </div>

          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">
              Auto-negotiation
            </span>
            <span className="text-base font-bold">
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : ethernetData.auto_negotiation === "on" ? (
                "Active"
              ) : (
                "Inactive"
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EthernetCard;
