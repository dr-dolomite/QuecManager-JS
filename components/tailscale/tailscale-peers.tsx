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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, CheckCircle2, RefreshCcwIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";

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

const TailscalePeersComponent = () => {
  const [peers, setPeers] = useState<TailscalePeer[]>([]);
  const [isLoadingPeers, setIsLoadingPeers] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Peers</CardTitle>
        <CardDescription>
          List of devices connected to your Tailscale network. To manage your
          devices, visit the admin console
          <a
            href="https://login.tailscale.com/admin/machines"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-blue-600 hover:underline font-semibold"
          >
            here.
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingPeers ? (
          <div className="flex justify-center items-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        ) : peers.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="default">
                <Avatar className="size-12">
                  <AvatarImage
                    src="/tailscale-logo.png"
                  />
                  <AvatarFallback>
                    TS
                  </AvatarFallback>
                </Avatar>
              </EmptyMedia>
              <EmptyTitle>
                No Peers Found
              </EmptyTitle>
              <EmptyDescription>
                It looks like there are no devices connected to your Tailscale network.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="secondary">
                <RefreshCcwIcon className="w-4 h-4"/>
                Check Again
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Hostname</TableHead>
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
                          <span className="text-sm text-green-600">Online</span>
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
  );
};

export default TailscalePeersComponent;
