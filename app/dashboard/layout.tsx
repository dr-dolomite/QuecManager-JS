"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/auth";
import { ProtectedRoute } from "@/components/hoc/protected-route";
import * as React from "react";
import { useState, useEffect } from "react";
import { RadioTower, User2Icon, Menu, Power } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ProfilePictureResponse {
  status: string;
  code?: string;
  message: string;
  data?: {
    exists: boolean;
    size: number;
    modified: number;
    type: string;
    data: string;
  };
}

import { atCommandSender } from "@/utils/at-command";

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

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
import { LightRays } from "@/components/ui/light-rays";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [hasProfileImage, setHasProfileImage] = useState<boolean>(false);
  const toast = useToast();

  // WebSocket state - add your specific data structure
  const [websocketData, setWebsocketData] = useState<any>(null);

  // Cache keys for localStorage
  const CACHE_KEY = "profile_picture_data";
  const CACHE_METADATA_KEY = "profile_picture_metadata";

  // Load cached image immediately on component mount
  const loadCachedImage = () => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        setProfileImage(cachedData);
        setHasProfileImage(true);
      }
    } catch (error) {
      console.error("Error loading cached image:", error);
    }
  };

  const updateCache = (
    imageData: string,
    metadata: { size: number; modified: number; type: string }
  ) => {
    try {
      localStorage.setItem(CACHE_KEY, imageData);
      localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error("Error updating cache:", error);
      // If localStorage is full, clear the cache and try again
      if (error instanceof Error && error.name === "QuotaExceededError") {
        clearCache();
        try {
          localStorage.setItem(CACHE_KEY, imageData);
          localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
        } catch (retryError) {
          console.error(
            "Failed to cache image even after clearing:",
            retryError
          );
        }
      }
    }
  };

  const clearCache = () => {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_METADATA_KEY);
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  };

  const getCachedMetadata = () => {
    try {
      const metadata = localStorage.getItem(CACHE_METADATA_KEY);
      return metadata ? JSON.parse(metadata) : null;
    } catch (error) {
      console.error("Error getting cached metadata:", error);
      return null;
    }
  };

  const fetchProfilePicture = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        "/cgi-bin/quecmanager/settings/profile_picture.sh"
      );
      const data: ProfilePictureResponse = await response.json();

      if (data.status === "success" && data.data?.exists) {
        const serverMetadata = {
          size: data.data.size,
          modified: data.data.modified,
          type: data.data.type,
        };

        // Check if cached version is still valid
        const cachedMetadata = getCachedMetadata();
        const isValidCache =
          cachedMetadata &&
          cachedMetadata.size === serverMetadata.size &&
          cachedMetadata.modified === serverMetadata.modified &&
          cachedMetadata.type === serverMetadata.type;

        if (!isValidCache) {
          // Cache is invalid or doesn't exist, update with server data
          if (data.data.data) {
            setProfileImage(data.data.data);
            setHasProfileImage(true);
            updateCache(data.data.data, serverMetadata);
          }
        } else {
          // Cache is valid, ensure UI state is correct
          setHasProfileImage(true);
        }
      } else {
        // No profile picture on server, clear cache and UI
        setProfileImage(null);
        setHasProfileImage(false);
        clearCache();
      }
    } catch (error) {
      console.error("Error fetching profile picture:", error);
      // On error, keep cached image if available, otherwise show fallback
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (!cachedData) {
        setProfileImage(null);
        setHasProfileImage(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch profile picture on component mount
  useEffect(() => {
    loadCachedImage();
    fetchProfilePicture();
  }, []);

  // Listen for profile picture updates from other components
  useEffect(() => {
    const handleProfilePictureUpdate = () => {
      loadCachedImage();
      fetchProfilePicture();
    };

    // Listen for custom events from PersonalizationPage
    window.addEventListener(
      "profilePictureUpdated",
      handleProfilePictureUpdate
    );
    window.addEventListener(
      "profilePictureDeleted",
      handleProfilePictureUpdate
    );

    // Listen for localStorage changes (cross-tab synchronization)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CACHE_KEY || e.key === CACHE_METADATA_KEY) {
        loadCachedImage();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(
        "profilePictureUpdated",
        handleProfilePictureUpdate
      );
      window.removeEventListener(
        "profilePictureDeleted",
        handleProfilePictureUpdate
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // WebSocket connection management
  useEffect(() => {
    // Dynamically get the WebSocket URL based on current window location
    // This works whether accessing via 192.168.224.1 or Tailscale IP
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Use 192.168.224.1 instead of localhost
    const host =
      window.location.hostname === "localhost" ||
      window.location.hostname === "192.168.42.95"
        ? "192.168.224.1"
        : window.location.hostname;
    const wsUrl = `${protocol}//${host}:8838/data`;

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          // WebSocket connected successfully
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setWebsocketData(data);
          } catch (error) {
            // Failed to parse WebSocket message
          }
        };

        ws.onerror = (error) => {
          // Check if it's likely an SSL certificate issue
          if (protocol === "wss:") {
            // Show a toast notification to the user
            const certUrl = `${window.location.protocol}//${host}:8838/`;
            toast.toast({
              title: "WebSocket Connection Failed",
              description: (
                <span>
                  Please accept the SSL certificate by{" "}
                  <a
                    href={certUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(certUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    clicking here
                  </a>{" "}
                  and then refresh this page.
                </span>
              ),
              variant: "destructive",
              duration: 10000,
            });
          }
        };

        ws.onclose = (event) => {
          // Don't auto-reconnect if it's an SSL certificate issue (code 1006)
          if (event.code !== 1006) {
            // Attempt to reconnect after 5 seconds for other disconnects
            reconnectTimeout = setTimeout(() => {
              connect();
            }, 5000);
          }
        };
      } catch (error) {
        // Failed to create WebSocket connection
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

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

  const handleForceReboot = async () => {
    try {
      setIsRebooting(true);
      // Use force reboot script from the server
      await fetch("/cgi-bin/quecmanager/settings/force-reboot.sh");

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
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-20">
        <nav className="hidden flex-col gap-6 text-lg font-medium lg:flex lg:flex-row lg:items-center lg:gap-5 lg:text-base xl:gap-6">
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
            href="/dashboard/custom-features/quecwatch"
            className={`${
              currentPathName.includes("/dashboard/custom-features/")
                ? "text-foreground"
                : "text-muted-foreground"
            } transition-colors hover:text-foreground whitespace-nowrap`}
          >
            Custom Features
          </Link>
          <Link
            href="/dashboard/experimental/network-insights"
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
              className="shrink-0 lg:hidden"
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
                  href="/dashboard/custom-features/"
                  className={`${
                    currentPathName === "/dashboard/custom-features/"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  } transition-colors hover:text-foreground`}
                >
                  Custom Features
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
                  href="/dashboard/settings/personalization"
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
          <div className="ml-auto flex-1 sm:flex-initial">
            <AnimatedThemeToggler />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                {profileImage ? (
                  <Avatar>
                    <AvatarImage src={profileImage} alt="Profile Picture" />
                    <AvatarFallback>
                      <User2Icon className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <User2Icon className="h-5 w-5" />
                )}
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings/personalization">Settings</Link>
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
                <a
                  href="https://github.com/iamromulan/cellular-modem-wiki/discussions/new/choose"
                  target="_blank"
                >
                  Support
                </a>
              </DropdownMenuItem>
              {/* <DropdownMenuItem asChild>
                <Link href="/dashboard/about">About</Link>
              </DropdownMenuItem> */}
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
              <DropdownMenuItem asChild>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                      Force Reboot
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will force reboot your device. The connection will
                        be lost temporarily. Please wait for the page to reload.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleForceReboot}
                        disabled={isRebooting}
                      >
                        <Power className="size-4" />
                        Force Reboot Now
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
      <main className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 p-4 md:gap-8 md:p-10 relative">
        <ProtectedRoute websocketData={websocketData}>
          {children}
        </ProtectedRoute>
        <LightRays />
      </main>
    </div>
  );
};

export default DashboardLayout;
