"use client";
import React, { useState, useEffect, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";

interface CommandHistoryItem {
  command: string;
  response: string;
  timestamp: string;
  status: string;
  duration?: number;
  commandId?: string;
}

interface ATCommand {
  description: string;
  command: string;
}

interface QueueResponse {
  command: {
    id: string;
    text: string;
    timestamp: string;
  };
  response: {
    status: string;
    raw_output: string;
    completion_time: string;
    duration_ms: number;
  };
}

const ATTerminalPage = () => {
  const { toast } = useToast();
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

  // New suggestion functions
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const authToken = localStorage.getItem("authToken");

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setSuggestions([]);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ----------------------

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

  const executeCommand = async () => {
    const command = input.trim();

    // Easter egg check
    if (command.toLowerCase() === "tetris") {
      window.open(
        "/utils/dsMDh6647ZGkOLyv60QE/OGwW8ufEw6nWPQSaliNX/games/tetris",
        "_blank"
      );
      setInput("");
      return;
    }

    // Special "prev" command handling
    if (command.toLowerCase() === "prev") {
      if (commandHistory.length > 0) {
        const previousCommand = commandHistory[0].command;

        // Instead of setting the input, directly execute the previous command
        setInput(""); // Clear current input

        // Show a toast that we're executing the command
        toast({
          title: "Executing Previous Command",
          description: `Executing ${previousCommand}`,
        });

        // We need to call executeCommand with the previous command
        // Since we can't recursively call the current function directly with a new value,
        // we need to simulate it by setting up the execution environment

        setIsLoading(true);
        setOutput(`> ${previousCommand}\nExecuting command, please wait...`);

        // Execute the previous command using the same fetch logic
        const executePreviousCommand = async () => {
          try {
            const encodedCommand = encodeURIComponent(previousCommand);
            const response = await fetch(
              `/cgi-bin/quecmanager/at_cmd/at_queue_client.sh?command=${encodedCommand}&wait=1`,
              {
                method: "GET",
                headers: {
                  Authorization: `${authToken}`,
                }
              }
            );
            const data: QueueResponse = await response.json();

            // Format output
            let outputText = `> ${previousCommand}\n`;
            if (data.response?.raw_output) {
              outputText += data.response.raw_output;
            }
            setOutput(outputText);

            // Create new history item
            const newHistoryItem: CommandHistoryItem = {
              command: previousCommand,
              response: data.response.raw_output || "No output",
              timestamp: data.command.timestamp,
              status: data.response.status,
              duration: data.response.duration_ms,
              commandId: data.command.id,
            };

            // Update command history
            setCommandHistory((prev) => [newHistoryItem, ...prev]);

            // Show toast for errors
            if (
              data.response.status === "error" ||
              data.response.status === "timeout"
            ) {
              toast({
                title: `Command ${
                  data.response.status === "timeout" ? "Timeout" : "Error"
                }`,
                description:
                  data.response.raw_output ||
                  `Command execution ${data.response.status}`,
                variant: "destructive",
              });
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "An unknown error occurred";
            setOutput(`> ${previousCommand}\nError: ${errorMessage}`);

            toast({
              title: "Error",
              description: errorMessage,
              variant: "destructive",
            });
          } finally {
            setIsLoading(false);
          }
        };

        executePreviousCommand();
        return;
      } else {
        toast({
          title: "No Previous Command",
          description: "Command history is empty",
          variant: "destructive",
        });
        return;
      }
    }

    if (!command.toUpperCase().startsWith("AT")) {
      toast({
        title: "Invalid Command",
        description: "Command must start with 'AT'",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setInput("");
    setOutput(`> ${command}\nExecuting command, please wait...`);

    try {
      // Send command to queue client with wait flag
      const encodedCommand = encodeURIComponent(command);
      const response = await fetch(
        `/cgi-bin/quecmanager/at_cmd/at_queue_client.sh?command=${encodedCommand}&wait=1`,
              {
                method: "GET",
                headers: {
                  Authorization: `${authToken}`,
                }
              }
      );
      const data: QueueResponse = await response.json();

      // Format output
      let outputText = `> ${command}\n`;
      if (data.response.raw_output) {
        outputText += data.response.raw_output;
      }
      setOutput(outputText);

      // Create new history item
      const newHistoryItem: CommandHistoryItem = {
        command: command,
        response: data.response.raw_output || "No output",
        timestamp: data.command.timestamp,
        status: data.response.status,
        duration: data.response.duration_ms,
        commandId: data.command.id,
      };

      // Update command history
      setCommandHistory((prev) => [newHistoryItem, ...prev]);

      // Update previous commands for successful executions
      if (
        data.response.status === "success" &&
        !previousCommands.includes(command)
      ) {
        setPreviousCommands((prev) => [...prev, command]);
      }

      // Show toast for errors
      if (
        data.response.status === "error" ||
        data.response.status === "timeout"
      ) {
        toast({
          title: `Command ${
            data.response.status === "timeout" ? "Timeout" : "Error"
          }`,
          description:
            data.response.raw_output ||
            `Command execution ${data.response.status}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      setOutput(`> ${command}\nError: ${errorMessage}`);

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    setHighlightedIndex(-1);

    // Debounced suggestion filtering
    const filterSuggestions = () => {
      if (value.trim()) {
        const filtered = previousCommands
          .filter((cmd) => cmd.toLowerCase().includes(value.toLowerCase()))
          .slice(0, 5); // Limit to 5 suggestions
        setSuggestions(filtered);
      } else {
        setSuggestions([]);
      }
    };

    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(filterSuggestions);
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
      window.localStorage.setItem("atCommands", JSON.stringify(newCommands));
      return newCommands;
    });
    setSuggestions((prev) => prev.filter((cmd) => cmd !== commandToRemove));
  };

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
          <div className="grid gap-8 w-full max-w-screen p-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ATOutput">AT Command Output</Label>
              <Textarea
                value={output}
                placeholder="AT command output will appear here..."
                readOnly
                className="h-64 font-mono"
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
                  <ScrollArea className="h-44 p-4">
                    <div className="grid gap-y-2">
                      {commandHistory.map((item, index) => (
                        <Card
                          key={`${item.timestamp}-${index}`}
                          className="hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => handleCopyCommand(item.command)}
                        >
                          <CardContent className="p-3 relative">
                            <ScrollArea className="max-w-xs md:max-w-full">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-2 h-4 w-4"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent card click when removing
                                  removeHistoryItem(index);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <div className="grid gap-2">
                                <div className="flex items-center gap-x-2">
                                  <p className="text-sm font-medium">
                                    {item.command}
                                  </p>
                                  <Badge
                                    className={`${
                                      item.status === "success"
                                        ? "bg-primary text-foreground"
                                        : item.status === "timeout"
                                        ? "bg-yellow-500 text-foreground"
                                        : "bg-red-500 text-red-foreground"
                                    }`}
                                  >
                                    {item.status} -{" "}
                                    {item.duration !== undefined &&
                                      `${item.duration}ms`}
                                  </Badge>
                                </div>
                                {item.response &&
                                  item.response !== "No output" && (
                                    <p className="whitespace-pre-wrap font-mono text-sm">
                                      {item.response}
                                    </p>
                                  )}
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
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="ATI"
                id="ATInput"
                disabled={isLoading}
                autoComplete="off"
              />
              {suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full mt-1 bg-background border rounded-md shadow-lg z-10 w-full"
                >
                  <ScrollArea className="max-h-[200px]">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className={`p-2 cursor-pointer flex items-center justify-between group transition-colors ${
                          index === highlightedIndex
                            ? "bg-accent"
                            : "hover:bg-accent/50"
                        }`}
                        onClick={() => {
                          setInput(suggestion);
                          setSuggestions([]);
                          setHighlightedIndex(-1);
                          inputRef.current?.focus();
                        }}
                      >
                        <p className="text-sm font-medium text-muted-foreground flex-grow">
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
