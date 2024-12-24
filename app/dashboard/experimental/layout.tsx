"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface CellSettingsLayoutProps {
  children: React.ReactNode;
}

const CellSettingsLayout = ({ children }: CellSettingsLayoutProps) => {
  const currentPathName = usePathname();

  return (
    <>
      <div className="mx-auto grid w-full max-w-6xl gap-2">
        <h1 className="text-3xl font-semibold">Experimental</h1>
      </div>
      <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
        <nav
          className="grid gap-4 text-sm text-muted-foreground"
          x-chunk="dashboard-04-chunk-0"
        >
          {/* <Link href="/dashboard/experimental/speedtest" className={`${currentPathName === "/dashboard/experimental/speedtest/" ? "font-semibold text-primary" : 'text-sm'}`}>
            Speedtest
          </Link> */}
          <Link
            href="/dashboard/experimental/quecwatch"
            className={`${
              currentPathName === "/dashboard/experimental/quecwatch/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            QuecWatch
          </Link>
          <Link
            href="/dashboard/experimental/keep-alive"
            className={`${
              currentPathName === "/dashboard/experimental/keep-alive/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Keep Alive
          </Link>
        </nav>
        {children}
      </div>
    </>
  );
};

export default CellSettingsLayout;
