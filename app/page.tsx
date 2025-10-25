"use client";

import ChartPreviewSignal from "@/components/pages/chart-preview";
import { LightRays } from "@/components/ui/light-rays";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen mx-auto">
      <main className="flex items-center justify-center mx-auto">
        <ChartPreviewSignal />
      </main>
      <LightRays />
    </div>
  );
}
