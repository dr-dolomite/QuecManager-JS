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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Send, X, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
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

interface CommandHistoryItem {
  command: string;
  response: string;
  timestamp: string;
}

interface CommandResponse {
  command: string;
  output: string;
}

const ATTerminalPage = () => {
  const [output, setOutput] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [previousCommands, setPreviousCommands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  const constructATCommand = (command: string): string => {
    return command.trim();
  };

  const parseResponse = (responseText: string): string => {
    try {
      const parsedResponse = JSON.parse(responseText) as CommandResponse;
      return parsedResponse.output;
    } catch (error) {
      return responseText;
    }
  };

  const executeCommand = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    const currentCommand = input;
    setInput("");
    setOutput("");

    try {
      const command = constructATCommand(currentCommand);
      const response = await fetch("/api/at-handler", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command }),
      });

      const rawResult = await response.text();
      const parsedResult = parseResponse(rawResult);

      // Create new history item
      const newHistoryItem: CommandHistoryItem = {
        command: currentCommand,
        response: parsedResult,
        timestamp: new Date().toISOString(),
      };

      // Update command history
      setCommandHistory((prev) => [newHistoryItem, ...prev]);

      // Update output
      setOutput(
        (prev) =>
          `${prev}${prev ? "\n" : ""}> ${currentCommand}\n${parsedResult}`
      );

      // Update previous commands for autocomplete
      if (!previousCommands.includes(currentCommand)) {
        setPreviousCommands((prev) => [...prev, currentCommand]);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      setOutput(
        (prev) => `${prev}${prev ? "\n" : ""}Error: ${errorMessage}`
      );
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>AT Terminal</CardTitle>
        <CardDescription>Send AT commands to your device</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="ATOutput">AT Command Output</Label>
            <Textarea
              value={output}
              placeholder="AT command output will appear here..."
              readOnly
              className="h-[200px] font-mono"
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
                        <AlertDialogTitle>Clear Command History</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your command history.
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
                <ScrollArea className="h-[160px] p-4">
                  <div className="grid gap-y-2">
                    {commandHistory.map((item, index) => (
                      <Card key={`${item.timestamp}-${index}`}>
                        <CardContent className="p-4 relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 h-6 w-6"
                            onClick={() => removeHistoryItem(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <div className="grid gap-2">
                            <p className="text-sm font-medium">{item.command}</p>
                            <p className="whitespace-pre-wrap font-mono">
                              {item.response}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            <Separator className="mt-2" />
          </div>

          <div className="grid w-full gap-1.5 relative">
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
              <div className="absolute top-full mt-1 w-full bg-background border rounded-md shadow-lg z-10">
                <ScrollArea className="h-24">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-2 hover:bg-accent cursor-pointer"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <p className="text-sm font-medium text-muted-foreground">
                        {suggestion}
                      </p>
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
  );
};

export default ATTerminalPage;