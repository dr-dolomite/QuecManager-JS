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
            href="/dashboard/experimental/user-alerts"
            className={`${
              currentPathName === "/dashboard/experimental/user-alerts/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Monitoring Alerts
          </Link>
          <Link
            href="/dashboard/experimental/tailscale-settings"
            className={`${
              currentPathName === "/dashboard/experimental/tailscale-settings/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Tailscale Settings
          </Link>
          <Link
            href="/dashboard/experimental/custom-dns"
            className={`${
              currentPathName === "/dashboard/experimental/custom-dns/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Custom DNS
          </Link>
                    <Link
            href="/dashboard/experimental/fplmn-settings"
            className={`${
              currentPathName === "/dashboard/experimental/fplmn-settings/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            FLPMN Settings
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

export default ExperimentalLayout;
