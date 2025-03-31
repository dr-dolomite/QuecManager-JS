import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BsMemory } from "react-icons/bs";
import { Skeleton } from "@/components/ui/skeleton";

interface MemoryData {
  total: number;
  used: number;
  available: number;
}

const formatMemory = (bytes: number) => {
  const megabytes = bytes / (1024 * 1024);
  return `${Math.round(megabytes)} MB`;
};

const MemoryCard = () => {
  const [memoryData, setMemoryData] = useState<MemoryData>({
    total: 0,
    used: 0,
    available: 0
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const fetchMemoryInfo = async () => {
      try {
        const response = await fetch('/api/cgi-bin/quecmanager/home/fetch_hw_details.sh?type=memory', {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data: MemoryData = await response.json();
        setMemoryData(data);
        
        if (isInitialLoad) {
          setIsInitialLoad(false);
        }
      } catch (err) {
        console.error('Failed to fetch memory information');
        
        if (isInitialLoad) {
          setIsInitialLoad(false);
        }
      }
    };

    fetchMemoryInfo();
    const intervalId = setInterval(fetchMemoryInfo, 2000);
    return () => clearInterval(intervalId);
  }, [isInitialLoad]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Memory</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-3 grid-cols-2 grid-flow-row gap-4 col-span-3">
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Total</span>
            {isInitialLoad ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <span className="text-base font-bold">
                {formatMemory(memoryData.total)}
              </span>
            )}
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Used</span>
            {isInitialLoad ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <span className="text-base font-bold">
                {formatMemory(memoryData.used)}
              </span>
            )}
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Available</span>
            {isInitialLoad ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <span className="text-base font-bold">
                {formatMemory(memoryData.available)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemoryCard;