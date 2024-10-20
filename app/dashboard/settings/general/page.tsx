import * as React from "react";
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
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GeneralSettingsPage = () => {

  return (
    <div className="grid gap-6">
    <Card x-chunk="dashboard-04-chunk-1">
      <CardHeader>
        <CardTitle>AT Port Main Interface</CardTitle>
        <CardDescription>
          Change the main interface of the AT Port configuration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form>
          <Input placeholder="Main AT port interface" defaultValue="/dev/smd11" />
        </form>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button>Save</Button>
      </CardFooter>
    </Card>

    <Card x-chunk="dashboard-04-chunk-2">
      <CardHeader>
        <CardTitle>AT Port Custom Command Interface</CardTitle>
        <CardDescription>
          Change the custom command interface of the AT Port
          configuration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form>
          <Input placeholder="Custom AT port interface" defaultValue="/dev/smd7" />
        </form>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button>Save</Button>
      </CardFooter>
    </Card>

    <Card x-chunk="dashboard-04-chunk-3">
      <CardHeader>
        <CardTitle>Data Refresh Rate</CardTitle>
        <CardDescription>
          Change the frequency of data refresh rate. Slower refresh rates
          is recommended.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-1.5">
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Refresh Rate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 seconds</SelectItem>
              <SelectItem value="10">10 seconds</SelectItem>
              <SelectItem value="15">15 seconds</SelectItem>
              <SelectItem value="20">20 seconds</SelectItem>
              <SelectItem value="30">30 seconds</SelectItem>
              <SelectItem value="60">60 seconds</SelectItem>
            </SelectContent>
          </Select>
          <CardDescription className="ml-1">
            Current refresh rate: 5 seconds
          </CardDescription>
        </form>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button>Save</Button>
      </CardFooter>
    </Card>
  </div>
  );
};

export default GeneralSettingsPage;
