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
import { atCommandSender } from "@/utils/at-command"; // Import the utility

const CellLockingPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ltePersist, setLtePersist] = useState(false);
  const [nr5gPersist, setNr5gPersist] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    enabled: false,
    startTime: "",
    endTime: "",
    active: false,
    status: "",
    message: "",
    locked: false,
  });

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
        "/cgi-bin/quecmanager/at_cmd/fetch_data.sh?set=8"
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

      // Check using scheduleData
      if (pressed && (!scheduleData.startTime || !scheduleData.endTime)) {
        throw new Error("Please set both start and end times");
      }

      // Create payload using scheduleData
      const payload = pressed
        ? {
            enabled: true,
            startTime: scheduleData.startTime,
            endTime: scheduleData.endTime,
          }
        : {
            enabled: false,
          };

      const response = await fetch(
        "/cgi-bin/quecmanager/cell-locking/scheduled_cell_locking.sh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const rawText = await response.text();

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      let result;
      try {
        result = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error(`Failed to parse response: ${rawText}`);
      }

      if (result.status === "success") {
        // Only update scheduleData - no duplicate state to maintain
        setScheduleData((prev) => ({
          ...prev,
          enabled: pressed,
        }));

        toast({
          title: "Success",
          description: pressed
            ? "Cell locking schedule enabled"
            : "Cell locking schedule disabled",
        });
      } else {
        throw new Error(result.message || "Failed to update scheduling");
      }
    } catch (error) {
      // Error handling
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

      // Execute the lock command using atCommandSender
      const lockResult = await atCommandSender(lockCommand, true);

      if (lockResult.response?.status !== "success") {
        throw new Error(
          lockResult.response?.raw_output || "Failed to lock LTE cells"
        );
      }

      // Wait for a second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Save the configuration
      const saveResult = await atCommandSender(
        'AT+QNWLOCK="save_ctrl",1,0',
        true
      );

      if (saveResult.response?.status !== "success") {
        throw new Error(
          saveResult.response?.raw_output ||
            "Failed to save LTE lock configuration"
        );
      }

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

      // Execute lock command using atCommandSender
      const lockCommand = `AT+QNWLOCK="common/5g",${nr5gState.NRPCI},${nr5gState.NRARFCN},${nr5gState.SCS},${nr5gState.NRBAND}`;

      const lockResult = await atCommandSender(lockCommand, true);

      if (lockResult.response?.status !== "success") {
        throw new Error(
          lockResult.response?.raw_output || "Failed to lock NR5G cell"
        );
      }

      // Wait for a second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Save the configuration
      const saveResult = await atCommandSender(
        'AT+QNWLOCK="save_ctrl",0,1',
        true
      );

      if (saveResult.response?.status !== "success") {
        throw new Error(
          saveResult.response?.raw_output ||
            "Failed to save NR5G lock configuration"
        );
      }

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

      // Reset LTE lock
      const resetResult = await atCommandSender(
        'AT+QNWLOCK="common/4g",0',
        true
      );

      if (resetResult.response?.status !== "success") {
        throw new Error(
          resetResult.response?.raw_output || "Failed to reset LTE lock"
        );
      }

      // Wait for a second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reset LTE persist and do not save
      const saveResult = await atCommandSender(
        'AT+QNWLOCK="save_ctrl",0,0',
        true
      );

      if (saveResult.response?.status !== "success") {
        throw new Error(
          saveResult.response?.raw_output ||
            "Failed to save LTE reset configuration"
        );
      }

      // Reset COPS
      const copsOffResult = await atCommandSender("AT+COPS=2", true);

      if (copsOffResult.response?.status !== "success") {
        throw new Error(
          copsOffResult.response?.raw_output ||
            "Failed to disconnect from network"
        );
      }

      // Wait for 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Reconnect to network
      const copsOnResult = await atCommandSender("AT+COPS=0", true);

      if (copsOnResult.response?.status !== "success") {
        throw new Error(
          copsOnResult.response?.raw_output || "Failed to reconnect to network"
        );
      }

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

      // Reset NR5G lock
      const resetResult = await atCommandSender(
        'AT+QNWLOCK="common/5g",0',
        true
      );

      if (resetResult.response?.status !== "success") {
        throw new Error(
          resetResult.response?.raw_output || "Failed to reset NR5G lock"
        );
      }

      // Reset NR5G persist and do not save
      const saveResult = await atCommandSender(
        'AT+QNWLOCK="save_ctrl",0,0',
        true
      );

      if (saveResult.response?.status !== "success") {
        throw new Error(
          saveResult.response?.raw_output ||
            "Failed to save NR5G reset configuration"
        );
      }

      // Reset COPS
      const copsOffResult = await atCommandSender("AT+COPS=2", true);

      if (copsOffResult.response?.status !== "success") {
        throw new Error(
          copsOffResult.response?.raw_output ||
            "Failed to disconnect from network"
        );
      }

      // Wait for 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Reconnect to network
      const copsOnResult = await atCommandSender("AT+COPS=0", true);

      if (copsOnResult.response?.status !== "success") {
        throw new Error(
          copsOnResult.response?.raw_output || "Failed to reconnect to network"
        );
      }

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

      const toggleResult = await atCommandSender(
        `AT+QNWLOCK="save_ctrl",${pressed ? "1" : "0"},${
          nr5gPersist ? "1" : "0"
        }`,
        true
      );

      if (toggleResult.response?.status !== "success") {
        throw new Error(
          toggleResult.response?.raw_output ||
            "Failed to update LTE persist setting"
        );
      }

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

      const toggleResult = await atCommandSender(
        `AT+QNWLOCK="save_ctrl",${ltePersist ? "1" : "0"},${
          pressed ? "1" : "0"
        }`,
        true
      );

      if (toggleResult.response?.status !== "success") {
        throw new Error(
          toggleResult.response?.raw_output ||
            "Failed to update NR5G persist setting"
        );
      }

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
    const fetchAllData = async () => {
      // Fetch cell lock data once
      const response = await fetch(
        "/cgi-bin/quecmanager/cell-locking/get_cell_lock.sh"
      );
      const data = await response.json();

      // Update all necessary state
      setScheduleData({
        enabled: data.enabled,
        startTime: data.start_time || "",
        endTime: data.end_time || "",
        active: data.active,
        status: data.status,
        message: data.message,
        locked: data.locked,
      });

      // Update other state from the same response
      setLocked(data.locked);
      setLtePersist(data.ltePersist === "1");
      setNr5gPersist(data.nr5gPersist === "1");

      // Also fetch current status
      await fetchCurrentStatus();
    };

    fetchAllData();
  }, []);

  // Add this to your parent component
  useEffect(() => {
    // Update scheduleData.locked whenever the global locked state changes
    setScheduleData((prev) => ({
      ...prev,
      locked: locked,
    }));
  }, [locked]);

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
                disabled={loading || (scheduleData.enabled && locked)}
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
                disabled={loading || (scheduleData.enabled && locked)}
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
                disabled={loading || (scheduleData.enabled && locked)}
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
                disabled={loading || (scheduleData.enabled && locked)}
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
                disabled={loading || (scheduleData.enabled && locked)}
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
                disabled={loading || (scheduleData.enabled && locked)}
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t py-4 grid grid-flow-row md:grid-cols-3 grid-cols-1 gap-4">
          <Button
            onClick={handleLTELock}
            disabled={loading || (scheduleData.enabled && locked)}
          >
            <LockIcon className="h-4 w-4" />
            Lock LTE Cells
          </Button>
          <Toggle
            pressed={ltePersist}
            onPressedChange={handleLTEPersistToggle}
            disabled={loading || (scheduleData.enabled && locked)}
          >
            <Save className="h-4 w-4 mr-2" />
            Persist on Reboot
          </Toggle>
          <Button
            variant="secondary"
            onClick={handleLTEReset}
            disabled={loading || (scheduleData.enabled && locked)}
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
                disabled={loading || (scheduleData.enabled && locked)}
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
                disabled={loading || (scheduleData.enabled && locked)}
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
                disabled={loading || (scheduleData.enabled && locked)}
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
                disabled={loading || (scheduleData.enabled && locked)}
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t py-4 grid grid-flow-row md:grid-cols-3 grid-cols-1 gap-4">
          <Button
            onClick={handleNR5GLock}
            disabled={loading || (scheduleData.enabled && locked)}
          >
            <LockIcon className="h-4 w-4" />
            Lock NR5G-SA Cell
          </Button>
          <Toggle
            pressed={nr5gPersist}
            onPressedChange={handleNR5GPersistToggle}
            disabled={loading || (scheduleData.enabled && locked)}
          >
            <Save className="h-4 w-4 mr-2" />
            Persist on Reboot
          </Toggle>
          <Button
            variant="secondary"
            onClick={handleNR5GReset}
            disabled={loading || (scheduleData.enabled && locked)}
          >
            <RefreshCcw className="h-4 w-4" />
            Reset to Default
          </Button>
        </CardFooter>
      </Card>
      <ScheduledLockingCard
        loading={loading}
        scheduleData={scheduleData}
        onStartTimeChange={(time) => {
          setScheduleData((prev) => ({ ...prev, startTime: time }));
        }}
        onEndTimeChange={(time) => {
          setScheduleData((prev) => ({ ...prev, endTime: time }));
        }}
        onSchedulingToggle={handleScheduleToggle}
      />
    </div>
  );
};

export default CellLockingPage;
