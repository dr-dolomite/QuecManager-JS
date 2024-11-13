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
        <h1 className="text-3xl font-semibold">Cellular Settings</h1>
      </div>
      <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
        <nav
          className="grid gap-4 text-sm text-muted-foreground"
          x-chunk="dashboard-04-chunk-0"
        >
          <Link href="/dashboard/cell-settings/basic-settings" className={`${currentPathName === "/dashboard/cell-settings/basic-settings/" ? "font-semibold text-primary" : 'text-sm'}`}>
            Basic Settings
          </Link>
          <Link href="/dashboard/cell-settings/band-locking" className={`${currentPathName === "/dashboard/cell-settings/band-locking/" ? "font-semibold text-primary" : 'text-sm'}`}>
          Band Locking
          </Link>
          <Link href="/dashboard/cell-settings/cell-locking" className={`${currentPathName === "/dashboard/cell-settings/cell-locking/" ? "font-semibold text-primary" : 'text-sm'}`}>
          Cellular Locking
          </Link>
          <Link href="/dashboard/cell-settings/imei-mangling" className={`${currentPathName === "/dashboard/cell-settings/imei-mangling/" ? "font-semibold text-primary" : 'text-sm'}`}>
          IMEI Mangling
          </Link>
          <Link href="/dashboard/cell-settings/sms" className={`${currentPathName === "/dashboard/cell-settings/sms/" ? "font-semibold text-primary" : 'text-sm'}`}>
          SMS Inbox
          </Link>
        </nav>
        {children}
      </div>
    </>
  );
};

export default CellSettingsLayout;
