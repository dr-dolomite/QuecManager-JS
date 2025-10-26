"use client";
import { useTailscalePeers } from "@/hooks/use-tailscale-peers";

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
import {
  AlertCircle,
  CheckCircle2,
  RefreshCcwIcon,
  XCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "../ui/skeleton";

const TailscalePeersComponent = () => {
  const { peers, isLoading, error, refetch } = useTailscalePeers();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
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
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Virtual IP
                </TableHead>
                <TableHead className="hidden md:table-cell">User</TableHead>
                <TableHead className="hidden sm:table-cell">OS</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : error ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <XCircle className="size-12 text-destructive" />
              </EmptyMedia>
              <EmptyTitle>Error Loading Peers</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="secondary" onClick={refetch}>
                <RefreshCcwIcon className="w-4 h-4" />
                Try Again
              </Button>
            </EmptyContent>
          </Empty>
        ) : !peers || peers.peers.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="default">
                <Avatar className="size-12">
                  <AvatarImage src="/tailscale-logo.png" />
                  <AvatarFallback>TS</AvatarFallback>
                </Avatar>
              </EmptyMedia>
              <EmptyTitle>No Peers Found</EmptyTitle>
              <EmptyDescription>
                It looks like there are no devices connected to your Tailscale
                network.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="secondary" onClick={refetch}>
                <RefreshCcwIcon className="w-4 h-4" />
                Check Again
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hostname</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Virtual IP
                  </TableHead>
                  <TableHead className="hidden md:table-cell">User</TableHead>
                  <TableHead className="hidden sm:table-cell">OS</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {peers.peers.map((peer, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {peer.hostname}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-sm">
                      {peer.ip}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {peer.user}
                    </TableCell>
                    <TableCell className="capitalize hidden sm:table-cell">
                      {peer.os}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {peer.status === "online" ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600 font-medium">
                              Online
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-secondary" />
                            <span className="text-sm text-secondary capitalize">
                              Offline
                            </span>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={refetch}
          disabled={isLoading}
        >
          <RefreshCcwIcon
            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
};

export default TailscalePeersComponent;
