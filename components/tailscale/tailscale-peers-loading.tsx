import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const TailscalePeersLoading = () => {
  return (
    <div>
      <Skeleton className="h-96 w-full max-w-full" />
    </div>
  );
};

export default TailscalePeersLoading;
