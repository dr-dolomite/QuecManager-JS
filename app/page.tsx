"use client"

import { cn } from "@/lib/utils"
import { InteractiveGridPattern } from "@/registry/magicui/interactive-grid-pattern"

import ChartPreviewSignal from "@/components/pages/chart-preview";
import { LightRays } from "@/components/ui/light-rays";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 relative overflow-hidden">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start ">
        <ChartPreviewSignal />
      </main>
            <InteractiveGridPattern
        className={cn(
          "[mask-image:radial-gradient(400px_circle_at_center,white,transparent)]",
          "inset-x-0 inset-y-[-30%] h-[200%] skew-y-12"
        )}
      />
    </div>
  );
}
