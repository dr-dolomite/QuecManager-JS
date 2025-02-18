"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";

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

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import GithubButtonToast from "@/components/github-button";

interface MacAddress {
  mac: string;
  hostname: string;
}

interface Settings {
  passthrough: string | null;
  selectedMac: string | null;
  modemProtocol: string | null;
  dnsProxy: string | null;
}

interface AdvanceResponse {
  response: string;
}

const ConnectivitySettingsPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [macAddresses, setMacAddresses] = useState<MacAddress[]>([]);
  const [showRebootDialog, setShowRebootDialog] = useState(false);
  const [pendingCommand, setPendingCommand] = useState("");

  const [initialSettings, setInitialSettings] = useState<Settings>({
    passthrough: null,
    selectedMac: null,
    modemProtocol: null,
    dnsProxy: null,
  });

  const [currentSettings, setCurrentSettings] = useState<Settings>({
    passthrough: null,
    selectedMac: null,
    modemProtocol: null,
    dnsProxy: null,
  });

  // Command mappings
  const commands = {
    passthrough: {
      disabled: '+QMAP="MPDN_rule",0;+QMAPWAC=1;+QPOWD=1',
      ETH: (mac: string) => `+QMAP="MPDN_rule",0,1,0,1,1,"${mac}";+QPOWD=1`,
      USB: (mac: string) => `+QMAP="MPDN_rule",0,1,0,3,1,"${mac}";+QPOWD=1`,
    },
    modemProtocol: {
      rmnet: '+QCFG="usbnet",0;+QPOWD=1',
      ecm: '+QCFG="usbnet",1;+QPOWD=1',
      mbim: '+QCFG="usbnet",2;+QPOWD=1',
      rndis: '+QCFG="usbnet",3;+QPOWD=1',
    },
    dnsProxy: {
      enabled: '+QMAP="DHCPV4DNS","enable"',
      disabled: '+QMAP="DHCPV4DNS","disable"',
    },
  };

  // Parse advance settings response
  const parseAdvanceSettings = (responses: AdvanceResponse[]) => {
    const settings: Settings = {
      passthrough: null,
      selectedMac: null,
      modemProtocol: null,
      dnsProxy: null,
    };

    responses.forEach(({ response }) => {
      // Parse IP Passthrough
      if (response.includes("MPDN_rule")) {
        const lines = response.split("\n");
        const configLine = lines[1]; // Get the second line

        if (configLine.includes('MPDN_rule",0,1,0,1,1')) {
          settings.passthrough = "ETH";
        } else if (configLine.includes('MPDN_rule",0,1,0,3,1')) {
          settings.passthrough = "USB";
        } else if (configLine.includes('MPDN_rule",0,0,0,0,0')) {
          settings.passthrough = "disabled";
        }
      }

      // Parse Modem Protocol
      if (response.includes("usbnet")) {
        const match = response.match(/usbnet",(\d)/);
        if (match) {
          const protocolMap: { [key: string]: string } = {
            "0": "rmnet",
            "1": "ecm",
            "2": "mbim",
            "3": "rndis",
          };
          settings.modemProtocol = protocolMap[match[1]];
        }
      }

      // Parse DNS Proxy
      if (response.includes("DHCPV4DNS")) {
        if (response.includes('"enable"')) {
          settings.dnsProxy = "enabled";
        } else if (response.includes('"disable"')) {
          settings.dnsProxy = "disabled";
        }
      }
    });

    return settings;
  };

  const hasChanges = () => {
    return Object.entries(currentSettings).some(([key, value]) => {
      return value !== initialSettings[key as keyof Settings];
    });
  };

  const isValid = () => {
    if (
      currentSettings.passthrough &&
      currentSettings.passthrough !== "disabled" &&
      !currentSettings.selectedMac
    ) {
      return false;
    }
    return true;
  };

  // Modify generateCommand to not append QPOWD
  const generateCommand = () => {
    const commandParts = [];

    const changedSettings = Object.entries(currentSettings).reduce(
      (acc, [key, value]) => {
        if (value !== initialSettings[key as keyof Settings]) {
          acc[key as keyof Settings] = value;
        }
        return acc;
      },
      {} as Partial<Settings>
    );

    if ("passthrough" in changedSettings) {
      if (changedSettings.passthrough === "disabled") {
        commandParts.push(
          commands.passthrough.disabled.replace(";+QPOWD=1", "")
        );
      } else if (changedSettings.passthrough) {
        const macCommand = commands.passthrough[
          changedSettings.passthrough as "ETH" | "USB"
        ](currentSettings.selectedMac!);
        return `AT${macCommand.replace(";+QPOWD=1", "")}`;
      }
    }

    if ("modemProtocol" in changedSettings && changedSettings.modemProtocol) {
      const protocolCommand =
        commands.modemProtocol[
          changedSettings.modemProtocol as keyof typeof commands.modemProtocol
        ];
      if (Object.keys(changedSettings).length === 1) {
        return `AT${protocolCommand.replace(";+QPOWD=1", "")}`;
      }
      commandParts.push(protocolCommand.replace(";+QPOWD=1", ""));
    }

    if ("dnsProxy" in changedSettings && changedSettings.dnsProxy) {
      const dnsCommand =
        commands.dnsProxy[
          changedSettings.dnsProxy as keyof typeof commands.dnsProxy
        ];
      if (Object.keys(changedSettings).length === 1) {
        return `AT${dnsCommand}`;
      }
      commandParts.push(dnsCommand);
    }

    if (commandParts.length > 0) {
      return `AT${commandParts.join(";")}`;
    }

    return "";
  };

  const handleReboot = async () => {
    try {
      // await fetch("/at-handler", {
      const encodedCommand = encodeURIComponent("AT+QPOWD=1");
      const queueResponse = await fetch(
        `/cgi-bin/at_command.sh?command=${encodedCommand}`
      );
      if (!queueResponse.ok) throw new Error("Failed to queue reboot command");

      toast({
        title: "Success",
        description: "Settings saved and device is rebooting...",
      });

      // Set a timeout for 90 seconds and then reload the page
      setTimeout(() => {
        window.location.reload();
      }, 90000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reboot device",
        action: <GithubButtonToast />,
      });
    }
  };

  const handleSave = async () => {
    try {
      const command = generateCommand();
      setPendingCommand(command);
      setShowRebootDialog(true);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to prepare settings",
        action: <GithubButtonToast />,
      });
    }
  };

  const handleConfirmSave = async () => {
    try {
      const encodedCommand = encodeURIComponent(pendingCommand);
      const queueResponse = await fetch(
        `/cgi-bin/at_command.sh?command=${encodedCommand}`
      );
      if (!queueResponse.ok) throw new Error("Failed to queue reboot command");

      setInitialSettings({ ...currentSettings });

      // Initiate reboot
      await handleReboot();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save settings",
        action: <GithubButtonToast />,
      });
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [macsResponse, advanceResponse] = await Promise.all([
          // fetch("/fetch-macs"),
          // fetch("/fetch-advance"),
          fetch("/api/cgi-bin/quecmanager/advance/fetch_macs.sh"),
          fetch("/api/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=4"),
        ]);

        const [macsData, advanceData] = await Promise.all([
          macsResponse.json(),
          advanceResponse.json(),
        ]);

        setMacAddresses(macsData);

        const parsedSettings = parseAdvanceSettings(advanceData);
        setInitialSettings(parsedSettings);
        setCurrentSettings(parsedSettings);

        setLoading(false);
      } catch (err) {
        setLoading(false);
        toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: "Failed to fetch connectivity settings",
          action: <GithubButtonToast />,
        });
      }
    };

    fetchSettings();
  }, []);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Connectivity Settings</CardTitle>
          <CardDescription>
            Configure your device's connectivity settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 grid-flow-row gap-6">
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="passthrough">IP Passthrough Mode</Label>
              {loading ? (
                <Skeleton className="w-full h-8" />
              ) : (
                <Select
                  onValueChange={(value) =>
                    setCurrentSettings((prev) => ({
                      ...prev,
                      passthrough: value,
                    }))
                  }
                  value={currentSettings.passthrough || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select IP Passthrough Mode"></SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Passthrough Mode</SelectLabel>
                      <SelectItem value="disabled">Disabled</SelectItem>
                      <SelectItem value="ETH">
                        ETH Passthrough Enabled
                      </SelectItem>
                      <SelectItem value="USB">
                        USB Passthrough Enabled
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="mac">Connected MAC</Label>
              {loading ? (
                <Skeleton className="w-full h-8" />
              ) : (
                <Select
                  onValueChange={(value) =>
                    setCurrentSettings((prev) => ({
                      ...prev,
                      selectedMac: value,
                    }))
                  }
                  value={currentSettings.selectedMac || undefined}
                  disabled={
                    !currentSettings.passthrough ||
                    currentSettings.passthrough === "disabled"
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Active MAC"></SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Active MAC</SelectLabel>
                      {macAddresses.map((item) => (
                        <SelectItem key={item.mac} value={item.mac}>
                          {`${item.hostname} - ${item.mac}`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator className="lg:col-span-2 col-span-1 my-2" />

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="modemProtocol">USB Modem Protocol</Label>
              {loading ? (
                <Skeleton className="w-full h-8" />
              ) : (
                <Select
                  onValueChange={(value) =>
                    setCurrentSettings((prev) => ({
                      ...prev,
                      modemProtocol: value,
                    }))
                  }
                  value={currentSettings.modemProtocol || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select USB Modem Protocol"></SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>USB Modem Protocol</SelectLabel>
                      <SelectItem value="rmnet">RMNET</SelectItem>
                      <SelectItem value="ecm">ECM (Recommended)</SelectItem>
                      <SelectItem value="mbim">MBIM</SelectItem>
                      <SelectItem value="rndis">RNDIS</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="dnsProxy">Onboard DNS Proxy Mode</Label>
              {loading ? (
                <Skeleton className="w-full h-8" />
              ) : (
                <Select
                  onValueChange={(value) =>
                    setCurrentSettings((prev) => ({ ...prev, dnsProxy: value }))
                  }
                  value={currentSettings.dnsProxy || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select DNS Proxy Mode"></SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>DNS Proxy Mode</SelectLabel>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">
                        Disabled (Recommended for Passthrough)
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="grid border-t py-4">
          <Button onClick={handleSave} disabled={!hasChanges() || !isValid()}>
            Save
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={showRebootDialog} onOpenChange={setShowRebootDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reboot Required</AlertDialogTitle>
            <AlertDialogDescription>
              The changes you made require a device reboot to take effect. Would
              you like to reboot now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Later</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>
              Save & Reboot Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ConnectivitySettingsPage;
