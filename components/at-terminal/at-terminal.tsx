"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { CopyIcon, CornerDownLeft, Dot, RefreshCcw, Terminal } from "lucide-react";
import { BsCircleFill } from "react-icons/bs";
import { useToast } from "@/hooks/use-toast";
import { atCommandSender } from "@/utils/at-command";

interface CommandHistoryItem {
  command: string;
  response: string;
  timestamp: string;
  status: string;
}

interface TerminalComponentProps {
  onCommandExecuted: (item: CommandHistoryItem) => void;
  onCommandSuccess: (command: string) => void;
  commandHistory: CommandHistoryItem[];
}

const TerminalComponent = ({ onCommandExecuted, onCommandSuccess, commandHistory }: TerminalComponentProps) => {
  const { toast } = useToast();
  const [output, setOutput] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [suggestion, setSuggestion] = useState<string>("");
  const [commandDictionary, setCommandDictionary] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load command dictionary from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem("atCommandDictionary");
      if (stored) {
        try {
          setCommandDictionary(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse command dictionary:", e);
        }
      }
    }
  }, []);

  // Save command dictionary to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && commandDictionary.length > 0) {
      localStorage.setItem("atCommandDictionary", JSON.stringify(commandDictionary));
    }
  }, [commandDictionary]);

  // Update suggestion when input changes
  useEffect(() => {
    if (input.trim() && commandDictionary.length > 0) {
      const normalizedInput = input.toUpperCase().trim();
      
      // Find matching command that starts with the input
      const match = commandDictionary.find(cmd => 
        cmd.toUpperCase().startsWith(normalizedInput) && cmd.toUpperCase() !== normalizedInput
      );
      
      if (match) {
        // Get the remaining part of the command
        setSuggestion(match.substring(input.trim().length));
      } else {
        setSuggestion("");
      }
    } else {
      setSuggestion("");
    }
  }, [input, commandDictionary]);

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
      // Use the at-command utility which properly handles errors
      const data = await atCommandSender(command);

      let outputText = `> ${command}\n`;
      if (data.response) {
        outputText += data.response;
      }
      setOutput(outputText);
      console.log("AT Command Response:", data);

      const newHistoryItem: CommandHistoryItem = {
        command: command,
        response: data.response || "No output",
        timestamp: new Date().toISOString(),
        status: data.status,
      };

      onCommandExecuted(newHistoryItem);

      // Add command to dictionary if successful and not already present
      if (data.status === "success" && !commandDictionary.includes(command)) {
        setCommandDictionary(prev => [...prev, command]);
      }

      if (data.status === "success") {
        onCommandSuccess(command);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      const errorOutput = `> ${command}\nError: ${errorMessage}`;
      setOutput(errorOutput);

      // Create error history item
      const errorHistoryItem: CommandHistoryItem = {
        command: command,
        response: errorMessage,
        timestamp: new Date().toISOString(),
        status: "error",
      };
      onCommandExecuted(errorHistoryItem);

      toast({
        title: "Command Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Tab key - autocomplete suggestion
    if (e.key === "Tab" && suggestion) {
      e.preventDefault();
      setInput(input + suggestion);
      setSuggestion("");
    }
    
    // Ctrl+Enter - execute command
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  const handleCopyOutput = async () => {
    if (!output) return;
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(output);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = output;
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
        description: "Terminal output copied to clipboard",
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to copy output:", error);
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleSendPreviousCommand = async () => {
    if (commandHistory.length === 0) {
      toast({
        title: "No Previous Command",
        description: "Command history is empty",
        variant: "destructive",
      });
      return;
    }

    const previousCommand = commandHistory[0].command;
    
    toast({
      title: "Executing Previous Command",
      description: `Executing: ${previousCommand}`,
      duration: 2000,
    });

    // Set the command in input and execute it
    setInput(previousCommand);
    setIsLoading(true);
    setOutput(`> ${previousCommand}\nExecuting command, please wait...`);

    try {
      // Use the at-command utility which properly handles errors
      const data = await atCommandSender(previousCommand);

      let outputText = `> ${previousCommand}\n`;
      if (data.response) {
        outputText += data.response;
      }
      setOutput(outputText);

      const newHistoryItem: CommandHistoryItem = {
        command: previousCommand,
        response: data.response || "No output",
        timestamp: new Date().toISOString(),
        status: data.status,
      };

      onCommandExecuted(newHistoryItem);

      // Add command to dictionary if successful and not already present
      if (data.status === "success" && !commandDictionary.includes(previousCommand)) {
        setCommandDictionary(prev => [...prev, previousCommand]);
      }

      if (data.status === "success") {
        onCommandSuccess(previousCommand);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      const errorOutput = `> ${previousCommand}\nError: ${errorMessage}`;
      setOutput(errorOutput);

      // Create error history item
      const errorHistoryItem: CommandHistoryItem = {
        command: previousCommand,
        response: errorMessage,
        timestamp: new Date().toISOString(),
        status: "error",
      };
      onCommandExecuted(errorHistoryItem);

      toast({
        title: "Command Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setInput(""); // Clear input after execution
    }
  };

  return (
    <div className="grid w-full lg:max-w-full max-w-sm gap-4">
      <InputGroup>
        <InputGroupTextarea
          ref={textareaRef}
          id="at-terminal-output"
          value={output}
          placeholder="Command response will appear here..."
          className="min-h-[200px] font-mono text-sm"
          readOnly
        />
        <InputGroupAddon align="block-end" className="border-t">
          <div className="relative flex-1">
            <InputGroupInput
              id="at-terminal-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-sm relative z-10 bg-transparent"
              placeholder="Enter AT command here (Press Tab to autocomplete, Ctrl + Enter to send)"
            />
            {suggestion && (
              <div className="absolute inset-0 flex items-center px-3 pointer-events-none z-0">
                <span className="text-sm text-transparent select-none">
                  {input}
                </span>
                <span className="text-sm text-muted-foreground/50 select-none">
                  {suggestion}
                </span>
              </div>
            )}
          </div>
          <InputGroupButton 
            size="sm" 
            className="ml-auto mt-1" 
            variant="default"
            onClick={executeCommand}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? "Sending..." : "Send AT Command"} <CornerDownLeft />
          </InputGroupButton>
        </InputGroupAddon>
        <InputGroupAddon align="block-start" className="border-b">
          <InputGroupText className="font-mono font-medium">
            <Terminal className="w-4 h-4" />
            AT Command Terminal
          </InputGroupText>
          <InputGroupButton 
            className="ml-auto" 
            size="icon-xs"
            onClick={handleSendPreviousCommand}
            disabled={commandHistory.length === 0 || isLoading}
          >
            <RefreshCcw />
          </InputGroupButton>
          <InputGroupButton 
            variant="ghost" 
            size="icon-xs"
            onClick={handleCopyOutput}
            disabled={!output}
          >
            <CopyIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
};

export default TerminalComponent;
