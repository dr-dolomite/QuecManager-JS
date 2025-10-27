import React, { useState } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "../ui/button";
import {
  BadgeCheckIcon,
  ChevronRightIcon,
  CircleCheck,
  LogInIcon,
  RefreshCcwIcon,
} from "lucide-react";

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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { DialogClose } from "@radix-ui/react-dialog";

interface TailscaleAuthProps {
  loginUrl?: string;
  onRefresh: () => void;
}

const TailscaleAuth = ({ loginUrl, onRefresh }: TailscaleAuthProps) => {
  const [hasClickedLink, setHasClickedLink] = useState(false);

  const handleLinkClick = () => {
    setHasClickedLink(true);
  };

  const handleDone = () => {
    onRefresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tailscale Settings</CardTitle>
        <CardDescription>
          Manage your Tailscale VPN settings and connected devices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Empty className="from-muted/50 to-background h-full bg-gradient-to-b from-30%">
          <EmptyHeader>
            <Avatar className="size-12">
              <AvatarImage src="/tailscale-logo.png" />
              <AvatarFallback>TS</AvatarFallback>
            </Avatar>
            <EmptyTitle>Tailscale Authentication Required</EmptyTitle>
            <EmptyDescription>
              Please authenticate and bind this device to your Tailscale
              network.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Dialog>
              <DialogTrigger asChild>
                <Button disabled={!loginUrl}>
                  <LogInIcon />
                  Authenticate with Tailscale
                </Button>
              </DialogTrigger>
              <DialogContent className="md:max-w-lg max-w-sm">
                <DialogHeader>
                  <DialogTitle>Authenticate with Tailscale</DialogTitle>
                  <DialogDescription>
                    To bind your device to your Tailscale network, please click
                    the link below to open the Tailscale authentication page
                    in a new tab. Follow the instructions there to complete the
                    authentication process.
                  </DialogDescription>
                </DialogHeader>
                {loginUrl && (
                  <Item variant="outline" size="sm" className="w-full border-secondary" asChild>
                    <a
                      href={loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-secondary"
                      onClick={handleLinkClick}
                    >
                      <ItemMedia>
                        <BadgeCheckIcon className="size-5" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{loginUrl}</ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <ChevronRightIcon className="size-4" />
                      </ItemActions>
                    </a>
                  </Item>
                )}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button onClick={handleDone} disabled={!hasClickedLink}>
                      <CircleCheck className="h-4 w-4" />
                      Done
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
};

export default TailscaleAuth;
