"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/auth";
import { ProtectedRoute } from "@/components/hoc/protected-route";
import * as React from "react";
import {
  ContactRound,
  EthernetPort,
  FlaskConical,
  Home,
  PanelLeft,
  Pyramid,
  RadioTower,
  Search,
  Settings,
  SignalHigh,
  User2Icon,
  Menu,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const description =
  "An Cellular Settings dashboard with a sidebar navigation. The sidebar has icon navigation. The content area has a breadcrumb and search in the header. The main area has a list of recent Cellular Settings with a filter and export button. The main area also has a detailed view of a single order with order details, shipping information, billing information, customer information, and payment information.";

import { usePathname } from "next/navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const currentPathName = usePathname();
  const { logout } = useAuth();
  const { setTheme } = useTheme();

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="/dashboard/home/"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <RadioTower className="h-6 w-6" />
            <span className="sr-only">QuecManager</span>
          </Link>
          <Link
            href="/dashboard/home/"
            className={`${
              currentPathName === "/dashboard/home/"
                ? "text-foreground"
                : "text-muted-foreground"
            } transition-colors hover:text-foreground`}
          >
            Home
          </Link>
          <Link
            href="/dashboard/cell-settings/"
            className={`${
              currentPathName === "/dashboard/cell-settings/"
                ? "text-foreground"
                : "text-muted-foreground"
            } transition-colors hover:text-foreground`}
          >
            Cellular
          </Link>
          <Link
            href="/dashboard/advanced-settings/"
            className={`${
              currentPathName === "/dashboard/advanced-settings/"
                ? "text-foreground"
                : "text-muted-foreground"
            } transition-colors hover:text-foreground`}
          >
            Advance
          </Link>
          <Link
            href="/dashboard/experimental/"
            className={`${
              currentPathName === "/dashboard/experimental/"
                ? "text-foreground"
                : "text-muted-foreground"
            } transition-colors hover:text-foreground`}
          >
            Experimental
          </Link>
          <Link
            href="/dashboard/about/"
            className={`${
              currentPathName === "/dashboard/about/"
                ? "text-foreground"
                : "text-muted-foreground"
            } transition-colors hover:text-foreground`}
          >
            About
          </Link>
        </nav>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <nav className="grid gap-6 text-lg font-medium">
              <Link
                href="/dashboard/home/"
                className="flex items-center gap-2 text-lg font-semibold"
              >
                <RadioTower className="h-6 w-6" />
                <span className="sr-only">QuecManager</span>
              </Link>
              <Link
                href="/dashboard/home/"
                className="text-muted-foreground hover:text-foreground"
              >
                Home
              </Link>
              <Link
                href="/dashboard/cell-settings/"
                className="text-muted-foreground hover:text-foreground"
              >
                Cellular
              </Link>
              <Link
                href="/dashboard/advanced-settings/"
                className="text-muted-foreground hover:text-foreground"
              >
                Advance
              </Link>
              <Link
                href="/dashboard/experimental/"
                className="text-muted-foreground hover:text-foreground"
              >
                Experimental
              </Link>
              <Link
                href="/dashboard/about/"
                className="text-muted-foreground hover:text-foreground"
              >
                About
              </Link>
              <Link href="/dashboard/settings/general" className="hover:text-foreground">
                Settings
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <form className="ml-auto flex-1 sm:flex-initial">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </form>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <User2Icon className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings/general">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
        <ProtectedRoute>{children}</ProtectedRoute>
      </main>
    </div>
  );
};

export default DashboardLayout;
