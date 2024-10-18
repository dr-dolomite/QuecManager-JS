"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface SettingsPageProps {
  children: React.ReactNode;
}

const SettingsPage = ({ children }: SettingsPageProps) => {
  const currentPathName = usePathname();

  return (
    <>
      <div className="mx-auto grid w-full max-w-6xl gap-2">
        <h1 className="text-3xl font-semibold">Settings</h1>
      </div>
      <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
        <nav
          className="grid gap-4 text-sm text-muted-foreground"
          x-chunk="dashboard-04-chunk-0"
        >
          <Link href="#" className="font-semibold text-primary">
            General
          </Link>
          <Link href="#">Security</Link>
        </nav>
        {children}
      </div>
    </>
  );
};

export default SettingsPage;
