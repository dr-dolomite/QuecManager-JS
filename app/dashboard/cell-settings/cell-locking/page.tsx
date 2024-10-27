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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { LockIcon, RefreshCcw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CellLockingPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ltePersist, setLtePersist] = useState(false);
  const [nr5gPersist, setNr5gPersist] = useState(false);

  // LTE state
  const [lteState, setLteState] = useState({
    EARFCN1: "",
    PCI1: "",
    EARFCN2: "",
    PCI2: "",
    EARFCN3: "",
    PCI3: "",
  });

  // NR5G state
  const [nr5gState, setNr5gState] = useState({
    NRARFCN: "",
    NRPCI: "",
    SCS: "",
    NRBAND: "",
  });

  const handleATCommand = async (command: string) => {
    const encodedCommand = encodeURIComponent(command);
    try {
      const response = await fetch("/cgi-bin/atinout_handler.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // body: JSON.stringify({ command }),
        body: `command=${encodedCommand}`,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute AT command");
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AT command failed: ${error.message}`);
      }
      throw new Error("AT command failed with unknown error");
    }
  };

  const parseATResponse = (response: string) => {
    // Extract the content between +QNWLOCK: and OK
    const match = response.match(/\+QNWLOCK:\s*(.+?)\n/);
    if (!match) return null;

    // Remove quotes and split by comma
    return match[1]
      .replace(/"/g, "")
      .split(",")
      .map((item) => item.trim());
  };

  const fetchPersistStatus = async () => {
    try {
      const response = await handleATCommand('AT+QNWLOCK="save_ctrl"');
      if (response && response.output) {
        const parsedData = parseATResponse(response.output);
        console.log("Persist status:", parsedData);
        if (parsedData && parsedData.length >= 2) {
          setLtePersist(parsedData[1] === "1");
          setNr5gPersist(parsedData[2] === "1");
        }
      }
    } catch (error) {
      console.error("Error fetching persist status:", error);
    }
  };

  const fetchCurrentStatus = async () => {
    try {
      setLoading(true);

      // Fetch persist status
      await fetchPersistStatus();

      // Wait for a second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Fetch LTE status
      const lteResponse = await handleATCommand('AT+QNWLOCK="common/4g"');
      console.log("Current LTE lock status:", lteResponse);

      if (lteResponse && lteResponse.output) {
        const parsedData = parseATResponse(lteResponse.output);
        if (parsedData) {
          const numCells = parseInt(parsedData[1]);

          const newLteState = {
            EARFCN1: numCells >= 1 ? parsedData[2] : "",
            PCI1: numCells >= 1 ? parsedData[3] : "",
            EARFCN2: numCells >= 2 ? parsedData[4] : "",
            PCI2: numCells >= 2 ? parsedData[5] : "",
            EARFCN3: numCells >= 3 ? parsedData[6] : "",
            PCI3: numCells >= 3 ? parsedData[7] : "",
          };
          setLteState(newLteState);

          if (numCells > 0) {
            setLocked(true);
          }
        }
      }

      // Fetch NR5G status
      const nr5gResponse = await handleATCommand('AT+QNWLOCK="common/5g"');
      console.log("Current NR5G lock status:", nr5gResponse);

      if (nr5gResponse && nr5gResponse.output) {
        const parsedData = parseATResponse(nr5gResponse.output);
        if (parsedData && parsedData.length >= 5) {
          const newNr5gState = {
            NRPCI: parsedData[1],
            NRARFCN: parsedData[2],
            SCS: parsedData[3],
            NRBAND: parsedData[4],
          };
          setNr5gState(newNr5gState);
          if (parseInt(parsedData[1]) > 0) {
            setLocked(true);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching current status:", error);
      toast({
        title: "Error",
        description: "Failed to fetch current cell locking status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchCurrentStatus();
  }, []);

  const handleLTELock = async () => {
    try {
      setLoading(true);
      // Collect valid EARFCN/PCI pairs
      const validPairs = [];
      if (lteState.EARFCN1 && lteState.PCI1) {
        validPairs.push([lteState.EARFCN1, lteState.PCI1]);
      }
      if (lteState.EARFCN2 && lteState.PCI2) {
        validPairs.push([lteState.EARFCN2, lteState.PCI2]);
      }
      if (lteState.EARFCN3 && lteState.PCI3) {
        validPairs.push([lteState.EARFCN3, lteState.PCI3]);
      }

      if (validPairs.length === 0) {
        throw new Error("Please fill at least one EARFCN and PCI pair");
      }

      // Build command based on number of pairs
      let lockCommand = `AT+QNWLOCK="common/4g",${validPairs.length}`;
      validPairs.forEach(([earfcn, pci]) => {
        lockCommand += `,${earfcn},${pci}`;
      });

      // Execute the lock command
      await handleATCommand(lockCommand);

      // Wait for a second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Save the configuration
      await handleATCommand('AT+QNWLOCK="save_ctrl",1,0');

      // Refetch status
      await fetchCurrentStatus();

      toast({
        title: "Success",
        description: `LTE cells locked successfully with ${
          validPairs.length
        } pair${validPairs.length > 1 ? "s" : ""}`,
      });
    } catch (error) {
      setLoading(false);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to lock LTE cells",
        variant: "destructive",
      });
    }
  };

  const handleNR5GLock = async () => {
    try {
      setLoading(true);
      if (
        !nr5gState.NRPCI ||
        !nr5gState.NRARFCN ||
        !nr5gState.SCS ||
        !nr5gState.NRBAND
      ) {
        throw new Error("Please fill all NR5G fields");
      }

      // Execute lock command
      const lockCommand = `AT+QNWLOCK="common/5g",${nr5gState.NRPCI},${nr5gState.NRARFCN},${nr5gState.SCS},${nr5gState.NRBAND}`;
      await handleATCommand(lockCommand);

      // Wait for a second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Save the configuration
      await handleATCommand('AT+QNWLOCK="save_ctrl",0,1');

      // Refetch status
      await fetchCurrentStatus();

      toast({
        title: "Success",
        description: "NR5G cell locked successfully",
      });
    } catch (error) {
      setLoading(false);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to lock NR5G cell",
        variant: "destructive",
      });
    }
  };

  const handleLTEReset = async () => {
    try {
      setLoading(true);
      await handleATCommand('AT+QNWLOCK="common/4g",0');
      // Wait for a second
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await handleATCommand('AT+QNWLOCK="save_ctrl",1,0');
      await handleATCommand("AT+COPS=2");
      // Wait for 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await handleATCommand("AT+COPS=0");

      // Refetch status
      await fetchCurrentStatus();

      toast({
        title: "Success",
        description: "LTE cell locking reset to default",
      });
    } catch (error) {
      setLoading(false);
      toast({
        title: "Error",
        description: "Failed to reset LTE cell locking",
        variant: "destructive",
      });
    }
  };

  const handleNR5GReset = async () => {
    try {
      setLoading(true);
      await handleATCommand('AT+QNWLOCK="common/5g",0');
      await handleATCommand('AT+QNWLOCK="save_ctrl",0,1');
      await handleATCommand("AT+COPS=2");
      // Wait for 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await handleATCommand("AT+COPS=0");

      // Refetch status
      await fetchCurrentStatus();

      toast({
        title: "Success",
        description: "NR5G cell locking reset to default",
      });
    } catch (error) {
      setLoading(false);
      toast({
        title: "Error",
        description: "Failed to reset NR5G cell locking",
        variant: "destructive",
      });
    }
  };

  const handleLTEPersistToggle = async (pressed: boolean) => {
    try {
      setLoading(true);
      await handleATCommand(
        `AT+QNWLOCK="save_ctrl",${pressed ? "1" : "0"},${
          nr5gPersist ? "1" : "0"
        }`
      );
      await fetchPersistStatus();
      toast({
        title: "Success",
        description: `LTE persist on boot ${pressed ? "enabled" : "disabled"}`,
      });
      // Wait for a 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update LTE persist setting",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNR5GPersistToggle = async (pressed: boolean) => {
    try {
      setLoading(true);
      await handleATCommand(
        `AT+QNWLOCK="save_ctrl",${ltePersist ? "1" : "0"},${
          pressed ? "1" : "0"
        }`
      );
      await fetchPersistStatus();
      toast({
        title: "Success",
        description: `NR5G persist on boot ${pressed ? "enabled" : "disabled"}`,
      });
      // Wait for a 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update NR5G persist setting",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>4G LTE Cellular Locking</CardTitle>
          <CardDescription>
            Lock the device to specific LTE Physical Cell IDs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-6">
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="EARFCN1">EARFCN 1</Label>
              <Input
                type="text"
                id="EARFCN1"
                placeholder="EARFCN 1"
                value={lteState.EARFCN1}
                onChange={(e) =>
                  setLteState((prev) => ({ ...prev, EARFCN1: e.target.value }))
                }
              />
            </div>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="PCI1">PCI 1</Label>
              <Input
                type="text"
                id="PCI1"
                placeholder="PCI 1"
                value={lteState.PCI1}
                onChange={(e) =>
                  setLteState((prev) => ({ ...prev, PCI1: e.target.value }))
                }
              />
            </div>
            <Separator className="my-1 col-span-2 w-full" />
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="EARFCN2">EARFCN 2</Label>
              <Input
                type="text"
                id="EARFCN2"
                placeholder="EARFCN 2"
                value={lteState.EARFCN2}
                onChange={(e) =>
                  setLteState((prev) => ({ ...prev, EARFCN2: e.target.value }))
                }
              />
            </div>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="PCI2">PCI 2</Label>
              <Input
                type="text"
                id="PCI2"
                placeholder="PCI 2"
                value={lteState.PCI2}
                onChange={(e) =>
                  setLteState((prev) => ({ ...prev, PCI2: e.target.value }))
                }
              />
            </div>
            <Separator className="my-1 col-span-2 w-full" />
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="EARFCN3">EARFCN 3</Label>
              <Input
                type="text"
                id="EARFCN3"
                placeholder="EARFCN 3"
                value={lteState.EARFCN3}
                onChange={(e) =>
                  setLteState((prev) => ({ ...prev, EARFCN3: e.target.value }))
                }
              />
            </div>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="PCI3">PCI 3</Label>
              <Input
                type="text"
                id="PCI3"
                placeholder="PCI 3"
                value={lteState.PCI3}
                onChange={(e) =>
                  setLteState((prev) => ({ ...prev, PCI3: e.target.value }))
                }
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t py-4 grid grid-flow-row md:grid-cols-3 grid-cols-1 gap-4">
          <Button onClick={handleLTELock} disabled={loading}>
            <LockIcon className="h-4 w-4" />
            Lock LTE Cells
          </Button>
          <Toggle
            pressed={ltePersist}
            onPressedChange={handleLTEPersistToggle}
            disabled={loading}
          >
            <Save className="h-4 w-4 mr-2" />
            Persist on Reboot
          </Toggle>
          <Button
            variant="secondary"
            onClick={handleLTEReset}
            disabled={loading || !locked}
          >
            <RefreshCcw className="h-4 w-4" />
            Reset to Default
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NR5G-SA Cellular Locking</CardTitle>
          <CardDescription>
            Lock the device to a specific NR5G-SA Physical Cell ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-6">
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="NR-ARFCN">NR ARFCN</Label>
              <Input
                type="text"
                id="NR-ARFCN"
                placeholder="NR ARFCN"
                value={nr5gState.NRARFCN}
                onChange={(e) =>
                  setNr5gState((prev) => ({ ...prev, NRARFCN: e.target.value }))
                }
              />
            </div>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="NR-PCI">NR PCI</Label>
              <Input
                type="text"
                id="NR-PCI"
                placeholder="NR PCI"
                value={nr5gState.NRPCI}
                onChange={(e) =>
                  setNr5gState((prev) => ({ ...prev, NRPCI: e.target.value }))
                }
              />
            </div>
            <Separator className="my-0.5 col-span-2 w-full" />
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="SCS">SCS</Label>
              <Select
                value={nr5gState.SCS}
                onValueChange={(value) =>
                  setNr5gState((prev) => ({ ...prev, SCS: value }))
                }
              >
                <SelectTrigger id="SCS">
                  <SelectValue placeholder="SCS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>SCS</SelectLabel>
                    <SelectItem value="15">15 kHz</SelectItem>
                    <SelectItem value="30">30 kHz</SelectItem>
                    <SelectItem value="60">60 kHz</SelectItem>
                    <SelectItem value="120">120 kHz</SelectItem>
                    <SelectItem value="240">240 kHz</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="NRBAND">NR Band</Label>
              <Input
                type="text"
                id="NRBAND"
                placeholder="NR BAND"
                value={nr5gState.NRBAND}
                onChange={(e) =>
                  setNr5gState((prev) => ({ ...prev, NRBAND: e.target.value }))
                }
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t py-4 grid grid-flow-row md:grid-cols-3 grid-cols-1 gap-4">
          <Button onClick={handleNR5GLock} disabled={loading}>
            <LockIcon className="h-4 w-4" />
            Lock NR5G-SA Cell
          </Button>
          <Toggle
            pressed={nr5gPersist}
            onPressedChange={handleNR5GPersistToggle}
            disabled={loading}
          >
            <Save className="h-4 w-4 mr-2" />
            Persist on Reboot
          </Toggle>
          <Button
            variant="secondary"
            onClick={handleNR5GReset}
            disabled={loading || !locked}
          >
            <RefreshCcw className="h-4 w-4" />
            Reset to Default
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CellLockingPage;
