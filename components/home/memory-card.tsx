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
        const response = await fetch('http://192.168.224.1/cgi-bin/home/memory.sh', {
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
        
        // Remove initial load state after first successful fetch
        if (isInitialLoad) {
          setIsInitialLoad(false);
        }
      } catch (err) {
        console.error('Failed to fetch memory information');
        
        // Ensure initial load state is removed even on error
        if (isInitialLoad) {
          setIsInitialLoad(false);
        }
      }
    };

    // Fetch immediately
    fetchMemoryInfo();

    // Then set up interval to fetch every 2 seconds
    const intervalId = setInterval(fetchMemoryInfo, 2000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [isInitialLoad]);

  // Loading skeleton for initial load
  if (isInitialLoad) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Memory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-3 grid-cols-2 grid-flow-row gap-4 col-span-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="grid gap-1">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Memory</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-3 grid-cols-2 grid-flow-row gap-4 col-span-3">
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-base font-bold">
              {formatMemory(memoryData.total)}
            </span>
          </div>

          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Used</span>
            <span className="text-base font-bold">
              {formatMemory(memoryData.used)}
            </span>
          </div>

          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Available</span>
            <span className="text-base font-bold">
              {formatMemory(memoryData.available)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemoryCard;