"use client";
import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import {
  EllipsisVertical,
  Grid2X2,
  List,
  MoreVertical,
  PencilLine,
  Save,
  Trash2Icon,
  UserRoundPen,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const QuecProfilesPage = () => {
  const [hasProfiles, setHasProfiles] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [currentProfile, setCurrentProfile] = useState(null);

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>QuecProfiles</CardTitle>
          <CardDescription>
            Configure personalized profiles for your SIM cards to manage
            connectivity settings and network preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-y-8">
          <div className="flex items-center justify-between">
            <Dialog>
              <DialogTrigger>
                <Button>
                  <UserRoundPen className="w-4 h-4" />
                  Add New Profile
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Profile</DialogTitle>
                  <DialogDescription>
                    Create a new profile for your SIM card to manage
                    connectivity settings and network preferences.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 py-4">
                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="name">Profile Name</Label>
                    <Input
                      id="name"
                      placeholder="My Network Profile"
                      required
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="ICCID">ICCID</Label>
                    <Input id="ICCID" placeholder="SIM ICCID" required />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="IMEI">IMEI</Label>
                    <Input id="IMEI" placeholder="Preferred IMEI" />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="APN">APN</Label>
                    <Input id="APN" placeholder="internet" />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="PDP">APN PDP Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="PDP Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IP">IPV4</SelectItem>
                        <SelectItem value="IPV6">IPV6</SelectItem>
                        <SelectItem value="IPV4V6">IPV4 & IPV6</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="lteBands">LTE Bands</Label>
                    <div className="grid gap-0.5">
                      <Input id="lteBands" placeholder="1, 3" />
                      <p className="text-xs text-muted-foreground italic">
                        Comma-separated list of LTE bands.
                      </p>
                    </div>
                  </div>

                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="nrBands">NR5G Bands</Label>
                    <div className="grid gap-0.5">
                      <Input id="nrBands" placeholder="41, 78" />
                      <p className="text-xs text-muted-foreground italic">
                        Comma-separated list of NR5G bands.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-1.5 col-span-2">
                    <Label htmlFor="networkType">Network Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Network Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LTE">LTE Only</SelectItem>
                        <SelectItem value="NR5G">NR5G Only</SelectItem>
                        <SelectItem value="LTE:NR5G">
                          NR5G-NSA w/ LTE
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <div className="flex items-center gap-4">
                    <Button variant="secondary">Cancel</Button>
                    <Button>
                      <Save className="w-4 h-4" />
                      Save Profile
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-1">
              <button
                className={`p-1 rounded ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-gray-700 shadow-sm"
                    : ""
                }`}
                onClick={() => setViewMode("grid")}
              >
                <Grid2X2 size={18} />
              </button>
              <button
                className={`p-1 rounded ${
                  viewMode === "list"
                    ? "bg-white dark:bg-gray-700 shadow-sm"
                    : ""
                }`}
                onClick={() => setViewMode("list")}
              >
                <List size={18} />
              </button>
            </div>
          </div>

          {viewMode === "grid" && (
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="xl:text-xl font-bold tracking-wide">
                      Profile 1
                    </CardTitle>
                    <Popover>
                      <PopoverTrigger>
                        <MoreVertical className="h-4 w-4" />
                      </PopoverTrigger>
                      <PopoverContent className="grid gap-2 max-w-[180px]">
                        <Button size="sm">
                          <PencilLine className="w-4 h-4" />
                          Edit Profile
                        </Button>
                        <Button size="sm" variant="destructive">
                          <Trash2Icon className="w-4 h-4" />
                          Delete Profile
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <CardDescription>
                    <Badge variant="secondary" className="text-xs">
                      4G LTE
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="ICCID"
                        className="text-sm text-muted-foreground"
                      >
                        SIM ICCID
                      </Label>
                      <p id="ICCID" className="font-semibold">
                        89012607891234567890
                      </p>
                    </div>

                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="IMEI"
                        className="text-sm text-muted-foreground"
                      >
                        Preferred IMEI
                      </Label>
                      <p id="IMEI" className="font-semibold">
                        123456789012345
                      </p>
                    </div>

                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="APN"
                        className="text-sm text-muted-foreground"
                      >
                        Preferred APN
                      </Label>
                      <p id="APN" className="font-semibold">
                        internet
                      </p>
                    </div>

                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="PDP"
                        className="text-sm text-muted-foreground"
                      >
                        Preferred APN PDP Type
                      </Label>
                      <p id="PDP" className="font-semibold">
                        IPV4V6
                      </p>
                    </div>

                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="prefLTEBands"
                        className="text-sm text-muted-foreground"
                      >
                        Preferred LTE Bands
                      </Label>
                      <p id="prefLTEBands" className="font-semibold">
                        B2, B4, B12, B66
                      </p>
                    </div>

                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="prefNRBands"
                        className="text-sm text-muted-foreground"
                      >
                        Preferred NR5G Bands
                      </Label>
                      <p id="prefNRBands" className="font-semibold">
                        -
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Added Profile 2 Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="xl:text-xl font-bold tracking-wide">
                      Profile 2
                    </CardTitle>
                    <Popover>
                      <PopoverTrigger>
                        <MoreVertical className="h-4 w-4" />
                      </PopoverTrigger>
                      <PopoverContent className="grid gap-2 max-w-[180px]">
                        <Button size="sm">
                          <PencilLine className="w-4 h-4" />
                          Edit Profile
                        </Button>
                        <Button size="sm" variant="destructive">
                          <Trash2Icon className="w-4 h-4" />
                          Delete Profile
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <CardDescription>
                    <Badge variant="secondary" className="text-xs">
                      NR5G-NSA w/ LTE
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="ICCID2"
                        className="text-sm text-muted-foreground"
                      >
                        SIM ICCID
                      </Label>
                      <p id="ICCID2" className="font-semibold">
                        89012607899876543210
                      </p>
                    </div>

                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="IMEI2"
                        className="text-sm text-muted-foreground"
                      >
                        Preferred IMEI
                      </Label>
                      <p id="IMEI2" className="font-semibold">
                        987654321098765
                      </p>
                    </div>

                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="APN2"
                        className="text-sm text-muted-foreground"
                      >
                        Preferred APN
                      </Label>
                      <p id="APN2" className="font-semibold">
                        iot.provider.com
                      </p>
                    </div>

                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="PDP2"
                        className="text-sm text-muted-foreground"
                      >
                        Preferred APN PDP Type
                      </Label>
                      <p id="PDP2" className="font-semibold">
                        IPV4
                      </p>
                    </div>

                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="prefLTEBands2"
                        className="text-sm text-muted-foreground"
                      >
                        Preferred LTE Bands
                      </Label>
                      <p id="prefLTEBands2" className="font-semibold">
                        B1, B3, B7, B20
                      </p>
                    </div>

                    <div className="grid gap-0.5">
                      <Label
                        htmlFor="prefNRBands2"
                        className="text-sm text-muted-foreground"
                      >
                        Preferred NR5G Bands
                      </Label>
                      <p id="prefNRBands2" className="font-semibold">
                        N28, N77, N78
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {viewMode === "list" && (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      Profile Name
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      ICCID
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      APN (PDP Type)
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      Network Type
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Sample row - repeat or map through your profiles */}
                  <tr className="border-t hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <div className="font-medium">Profile 1</div>
                      <div className="text-xs text-muted-foreground">
                        IMEI: 123456789012345
                      </div>
                    </td>
                    <td className="p-4 font-mono text-sm">
                      89012607891234567890
                    </td>
                    <td className="p-4">
                      internet{" "}
                      <span className="text-muted-foreground text-xs">
                        (IPV4V6)
                      </span>
                    </td>
                    <td className="p-4">
                      <Badge variant="secondary" className="text-xs">
                        4G LTE
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilLine className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2Icon className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Second sample row */}
                  <tr className="border-t hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <div className="font-medium">Profile 2</div>
                      <div className="text-xs text-muted-foreground">
                        IMEI: 987654321098765
                      </div>
                    </td>
                    <td className="p-4 font-mono text-sm">
                      89012607899876543210
                    </td>
                    <td className="p-4">
                      iot.provider.com{" "}
                      <span className="text-muted-foreground text-xs">
                        (IPV4)
                      </span>
                    </td>
                    <td className="p-4">
                      <Badge variant="secondary" className="text-xs">
                        NR5G-NSA w/ LTE
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilLine className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2Icon className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Empty state row - show when no profiles */}
                  {(!hasProfiles || isLoading) && (
                    <tr className="border-t">
                      <td
                        colSpan={5}
                        className="p-4 text-center text-muted-foreground"
                      >
                        {isLoading ? (
                          <div className="flex flex-col items-center gap-2 py-4">
                            <div className="flex gap-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-4 w-64" />
                          </div>
                        ) : (
                          "No profiles found. Create one to get started."
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuecProfilesPage;
