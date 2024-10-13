"use client";

import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HomeData, Band } from "@/types/types";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import BandCard from "./band-card";

interface BandTableProps {
  isLoading: boolean;
  bands: Band[] | null;
}

const BandTable = ({ bands, isLoading }: BandTableProps) => {
  if (isLoading) {
    return (
      <Card className="p-6 grid gap-4 bg-slate-950">
        <Card className="p-8">
          <div className="flex flex-row items-center gap-6 justify-between">
            <div className="grid gap-2">
              <h2 className="text-md font-bold">Band</h2>
              <p>
                <Skeleton className="w-16 h-4" />
              </p>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-bold">E/ARFCN</p>
              <p>
                <Skeleton className="w-16 h-4" />
              </p>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-bold">Bandwidth</p>
              <p>
                <Skeleton className="w-16 h-4" />
              </p>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-bold">PCI</p>
              <p>
                <Skeleton className="w-16 h-4" />
              </p>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-bold">RSRP</p>
              <p>
                <Skeleton className="w-24 h-4" />
              </p>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-bold">RSRQ</p>
              <p>
                <Skeleton className="w-24 h-4" />
              </p>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-bold">SINR</p>
              <p>
                <Skeleton className="w-24 h-4" />
              </p>
            </div>
          </div>
        </Card>
      </Card>
    );
  }

  return (
    <Card className="p-6 grid gap-4 bg-slate-950">
      {bands && (
        <SortableContext items={bands} strategy={verticalListSortingStrategy}>
          {bands.map((band: Band) => (
            <BandCard key={band.id} {...band} />
          ))}
        </SortableContext>
      )}
      <CardFooter className="w-full p-6 flex flex-col gap-1 items-center justify-center">
        <CardTitle className="text-lg font-bold">
          Drag and drop the LTE bands to change LTE Band priority.
        </CardTitle>
        <CardDescription className="text-sm italic">
          The bands will be saved automatically. This will not work with NR5G bands.
        </CardDescription>
      </CardFooter>

    </Card>
  );
};

export default BandTable;
