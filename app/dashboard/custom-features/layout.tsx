"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface CustomFeaturesLayoutProps {
  children: React.ReactNode;
}

const CustomFeaturesLayout = ({ children }: CustomFeaturesLayoutProps) => {
  const currentPathName = usePathname();

  return (
    <>
      <div className="mx-auto grid w-full max-w-6xl gap-2">
        <h1 className="text-3xl font-semibold">Custom Features</h1>
      </div>
      <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
        <nav
          className="grid gap-4 text-sm text-muted-foreground"
          x-chunk="dashboard-04-chunk-0"
        >
          <Link
            href="/dashboard/custom-features/quecwatch"
            className={`${
              currentPathName === "/dashboard/custom-features/quecwatch/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            QuecWatch
          </Link>
          <Link
            href="/dashboard/custom-features/quecprofiles"
            className={`${
              currentPathName === "/dashboard/custom-features/quecprofiles/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            QuecProfiles
          </Link>
          <Link
            href="/dashboard/custom-features/cell-scanner"
            className={`${
              currentPathName === "/dashboard/custom-features/cell-scanner/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Cell Scanner
          </Link>
          <Link
            href="/dashboard/custom-features/frequency-calculator"
            className={`${
              currentPathName ===
              "/dashboard/custom-features/frequency-calculator/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Frequency Calculator
          </Link>
        </nav>
        {children}
      </div>
    </>
  );
};

export default CustomFeaturesLayout;
