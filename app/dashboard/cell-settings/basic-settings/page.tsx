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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";

const BasicSettings = () => {
  return (
    <div className="grid grid-cols-1 grid-flow-row gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Network Settings</CardTitle>
          <CardDescription>
            Change the network settings of the device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 lg:grid-cols-2 grid-flow-row gap-6">
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="APN">Current APN</Label>
              <Input type="text" id="APN" placeholder="Current APN" />
            </div>

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="APN">APN PDP Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select PDP Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>PDP Type</SelectLabel>
                    <SelectItem value="ipv4">IPv4 Only</SelectItem>
                    <SelectItem value="ipv6">IPv6 Only</SelectItem>
                    <SelectItem value="ipv4v6">IPv4 and IPv6</SelectItem>
                    <SelectItem value="p2p">P2P Protocol</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label>Preferred Network Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select Preferred Network Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Preferred Network Type</SelectLabel>
                    <SelectItem value="AUTO">Automatic</SelectItem>
                    <SelectItem value="LTE">LTE Only</SelectItem>
                    <SelectItem value="LTE:NR5G">NR5G-NSA</SelectItem>
                    <SelectItem value="NR5G">NR5G-SA</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label>NR5G Mode Control</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select NR5G Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>NR5G Mode</SelectLabel>
                    <SelectItem value="AUTO">Enable NR5G SA and NSA</SelectItem>
                    <SelectItem value="NSA">NR5G-NSA Only</SelectItem>
                    <SelectItem value="SA">NR5G-SA Only</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label>U-SIM Slot Configuration</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select U-SIM Slot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>U-SIM Slot</SelectLabel>
                    <SelectItem value="1">Slot 1</SelectItem>
                    <SelectItem value="2">Slot 2</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button>Save</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>APN and ICCID Profiles</CardTitle>
          <CardDescription>
            Add a predefined APN based on the ICCID of the SIM card.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 lg:grid-cols-2 grid-flow-row gap-6">
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="APNProfile1">APN Profile 1</Label>
              <Input
                type="text"
                id="APNProfile1"
                placeholder="APN for Profile 1"
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="APN">APN PDP Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select PDP Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>PDP Type</SelectLabel>
                    <SelectItem value="ipv4">IPv4 Only</SelectItem>
                    <SelectItem value="ipv6">IPv6 Only</SelectItem>
                    <SelectItem value="ipv4v6">IPv4 and IPv6</SelectItem>
                    <SelectItem value="p2p">P2P Protocol</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full max-w-sm items-center gap-2 col-span-2">
              <Label htmlFor="APNProfile1">ICCID Profile 1</Label>
              <Input
                type="text"
                id="APNProfile1"
                placeholder="APN for Profile 1"
              />
            </div>

            <Separator className="col-span-2 w-full my-2" />

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="APNProfile2">APN Profile 2</Label>
              <Input
                type="text"
                id="APNProfile2"
                placeholder="APN for Profile 2"
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="APN">APN PDP Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select PDP Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>PDP Type</SelectLabel>
                    <SelectItem value="ipv4">IPv4 Only</SelectItem>
                    <SelectItem value="ipv6">IPv6 Only</SelectItem>
                    <SelectItem value="ipv4v6">IPv4 and IPv6</SelectItem>
                    <SelectItem value="p2p">P2P Protocol</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full max-w-sm items-center gap-2 col-span-2">
              <Label htmlFor="APNProfile1">ICCID Profile 1</Label>
              <Input
                type="text"
                id="APNProfile1"
                placeholder="APN for Profile 1"
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex space-x-6">
          <Button>Save</Button>
          <Button variant="secondary">
            <Trash2 className="h-4 w-4 mr-2" />
            Remove APN Profiles
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default BasicSettings;
