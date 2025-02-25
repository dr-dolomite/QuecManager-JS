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
import ScheduledLockingCard from "@/components/cell-settings/scheduled-cell-locking-card";

interface QueueResponse {
  command: {
    id: string;
    text: string;
    timestamp: string;
  };
  response: {
    status: string;
    raw_output: string;
    completion_time: string;
    duration_ms: number;
  };
}

const CellLockingPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ltePersist, setLtePersist] = useState(false);
  const [nr5gPersist, setNr5gPersist] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

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
    try {
      const encodedCommand = encodeURIComponent(command);
      const response = await fetch(
        `/api/cgi-bin/quecmanager/at_cmd/at_queue_client?command=${encodedCommand}&wait=1`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: QueueResponse = await response.json();

      if (
        data.response.status === "error" ||
        data.response.status === "timeout"
      ) {
        throw new Error(
          data.response.raw_output ||
            `Command execution ${data.response.status}`
        );
      }

      // Convert queue response format to match existing ATResponse interface
      return {
        response: data.response.raw_output,
      };
    } catch (error) {
      console.error("AT Command error:", error);
      throw error;
    }
  };

  const parseATResponse = (data: string) => {
    // Extract the content between +QNWLOCK: and OK
    const match = data.match(/\+QNWLOCK:\s*(.+?)\n/);
    if (!match) return null;

    // Remove quotes and split by comma
    return match[1]
      .replace(/"/g, "")
      .split(",")
      .map((item) => item.trim());
  };

  const fetchCurrentStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "/api/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=8"
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error("Failed to fetch current status");
      }

      // Command set 8 is used to fetch the current cell locking status
      console.log("Current cell locking status:", data);

      // Get persist status
      const parsedData = parseATResponse(data[2].response);
      console.log("Persist status:", parsedData);
      if (parsedData && parsedData.length >= 2) {
        setLtePersist(parsedData[1] === "1");
        setNr5gPersist(parsedData[2] === "1");
      }

      // Get current LTE Lock status
      const lteLockData = parseATResponse(data[0].response);
      console.log("Current LTE lock status:", lteLockData);
      if (lteLockData) {
        const newLteState = {
          EARFCN1: lteLockData[2],
          PCI1: lteLockData[3],
          EARFCN2: lteLockData[4],
          PCI2: lteLockData[5],
          EARFCN3: lteLockData[6],
          PCI3: lteLockData[7],
        };
        setLteState(newLteState);
        console.log("New LTE state:", newLteState);
        if (parseInt(lteLockData[1]) > 0) {
          setLocked(true);
        }
      }

      // Get current NR5G Lock status
      const nr5gLockData = parseATResponse(data[1].response);
      console.log("Current NR5G lock status:", nr5gLockData);
      if (nr5gLockData && nr5gLockData.length >= 5) {
        const newNr5gState = {
          NRPCI: nr5gLockData[1],
          NRARFCN: nr5gLockData[2],
          SCS: nr5gLockData[3],
          NRBAND: nr5gLockData[4],
        };
        setNr5gState(newNr5gState);
        console.log("New NR5G state:", newNr5gState);
        if (parseInt(nr5gLockData[1]) > 0) {
          setLocked(true);
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

  const handleScheduleToggle = async (pressed: boolean) => {
    try {
      setLoading(true);

      if (pressed && (!startTime || !endTime)) {
        throw new Error("Please set both start and end times");
      }

      const response = await fetch(
        "/api/cgi-bin/quecmanager/cell-settings/scheduled_cell_locking.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: pressed
            ? `web=true&start_time=${encodeURIComponent(
                startTime
              )}&end_time=${encodeURIComponent(endTime)}`
            : "web=true&disable=true",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update scheduling");
      }

      setScheduling(pressed);
      toast({
        title: "Success",
        description: pressed
          ? "Cell locking schedule enabled"
          : "Cell locking schedule disabled",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update scheduling",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
      await fetchCurrentStatus();
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
      await fetchCurrentStatus();
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

  // Fetch data on component mount
  useEffect(() => {
    const fetchScheduleStatus = async () => {
      try {
        const response = await fetch(
          "/api/cgi-bin/quecmanager/cell-settings/scheduled_cell_locking.sh?status=true"
        );
        if (response.ok) {
          const data = await response.json();
          if (data.enabled) {
            setScheduling(true);
            setStartTime(data.start_time || "");
            setEndTime(data.end_time || "");
          }
        }
      } catch (error) {
        console.error("Failed to fetch schedule status:", error);
      }
    };

    fetchScheduleStatus();
    fetchCurrentStatus();
  }, []);

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
          <Button onClick={handleLTELock} disabled={loading || scheduling}>
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
            disabled={loading || !locked || scheduling}
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
          <Button onClick={handleNR5GLock} disabled={loading || scheduling}>
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
            disabled={loading || !locked || scheduling}
          >
            <RefreshCcw className="h-4 w-4" />
            Reset to Default
          </Button>
        </CardFooter>
      </Card>
      <ScheduledLockingCard
        loading={loading}
        scheduling={scheduling}
        startTime={startTime}
        endTime={endTime}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
        onSchedulingToggle={handleScheduleToggle}
        locked={locked}
      />
    </div>
  );
};

export default CellLockingPage;
