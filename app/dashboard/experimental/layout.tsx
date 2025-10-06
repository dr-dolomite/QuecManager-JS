"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface ExperimentalLayoutProps {
  children: React.ReactNode;
}

const ExperimentalLayout = ({ children }: ExperimentalLayoutProps) => {
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
          <Link
            href="/dashboard/experimental/network-priority"
            className={`${
              currentPathName === "/dashboard/experimental/network-priority/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Network Priority
          </Link>
          <Link
            href="/dashboard/experimental/network-insights"
            className={`${
              currentPathName === "/dashboard/experimental/network-insights/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Network Insights
          </Link>
          <Link
            href="/dashboard/experimental/internet-quality"
            className={`${
              currentPathName === "/dashboard/experimental/internet-quality/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Internet Quality
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
          <Link
            href="/dashboard/experimental/scheduled-reboot"
            className={`${
              currentPathName === "/dashboard/experimental/scheduled-reboot/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Scheduled Reboot
          </Link>
          <Link
            href="/dashboard/experimental/logs"
            className={`${
              currentPathName === "/dashboard/experimental/logs/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Logs
          </Link>
          {/* <Link
            href="/dashboard/experimental/data-usage-tracking"
            className={`${
              currentPathName === "/dashboard/experimental/data-usage-tracking/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Data Usage Tracking
          </Link> */}
        </nav>
        {children}
      </div>
    </>
  );
};

export default ExperimentalLayout;
