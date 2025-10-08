"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

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

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { SiTailscale } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import {
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcwIcon,
  BoxIcon,
  CopyIcon,
  LogOut,
  LogInIcon,
  ArrowRightIcon,
  ArrowRightCircleIcon,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { Separator } from "../ui/separator";

interface TailscaleStatus {
  status: string;
  message: string;
  is_installed: boolean;
  is_running: boolean;
  is_authenticated?: boolean;
  backend_state?: string;
  ip_address?: string;
  hostname?: string;
  email?: string;
  dns_name?: string;
  auth_url?: string;
}

interface TailscalePeer {
  ip: string;
  hostname: string;
  user: string;
  os: string;
  status: string;
}

interface PeersResponse {
  status: string;
  message: string;
  peers: TailscalePeer[];
}

const TailScaleSettingsComponent = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [tailscaleStatus, setTailscaleStatus] =
    useState<TailscaleStatus | null>(null);
  const [peers, setPeers] = useState<TailscalePeer[]>([]);
  const [isLoadingPeers, setIsLoadingPeers] = useState(false);
  const [authUrl, setAuthUrl] = useState<string>("");
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [hasClickedAuth, setHasClickedAuth] = useState(false);

  // Fetch Tailscale peers
  const fetchPeers = async () => {
    setIsLoadingPeers(true);
    try {
      const response = await fetch("/cgi-bin/quecmanager/tailscale/peers.sh");
      const data: PeersResponse = await response.json();

      if (data.status === "success") {
        setPeers(data.peers);
      } else {
        console.error("Error fetching peers:", data.message);
      }
    } catch (error) {
      console.error("Error fetching Tailscale peers:", error);
    } finally {
      setIsLoadingPeers(false);
    }
  };

  // Fetch Tailscale status
  const fetchStatus = async () => {
    try {
      const response = await fetch("/cgi-bin/quecmanager/tailscale/status.sh");
      console.log(response);
      const data: TailscaleStatus = await response.json();
      console.log(data);

      setTailscaleStatus(data);
      setIsLoading(false);

      // Fetch peers if authenticated
      if (data.is_authenticated) {
        setIsLoadingPeers(true);

        // Add a slight delay to ensure Tailscale is fully ready
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await fetchPeers();
      }
    } catch (error) {
      console.error("Error fetching Tailscale status:", error);
      toast({
        title: "Error",
        description: "Failed to fetch Tailscale status.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsLoadingPeers(false);
    }
  };

  // Setup Tailscale (start and get auth URL)
  const handleSetup = async (skipRefresh: boolean = false) => {
    setIsSettingUp(true);
    setAuthUrl("");
    setHasClickedAuth(false);

    try {
      const response = await fetch("/cgi-bin/quecmanager/tailscale/setup.sh");
      const data: TailscaleStatus = await response.json();

      if (data.status === "success") {
        if (data.auth_url) {
          // Set auth URL and show dialog
          setAuthUrl(data.auth_url);
          setShowAuthDialog(true);
        } else {
          toast({
            title: "Success",
            description: data.message,
          });
        }

        // Refresh status after setup (unless caller handles it)
        if (!skipRefresh) {
          await fetchStatus();
        }
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error setting up Tailscale:", error);
      toast({
        title: "Error",
        description: "Failed to setup Tailscale.",
        variant: "destructive",
      });
    } finally {
      setIsSettingUp(false);
    }
  };

  // Handle opening auth URL in new tab
  const handleOpenAuthUrl = () => {
    if (authUrl) {
      window.open(authUrl, "_blank");
      setHasClickedAuth(true);
    }
  };

  // Handle dialog completion and cleanup
  const handleAuthComplete = async () => {
    setShowAuthDialog(false);
    setHasClickedAuth(false);

    // Call cleanup script to remove temp file
    try {
      await fetch("/cgi-bin/quecmanager/tailscale/cleanup.sh");
    } catch (error) {
      console.error("Cleanup error:", error);
    }

    toast({
      title: "Refreshing Status",
      description: "Checking authentication status...",
    });

    // Refresh status to check if authenticated
    await fetchStatus();
  };

  // Logout from Tailscale
  const handleLogout = async () => {
    try {
      setIsLoading(true);
      toast({
        title: "Logging Out",
        description: "Logging out from Tailscale...",
      });

      const response = await fetch("/cgi-bin/quecmanager/tailscale/logout.sh");
      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Logged Out",
          description: data.message,
        });

        // Refresh status after logout
        await fetchStatus();
      } else {
        toast({
          title: "Logout Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error logging out from Tailscale:", error);
      toast({
        title: "Error",
        description: "Failed to logout from Tailscale.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect from Tailscale
  const handleDisconnect = async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/tailscale/disconnect.sh"
      );
      const data = await response.json();

      if (data.status === "success") {
        // Refresh status after services restart
        await fetchStatus();

        toast({
          title: "Success",
          description: "Tailscale disconnected successfully.",
        });
      } else {
        toast({
          title: "Disconnect Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error disconnecting from Tailscale:", error);
      toast({
        title: "Error",
        description: "Failed to disconnect from Tailscale.",
        variant: "destructive",
      });
    }
  };

  // Install Tailscale
  const handleInstall = async () => {
    setIsInstalling(true);

    toast({
      title: "Installing",
      description:
        "Tailscale installation has started. This may take a few minutes.",
    });

    try {
      const response = await fetch("/cgi-bin/quecmanager/tailscale/install.sh");
      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Success",
          description: data.message,
        });

        // Refresh status after installation
        await fetchStatus();
      } else {
        toast({
          title: "Installation Failed",
          description: data.message || "Failed to install Tailscale.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error installing Tailscale:", error);
      toast({
        title: "Error",
        description: "Failed to install Tailscale. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsInstalling(false);
    }
  };

  // Toggle Tailscale on/off
  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      toast({
        title: "Setting Up Tailscale",
        description: "Starting Tailscale. Please wait...",
      });

      // Call setup without immediate refresh
      await handleSetup(true);

      // Wait 3 seconds for Tailscale to fully start
      toast({
        title: "Starting Services",
        description: "Waiting for Tailscale services to start...",
        duration: 4500,
      });
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Refresh status after services have started
      await fetchStatus();

      toast({
        title: "Success",
        description: "Tailscale started successfully.",
      });
    } else {
      toast({
        title: "Disconnecting",
        description: "Disconnecting from Tailscale...",
      });
      await handleDisconnect();
    }
  };

  // Fetch status on component mount
  useEffect(() => {
    fetchStatus();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>TailScale Settings</CardTitle>
          <CardDescription>
            Configure your TailScale VPN settings here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full mb-4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tailscale Settings</CardTitle>
          <CardDescription>
            Configure your Tailscale VPN settings here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Installation Status */}
          {!tailscaleStatus?.is_installed && (
            <Empty className="from-muted/50 to-background h-full bg-gradient-to-b from-30%">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SiTailscale />
                </EmptyMedia>
                <EmptyTitle>Tailscale is not installed</EmptyTitle>
                <EmptyDescription>
                  Please install Tailscale to enable VPN functionality.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={handleInstall} disabled={isInstalling}>
                  {isInstalling ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <BoxIcon className="h-4 w-4" />
                  )}
                  {isInstalling ? "Installing..." : "Install TailScale"}
                </Button>
              </EmptyContent>
            </Empty>
          )}

          {/* Status Information */}
          {tailscaleStatus?.is_installed && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Switch
                  id="enable-tailscale"
                  checked={
                    tailscaleStatus.is_authenticated ||
                    tailscaleStatus.is_running ||
                    false
                  }
                  onCheckedChange={handleToggle}
                  disabled={isSettingUp}
                />
                <Label htmlFor="enable-tailscale" className="font-medium">
                  Enable Tailscale
                </Label>
              </div>

              {/* Tailscale is running but is not authenticated */}
              {!tailscaleStatus?.is_authenticated &&
                tailscaleStatus?.is_running && (
                  <Empty className="from-muted/50 to-background h-full bg-gradient-to-b from-30%">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SiTailscale />
                      </EmptyMedia>
                      <EmptyTitle>Device Not Authenticated</EmptyTitle>
                      <EmptyDescription>
                        Your device is running Tailscale but is not
                        authenticated. Please authenticate to connect to your
                        Tailscale network.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        onClick={() => handleSetup()}
                        disabled={isSettingUp}
                      >
                        {isSettingUp ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <LogInIcon className="h-4 w-4" />
                        )}
                        {isSettingUp ? "Setting Up..." : "Authenticate Device"}
                      </Button>
                    </EmptyContent>
                  </Empty>
                )}

              {/* Status Display */}
              {tailscaleStatus.is_running &&
                tailscaleStatus.is_authenticated && (
                  <Card className="space-y-2 p-4">
                    {tailscaleStatus.ip_address && (
                      <div className="flex flex-col lg:flex-row lg:justify-between items-center">
                        <p className="font-medium">Device Virtual IP Address</p>
                        <div className="flex items-center gap-x-2">
                          <CopyIcon
                            className="h-4 w-4 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                tailscaleStatus.ip_address || ""
                              );
                              toast({
                                title: "Copied to Clipboard",
                                description:
                                  "Tailscale IP address copied successfully.",
                              });
                            }}
                          />
                          <p className="font-medium">
                            {tailscaleStatus.ip_address}
                          </p>
                        </div>
                      </div>
                    )}
                    <Separator className="w-full" />

                    {tailscaleStatus.hostname && (
                      <div className="flex flex-col lg:flex-row lg:justify-between items-center">
                        <p className="font-medium">Device Hostname</p>{" "}
                        <p className="font-medium">
                          {tailscaleStatus.hostname}
                        </p>
                      </div>
                    )}

                    <Separator className="w-full" />

                    {tailscaleStatus.email && (
                      <div className="flex flex-col lg:flex-row lg:justify-between items-center">
                        <p className="font-medium">Connected Account</p>
                        <div className="flex items-center gap-x-2">
                          <LogOut
                            className="size-4 hover:text-primary cursor-pointer transition-colors"
                            onClick={handleLogout}
                            aria-label="Logout from Tailscale"
                          />
                          <p className="font-medium">{tailscaleStatus.email}</p>
                        </div>
                      </div>
                    )}

                    {tailscaleStatus.dns_name && (
                      <>
                        <Separator className="w-full" />
                        <div className="flex flex-col lg:flex-row lg:justify-between items-center">
                          <p className="font-medium">DNS Name</p>
                          <div className="flex items-center gap-x-2">
                            <CopyIcon
                              className="h-4 w-4 cursor-pointer hover:text-primary transition-colors"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  tailscaleStatus.dns_name || ""
                                );
                                toast({
                                  title: "Copied to Clipboard",
                                  description:
                                    "Tailscale DNS name copied successfully.",
                                });
                              }}
                            />

                            <p className="font-medium">
                              {tailscaleStatus.dns_name}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    <Separator className="w-full" />
                    <div className="flex flex-col lg:flex-row lg:justify-between items-center">
                      <p className="font-medium">Tailscale Status</p>
                      <div className="flex items-center space-x-2">
                        {tailscaleStatus.is_authenticated ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <p className="font-medium text-sm">
                          {tailscaleStatus.backend_state}
                        </p>
                      </div>
                    </div>

                    <Separator className="w-full" />
                  </Card>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Peers Table */}
      {tailscaleStatus?.is_authenticated && tailscaleStatus?.is_running && (
        <Card>
          <CardHeader>
            <CardTitle>Device Peers</CardTitle>
            <CardDescription>
              List of devices connected to your Tailscale network.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPeers ? (
              <div className="flex justify-center items-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            ) : peers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No peers found in your network.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden sm:table-cell">
                      Hostname
                    </TableHead>
                    <TableHead>Virtual IP</TableHead>
                    {/* Hide OS when in sm screen */}
                    <TableHead className="hidden sm:table-cell">OS</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peers.map((peer, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium hidden sm:table-cell">
                        {peer.hostname}
                      </TableCell>
                      <TableCell>{peer.ip}</TableCell>
                      <TableCell className="capitalize hidden sm:table-cell">
                        {peer.os}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {peer.status === "online" ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-sm text-green-600">
                                Online
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-500 capitalize">
                                {peer.status}
                              </span>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Authentication Dialog */}
      <AlertDialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="bg-muted p-2 rounded-lg size-12 flex items-center justify-center">
                <SiTailscale className="h-6 w-6" />
              </div>
              <AlertDialogTitle>
                Connect Your Device to Tailscale
              </AlertDialogTitle>
            </div>

            <div className="space-y-6 ">
              <AlertDialogDescription className="mt-2">
                To complete the setup, you need to authenticate this device with
                your Tailscale account.
              </AlertDialogDescription>
              {/* <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium mb-2">Authentication URL:</p>
                <code className="text-xs break-all bg-background p-2 rounded flex justify-between items-center">
                  {authUrl}
                  <CopyIcon
                    className="h-4 w-4 cursor-pointer hover:text-primary transition-colors ml-2"
                    onClick={() => {
                      navigator.clipboard.writeText(authUrl || "");
                      toast({
                        title: "Copied to Clipboard",
                        description:
                          "Authentication URL copied successfully.",
                      });
                    }}
                  />
                </code>
              </div> */}
              <div className="space-y-2">
                <p className="text-sm">
                  Click the button below to open the authentication page.
                </p>
                <Button
                  onClick={handleOpenAuthUrl}
                  variant="outline"
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Authentication Page
                </Button>
              </div>
              {/* <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Next Steps</AlertTitle>
                <AlertDescription>
                  After authenticating in the browser, click "Done" below to
                  refresh your connection status.
                </AlertDescription>
              </Alert> */}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel onClick={() => setShowAuthDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAuthComplete}
              disabled={!hasClickedAuth}
            >
              <ArrowRightCircleIcon className="h-4 w-4" />
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TailScaleSettingsComponent;
