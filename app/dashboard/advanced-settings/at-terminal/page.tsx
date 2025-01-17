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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Send, X, Trash2, Copy } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CommandHistoryItem {
  command: string;
  response: string;
  timestamp: string;
}

interface CommandResponse {
  command: string;
  output: string;
}

interface ATCommand {
  description: string;
  command: string;
}

const ATTerminalPage = () => {
  const toast = useToast();
  const [output, setOutput] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>(
    []
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [previousCommands, setPreviousCommands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [commonCommands, setCommonCommands] = useState<ATCommand[]>([]);
  const [isLoadingCommands, setIsLoadingCommands] = useState<boolean>(true);

  // Fetch common AT commands
  useEffect(() => {
    const fetchCommands = async () => {
      try {
        const response = await fetch("/cgi-bin/advance/fetch_commands.sh");
        // const response = await fetch("/fetch-commands");
        const data = await response.json();

        // Transform the data into ATCommand array
        const commands: ATCommand[] = Object.entries(data)
          .filter(([key]) => key !== "error") // Filter out error entry if present
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
        toast.toast({
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

  // Load previous commands and history from localStorage on component mount
  useEffect(() => {
    const storedHistory = window.localStorage.getItem("atCommandHistory");
    const storedCommands = window.localStorage.getItem("atCommands");

    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory);
        setCommandHistory(parsedHistory);
      } catch (e) {
        console.error("Failed to parse command history:", e);
        setCommandHistory([]);
      }
    }

    if (storedCommands) {
      try {
        const parsedCommands = JSON.parse(storedCommands);
        setPreviousCommands(parsedCommands);
      } catch (e) {
        console.error("Failed to parse previous commands:", e);
        setPreviousCommands([]);
      }
    }
  }, []);

  // Save command history to localStorage whenever it changes
  useEffect(() => {
    if (commandHistory.length > 0) {
      window.localStorage.setItem(
        "atCommandHistory",
        JSON.stringify(commandHistory)
      );
    }
  }, [commandHistory]);

  // Save previous commands to localStorage whenever they change
  useEffect(() => {
    if (previousCommands.length > 0) {
      window.localStorage.setItem(
        "atCommands",
        JSON.stringify(previousCommands)
      );
    }
  }, [previousCommands]);

  const executeCommand = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    const currentCommand = input;
    setInput("");
    
    // Clear previous output and show new command
    setOutput(`> ${currentCommand}\nExecuting command, please wait...`);

    try {
      // Queue the command
      const encodedCommand = encodeURIComponent(currentCommand);
      const queueResponse = await fetch(`/cgi-bin/at_command.sh?command=${encodedCommand}`);
      const queueData = await queueResponse.json();

      if (queueData.status !== "queued") {
        throw new Error("Failed to queue command");
      }

      const commandId = queueData.id;
      let attempts = 0;
      const maxAttempts = 360; // 3 minutes with 0.5s intervals
      let result = null;

      // Poll for results
      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          const resultResponse = await fetch(`/cgi-bin/at_results.sh?action=get_by_id&id=${commandId}`);
          const resultData = await resultResponse.json();

          // Check if we got a valid result (not null and has actual data)
          if (resultData && !resultData.error && resultData.command) {
            result = resultData;
            break;
          }

          // If no result yet, wait and retry
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error("Polling error:", error);
          if (attempts >= maxAttempts) {
            throw new Error("Command timed out after 3 minutes");
          }
          // If error occurs, wait and retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!result) {
        throw new Error("Command execution timed out");
      }

      // Update output with result
      setOutput(`> ${currentCommand}\n${result.response || "No output"}`);

      // Create new history item
      const newHistoryItem: CommandHistoryItem = {
        command: currentCommand,
        response: result.response || "No output",
        timestamp: new Date().toISOString(),
      };

      // Update command history
      setCommandHistory((prev) => [newHistoryItem, ...prev]);

      // Update previous commands for autocomplete
      if (!previousCommands.includes(currentCommand)) {
        setPreviousCommands((prev) => [...prev, currentCommand]);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      setOutput(`> ${currentCommand}\nError: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // Update suggestions
    if (value.trim()) {
      const filtered = previousCommands.filter((cmd) =>
        cmd.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  const removeHistoryItem = (index: number) => {
    setCommandHistory((prev) => {
      const newHistory = [...prev];
      newHistory.splice(index, 1);

      // Update localStorage after removing item
      if (newHistory.length === 0) {
        window.localStorage.removeItem("atCommandHistory");
      }

      return newHistory;
    });
  };

  const clearHistory = () => {
    setCommandHistory([]);
    window.localStorage.removeItem("atCommandHistory");
  };

  const removeSuggestion = (commandToRemove: string) => {
    setPreviousCommands((prev) => {
      const newCommands = prev.filter((cmd) => cmd !== commandToRemove);
      // Update localStorage with filtered commands
      window.localStorage.setItem("atCommands", JSON.stringify(newCommands));
      return newCommands;
    });
    // Update suggestions to remove the deleted command
    setSuggestions((prev) => prev.filter((cmd) => cmd !== commandToRemove));
  };

  const handleCopyCommand = async (command: string) => {
    try {
      // Try using the Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(command);
      } else {
        // Fallback for browsers without clipboard API or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = command;

        // Make the textarea out of viewport
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

      toast.toast({
        title: "Copied!",
        description: `Command "${command}" copied to clipboard`,
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to copy command:", error);
      toast.toast({
        title: "Error",
        description: "Failed to copy command to clipboard",
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
          <CardDescription>Send AT commands to your device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 w-full max-w-screen p-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ATOutput">AT Command Output</Label>
              <Textarea
                value={output}
                placeholder="AT command output will appear here..."
                readOnly
                className="h-[240px] font-mono"
                id="ATOutput"
              />
            </div>

            <div>
              <Separator className="mb-2" />
              {commandHistory.length === 0 ? (
                <p className="italic text-sm text-muted-foreground font-medium text-center">
                  Command History is Empty
                </p>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Command History</Label>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4 text-rose-500" />
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
                  <ScrollArea className="h-[180px] p-4">
                    <div className="grid gap-y-2">
                      {commandHistory.map((item, index) => (
                        <Card key={`${item.timestamp}-${index}`}>
                          <CardContent className="p-3 relative">
                            <ScrollArea className="max-w-xs md:max-w-full">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-2 h-4 w-4"
                                onClick={() => removeHistoryItem(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <div className="grid gap-2">
                                <p className="text-sm font-medium">
                                  {item.command}
                                </p>
                                <p className="whitespace-pre-wrap font-mono">
                                  {item.response}
                                </p>
                              </div>
                              <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              <Separator className="mt-2" />
            </div>

            <div className="grid gap-1.5 relative">
              <Label htmlFor="ATInput">AT Command Input</Label>
              <Input
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="ATI"
                id="ATInput"
                disabled={isLoading}
                autoComplete="off"
              />
              {suggestions.length > 0 && (
                <div className="absolute top-full mt-1 bg-background border rounded-md shadow-lg z-10">
                  <ScrollArea className="h-24">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="p-2 hover:bg-accent cursor-pointer flex items-center justify-between group"
                      >
                        <p
                          className="text-sm font-medium text-muted-foreground flex-grow"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          {suggestion}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSuggestion(suggestion);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Your successful commands will be saved for autocomplete.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="grid border-t py-4">
          <Button onClick={executeCommand} disabled={isLoading}>
            <Send className="mr-2" />
            {isLoading ? "Sending..." : "Send Command"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common AT Commands List</CardTitle>
          <CardDescription>
            Here are some common AT commands you can try:
          </CardDescription>
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
                      <Copy
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

export default ATTerminalPage;
