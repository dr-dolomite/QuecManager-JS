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
        <h1 className="text-3xl font-semibold">Advanced Settings</h1>
      </div>
      <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
        <nav
          className="grid gap-4 text-sm text-muted-foreground"
          x-chunk="dashboard-04-chunk-0"
        >
          <Link
            href="/dashboard/advanced-settings/connectivity"
            className={`${
              currentPathName === "/dashboard/advanced-settings/connectivity/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Connectivity
          </Link>
          <Link
            href="/dashboard/advanced-settings/ttl-settings"
            className={`${
              currentPathName === "/dashboard/advanced-settings/ttl-settings/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            TTL Settings
          </Link>
          <Link
            href="/dashboard/advanced-settings/mtu"
            className={`${
              currentPathName === "/dashboard/advanced-settings/mtu/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            MTU Settings
          </Link>
                    <Link
            href="/dashboard/advanced-settings/scheduled-reboot"
            className={`${
              currentPathName === "/dashboard/advanced-settings/scheduled-reboot/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            Scheduled Reboot
          </Link>
          <Link
            href="/dashboard/advanced-settings/at-terminal"
            className={`${
              currentPathName === "/dashboard/advanced-settings/at-terminal/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            AT Terminal
          </Link>
          <Link
            href="/dashboard/advanced-settings/at-commands"
            className={`${
              currentPathName === "/dashboard/advanced-settings/at-commands/"
                ? "font-semibold text-primary"
                : "text-sm"
            }`}
          >
            AT Commands
          </Link>
        </nav>
        {children}
      </div>
    </>
  );
};

export default CellSettingsLayout;
