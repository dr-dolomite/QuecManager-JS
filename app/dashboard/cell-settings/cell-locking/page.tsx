import React from "react";

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
import { LockIcon, RefreshCcw } from "lucide-react";

const CellLockingPage = () => {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>4G LTE Cellular Locking</CardTitle>
          <CardDescription>
            Lock the device to a specific LTE Physical Cell ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid lg:grid-cols-2 grid-cols-1 grid-flow-row gap-6">
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="EARFCN1">EARFCN 1</Label>
              <Input type="text" id="EARFCN1" placeholder="EARFCN 1" />
            </div>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="PCI1">PCI 1</Label>
              <Input type="text" id="PCI1" placeholder="PCI 1" />
            </div>
            <Separator className="my-1 col-span-2 w-full" />
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="EARFCN2">EARFCN 2</Label>
              <Input type="text" id="EARFCN2" placeholder="EARFCN 2" />
            </div>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="PCI2">PCI 2</Label>
              <Input type="text" id="PCI2" placeholder="PCI 2" />
            </div>
            <Separator className="my-1 col-span-2 w-full" />
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="EARFCN3">EARFCN 3</Label>
              <Input type="text" id="EARFCN3" placeholder="EARFCN 3" />
            </div>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="PCI2">PCI 3</Label>
              <Input type="text" id="PCI3" placeholder="PCI 3" />
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t py-4 px-6 flex flex-row items-center space-x-6 mt-2">
          <Button>
            <LockIcon className="h-4 w-4 mr-2" />
            Lock LTE Cells
          </Button>
          <Button variant="secondary">
            <RefreshCcw className="h-4 w-4 mr-2" />
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
              <Input type="text" id="NR-ARFCN" placeholder="NR ARFCN" />
            </div>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="NR-PCI">NR PCI</Label>
              <Input type="text" id="NR-PCI" placeholder="NR PCI" />
            </div>
            <Separator className="my-0.5 col-span-2 w-full" />
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="SCS">SCS</Label>
              <Select>
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
              <Input type="text" id="NRBAND" placeholder="NR BAND" />
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t py-4 px-6 flex flex-row items-center space-x-6 mt-2">
          <Button>
            <LockIcon className="h-4 w-4 mr-2" />
            Lock NR5G-SA Cell
          </Button>
          <Button variant="secondary">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CellLockingPage;
