import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HomeData } from "@/types/types";

interface BandTableProps {
  data: HomeData | null;
  isLoading: boolean;
}

const BandTable = ({ data, isLoading } : BandTableProps) => {
  return (
    <div>BandTable</div>
  )
}

export default BandTable