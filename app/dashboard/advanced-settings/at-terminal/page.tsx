"use client";
import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Trash2,
  CircleCheckIcon,
  CircleAlertIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CopyIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { toast } from "@/hooks/use-toast";

import TerminalComponent from "@/components/at-terminal/at-terminal";

interface CommandHistoryItem {
  command: string;
  response: string;
  timestamp: string;
  status: string;
}

const ATTerminalPage = () => {
  const { toast } = useToast();
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>(
    []
  );
  const [previousCommands, setPreviousCommands] = useState<string[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(3);

  // Load previous commands and history from localStorage
  useEffect(() => {
    const storedHistory = window.localStorage.getItem("atCommandHistory");
    const storedCommands = window.localStorage.getItem("atCommands");

    if (storedHistory) {
      try {
        setCommandHistory(JSON.parse(storedHistory));
      } catch (e) {
        console.error("Failed to parse command history:", e);
        setCommandHistory([]);
      }
    }

    if (storedCommands) {
      try {
        setPreviousCommands(JSON.parse(storedCommands));
      } catch (e) {
        console.error("Failed to parse previous commands:", e);
        setPreviousCommands([]);
      }
    }
  }, []);

  // Save command history to localStorage
  useEffect(() => {
    if (commandHistory.length > 0) {
      window.localStorage.setItem(
        "atCommandHistory",
        JSON.stringify(commandHistory)
      );
    }
  }, [commandHistory]);

  // Save previous commands to localStorage
  useEffect(() => {
    if (previousCommands.length > 0) {
      window.localStorage.setItem(
        "atCommands",
        JSON.stringify(previousCommands)
      );
    }
  }, [previousCommands]);

  // Callback when a command is executed
  const handleCommandExecuted = (newHistoryItem: CommandHistoryItem) => {
    setCommandHistory((prev) => [newHistoryItem, ...prev]);
  };

  // Callback when a command succeeds
  const handleCommandSuccess = (command: string) => {
    if (!previousCommands.includes(command)) {
      setPreviousCommands((prev) => [...prev, command]);
    }
  };

  const clearHistory = () => {
    setCommandHistory([]);
    setCurrentPage(1); // Reset to first page when clearing
    window.localStorage.removeItem("atCommandHistory");
  };

  // Pagination calculations
  const totalPages = Math.ceil(commandHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = commandHistory.slice(startIndex, endIndex);

  // Reset to page 1 if current page is invalid
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

const handleCopyCommand = async (command: string) => {
  try {
    await navigator.clipboard.writeText(command);
    
    toast({
      title: "Copied!",
      description: "Response copied to clipboard",
      duration: 2000,
    });
  } catch (error) {
    console.error("Failed to copy:", error);
    toast({
      title: "Error",
      description: "Failed to copy to clipboard. Please copy manually.",
      variant: "destructive",
      duration: 3000,
    });
  }
};

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>AT Terminal</CardTitle>
          <CardDescription>
            Send AT commands to your device using the queue system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 w-full max-w-screen">
            <TerminalComponent
              onCommandExecuted={handleCommandExecuted}
              onCommandSuccess={handleCommandSuccess}
              commandHistory={commandHistory}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Command History</CardTitle>
          <CardDescription>
            Review your previously executed AT commands and their responses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            {commandHistory.length === 0 ? (
              <p className="italic text-sm text-muted-foreground font-medium text-center">
                Command History is Empty
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end mb-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                        Clear All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Clear Command History
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete your command history.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={clearHistory}>
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* Command history items */}
                <div className="border rounded-lg overflow-hidden">
                  <Accordion type="single" collapsible className="w-full">
                    {currentItems.map((item, index) => (
                      <AccordionItem
                        value={`item-${startIndex + index}`}
                        key={`${item.timestamp}-${startIndex + index}`}
                      >
                        <AccordionTrigger className="px-4">
                          <div className="flex items-center gap-2 flex-1">
                            {item.status === "success" ? (
                              <CircleCheckIcon className="h-4 w-4 text-green-500 shrink-0" />
                            ) : item.status === "error" ? (
                              <CircleAlertIcon className="h-4 w-4 text-red-500 shrink-0" />
                            ) : (
                              <CircleAlertIcon className="h-4 w-4 text-yellow-500 shrink-0" />
                            )}
                            <span className="text-sm font-medium flex-1">
                              {item.command}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {item.status}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {/* Make it scrollable and fit the screen width */}
                          <div className="px-4 pb-2">
                            <div className="flex items-start gap-x-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCopyCommand(item.response)}
                                className="p-0.5 shrink-0"
                              >
                                <CopyIcon className="w-4 h-4" />
                              </Button>
                              {/* Make sure that it will not overflow the device width */}
                              <p className="text-sm text-balance font-medium whitespace-pre-wrap break-words md:max-w-full max-w-sm md:w-full w-44">
                                {item.response}
                              </p>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>

                {/* Pagination controls */}
                <div className="flex items-center justify-between px-2">
                  <div className="text-sm text-muted-foreground lg:block hidden">
                    Showing {startIndex + 1} to{" "}
                    {Math.min(endIndex, commandHistory.length)} of{" "}
                    {commandHistory.length} commands
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="md:flex items-center gap-2 hidden">
                      <Label
                        htmlFor="items-per-page"
                        className="text-sm font-medium"
                      >
                        Per page
                      </Label>
                      <select
                        id="items-per-page"
                        className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm"
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1); // Reset to first page
                        }}
                      >
                        {[3, 5, 10, 15, 20].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronsLeft className="h-4 w-4" />
                          <span className="sr-only">First page</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(1, prev - 1))
                          }
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="sr-only">Previous page</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(totalPages, prev + 1)
                            )
                          }
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                          <span className="sr-only">Next page</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronsRight className="h-4 w-4" />
                          <span className="sr-only">Last page</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ATTerminalPage;
