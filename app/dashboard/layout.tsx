"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/auth";
import { ProtectedRoute } from "@/components/hoc/protected-route";
import * as React from "react";
import { useState, useEffect } from "react";
import { RadioTower, User2Icon, Menu, Power } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { usePathname } from "next/navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface IpResponse {
  br_lan_ip: string;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const currentPathName = usePathname();
  const { logout } = useAuth();
  const { setTheme } = useTheme();
  const [isRebooting, setIsRebooting] = useState(false);
  const [luciIp, setLuciIp] = useState("192.168.224.1");
  const toast = useToast();

  // API calls should be moved to a separate service/utility file
  const atCommandSender = async (command: string) => {
    try {
      const encodedCommand = encodeURIComponent(command);
      // Add error handling
      const response = await fetch("/cgi-bin/atinout_handler.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // body: JSON.stringify({ command }),
        body: `command=${encodedCommand}`,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error("AT Command error:", error);
      throw error; // Re-throw to handle in calling function
    }
  };

  // Consider extracting these handlers to custom hooks
  const handleReboot = async () => {
    try {
      setIsRebooting(true);
      await atCommandSender("AT+QPOWD=1"); // Handle response properly

      toast.toast({
        title: "Rebooting device",
        description: "Please wait for the device to restart.",
      });

      // Use constants for timeout values
      const REBOOT_TIMEOUT = 90000;
      const RELOAD_DELAY = 2000;

      setTimeout(() => {
        toast.toast({
          title: "Device is now active",
          description: "The device has been rebooted successfully.",
        });
      }, REBOOT_TIMEOUT);

      setTimeout(() => {
        window.location.reload();
      }, REBOOT_TIMEOUT + RELOAD_DELAY);
    } catch (error) {
      console.error("Reboot error:", error);
      toast.toast({
        title: "Failed to reboot device",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRebooting(false);
    }
  };

  const handleReconnect = async () => {
    try {
      await atCommandSender("AT+COPS=2");

      toast.toast({
        title: "Reconnecting to network",
        description: "Please wait for the device to reconnect.",
      });

      // Use Promise instead of setTimeout for better error handling
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await atCommandSender("AT+COPS=0");

      toast.toast({
        title: "Reconnected to network",
        description: "The device has been reconnected successfully.",
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));
      window.location.reload();
    } catch (error) {
      toast.toast({
        title: "Failed to reconnect to network",
        description: "Please try again.",
        variant: "destructive",
      });
    }

    useEffect(() => {
      const fetchIpAddress = async () => {
        try {
          const response = await fetch("/cgi-bin/settings/get-ip.sh");
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data: IpResponse = await response.json();
          setLuciIp(data.br_lan_ip);
        } catch (error) {
          console.error("Failed to fetch IP address:", error);
          toast.toast({
            title: "Failed to fetch IP address",
            description: "Using default IP address",
            variant: "destructive",
          });
        }
      };

      fetchIpAddress();
    }, []); // Empty dependency array means this runs once on mount
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-base lg:gap-6">
          <Link
            href="/dashboard/home/"
            className="flex items-center gap-2 text-lg font-semibold md:text-xl md:mr-8"
          >
            <RadioTower className="h-6 w-6" />
            <h1>QuecManager</h1>
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
            href="/dashboard/cell-settings/basic-settings/"
            className={`${
              // If currentPathName have dashboard/cell-settings/* then it will be active
              currentPathName.includes("/dashboard/cell-settings/")
                ? "text-foreground"
                : "text-muted-foreground"
            } transition-colors hover:text-foreground`}
          >
            Cellular
          </Link>
          <Link
            href="/dashboard/advanced-settings/connectivity"
            className={`${
              currentPathName.includes("/dashboard/advanced-settings")
                ? "text-foreground"
                : "text-muted-foreground"
            } transition-colors hover:text-foreground`}
          >
            Advance
          </Link>
          <Link
            href="/dashboard/experimental/quecwatch"
            className={`${
              currentPathName.includes("/dashboard/experimental/")
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
              <SheetClose asChild>
                <Link
                  href="/dashboard/home/"
                  className="flex items-center gap-2 text-lg font-semibold"
                >
                  <RadioTower className="h-6 w-6" />
                  <span>QuecManager</span>
                </Link>
              </SheetClose>

              <SheetClose asChild>
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
              </SheetClose>

              <SheetClose asChild>
                <Link
                  href="/dashboard/cell-settings/basic-settings/"
                  className={`${
                    currentPathName.includes("/dashboard/cell-settings")
                      ? "text-foreground"
                      : "text-muted-foreground"
                  } transition-colors hover:text-foreground`}
                >
                  Cellular
                </Link>
              </SheetClose>

              <SheetClose asChild>
                <Link
                  href="/dashboard/advanced-settings/connectivity"
                  className={`${
                    currentPathName.includes("/dashboard/advanced-settings")
                      ? "text-foreground"
                      : "text-muted-foreground"
                  } transition-colors hover:text-foreground`}
                >
                  Advance
                </Link>
              </SheetClose>

              <SheetClose asChild>
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
              </SheetClose>

              <SheetClose asChild>
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
              </SheetClose>

              <SheetClose asChild>
                <Link
                  href="/dashboard/settings/general"
                  className={`${
                    currentPathName.includes("/dashboard/settings")
                      ? "text-foreground"
                      : "text-muted-foreground"
                  } transition-colors hover:text-foreground`}
                >
                  Settings
                </Link>
              </SheetClose>
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
              <DropdownMenuLabel>Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings/general">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/cgi-bin/luci">Luci</a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                {/* a tag that redirects to a new tab */}
                <a
                  href="https://github.com/iamromulan/quectel-rgmii-toolkit/discussions/new/choose"
                  target="_blank"
                >
                  Support
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleReconnect}>
                Reconnect
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                      Reboot
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will reboot your device. The connection will be
                        lost temporarily. Please wait for the page to reload.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleReboot}
                        disabled={isRebooting}
                      >
                        <Power className="size-4" />
                        Reboot Now
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuItem>
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
