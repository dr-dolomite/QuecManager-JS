"use client";

import { useEffect } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ModeToggle } from "@/components/dark-mode-toggle";

const PreviewHomePage = () => {

  // Create a use effect that will fetch the rsrp from /cgi-bin/home.sh
  useEffect(() => {
    fetch("/cgi-bin/home_data.sh")
      .then((response) => response.json())
      .then((data) => console.log(data));
  }, []);

  return (
    <Card className="2xl:w-[800px]">
      <CardHeader>
        <div className="flex flex-row justify-between items-center">
          <CardTitle>QuecManager Quick Stats</CardTitle>
          <ModeToggle />
        </div>
      </CardHeader>
      <CardContent>
        RSRP : -80 dBm
      </CardContent>
    </Card>
  );
};

export default PreviewHomePage;
