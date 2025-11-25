"use client";
import React, { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
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
import { CopyIcon } from "lucide-react";

interface ATCommand {
  description: string;
  command: string;
}

const CommonATCommandsComponent = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [commonCommands, setCommonCommands] = useState<ATCommand[]>([]);
  const [isLoadingCommands, setIsLoadingCommands] = useState<boolean>(true);

  const handleCopyCommand = async (command: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(command);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = command;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand("copy");
        } catch (err) {
          console.error("Fallback: Oops, unable to copy", err);
          throw new Error("Copy failed");
        } finally {
          textArea.remove();
        }
      }

      toast({
        title: "Copied!",
        description: `Command "${command}" copied to clipboard`,
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to copy command:", error);
      toast({
        title: "Error",
        description: "Failed to copy command to clipboard",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Fetch common AT commands
  useEffect(() => {
    const fetchCommands = async () => {
      try {
        const response = await fetch(
          "/cgi-bin/quecmanager/advance/fetch_commands.sh"
        );
        const data = await response.json();

        const commands: ATCommand[] = Object.entries(data)
          .filter(([key]) => key !== "error")
          .map(([description, command]) => ({
            description,
            command: command as string,
          }));

        if (commands.length === 0 && data.error) {
          throw new Error(data.error);
        }

        setCommonCommands(commands);
      } catch (error) {
        console.error("Failed to fetch AT commands:", error);
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to load common AT commands",
          variant: "destructive",
        });
      } finally {
        setIsLoadingCommands(false);
      }
    };

    fetchCommands();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Common AT Commands</h1>
        <p className="text-muted-foreground">
          Below is a list of frequently used AT commands for your device.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Common AT Commands List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>AT Command List</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>AT Command</TableHead>
                <TableHead className="text-right">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingCommands ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    Loading commands...
                  </TableCell>
                </TableRow>
              ) : commonCommands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    No commands available
                  </TableCell>
                </TableRow>
              ) : (
                commonCommands.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="flex items-center gap-x-2">
                      <p className="font-mono truncate max-w-6 md:max-w-md">
                        {item.command}
                      </p>
                      <CopyIcon
                        className="w-3 h-3 hover:text-purple-300 cursor-pointer"
                        onClick={() => handleCopyCommand(item.command)}
                      />
                    </TableCell>
                    <TableCell className="text-right max-w-10 md:max-w-lg">
                      {item.description}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommonATCommandsComponent;
