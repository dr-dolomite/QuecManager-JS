"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/auth";
import { ProtectedRoute } from "@/components/hoc/protected-route";
import * as React from "react";
import { useState, useEffect } from "react";
import { RadioTower, User2Icon, Menu, Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import heartbeat from "@/hooks/heartbeat";

import {
  atCommandSender,
} from "@/utils/at-command";

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
  const [isReconnecting, setIsReconnecting] = useState(false);
  const toast = useToast();

  const { isServerAlive } = heartbeat();
  useEffect(() => {
    if (!isServerAlive) {
      logout();
    }
  }, [isServerAlive, logout]);

  // Handler for rebooting the device
  const handleReboot = async () => {
    try {
      setIsRebooting(true);
      // Use the updated AT command sender with wait=true to ensure command completes
      await atCommandSender("AT+QPOWD=1", true, 60);

      // Use constants for timeout values
      const REBOOT_TIMEOUT = 90000;
      const RELOAD_DELAY = 2000;

      toast.toast({
        title: "Rebooting device",
        description: `Please wait for the device to restart. This may take up to ${
          REBOOT_TIMEOUT / 1000
        } seconds.`,
        duration: REBOOT_TIMEOUT,
      });

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

  // Handler for network reconnection
  const handleReconnect = async () => {
    try {
      setIsReconnecting(true);

      // Disconnect from network - wait for completion
      await atCommandSender("AT+COPS=2", true, 30);

      toast.toast({
        title: "Disconnected from network",
        description: "Reconnecting in 2 seconds...",
      });

      // Wait before reconnecting
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Reconnect to network - wait for completion with longer timeout
      // This command may take longer depending on network conditions
      await atCommandSender("AT+COPS=0", true, 60);

      toast.toast({
        title: "Reconnected to network",
        description: "The device has been reconnected successfully.",
      });

      // Wait for network stabilization before refreshing
      await new Promise((resolve) => setTimeout(resolve, 3000));
      window.location.reload();
    } catch (error) {
      console.error("Reconnect error:", error);
      toast.toast({
        title: "Failed to reconnect to network",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReconnecting(false);
    }
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
              currentPathName.includes("/dashboard/about/")
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
                  href="/dashboard/settings/security"
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
                <Link href="/dashboard/settings/security">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href="/cgi-bin/luci"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Luci
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                {/* a tag that redirects to a new tab */}
                <a
                  href="https://github.com/iamromulan/cellular-modem-wiki/discussions/new/choose"
                  target="_blank"
                >
                  Support
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleReconnect}>
                {isReconnecting ? "Reconnecting..." : "Reconnect"}
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
