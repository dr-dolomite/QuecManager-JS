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

interface CommandHistoryItem {
  command: string;
  response: string;
  timestamp: string;
  status: string;
}

interface QueueResponse {
  command: string;
  response: string;
  status: string;
  error?: string;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const authToken = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;

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
      const encodedCommand = encodeURIComponent(command);
      const response = await fetch(
        `/cgi-bin/quecmanager/at_cmd/at_queue_client.sh?command=${encodedCommand}`,
        {
          method: "GET",
          headers: {
            Authorization: `${authToken}`,
          },
        }
      );
      const data: QueueResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.command || data.status === undefined) {
        throw new Error("Invalid response from server. Check command syntax.");
      }

      let outputText = `> ${command}\n`;
      if (data.response) {
        outputText += data.response;
      }
      setOutput(outputText);

      const newHistoryItem: CommandHistoryItem = {
        command: command,
        response: data.response || "No output",
        timestamp: new Date().toISOString(),
        status: data.status,
      };

      onCommandExecuted(newHistoryItem);

      if (data.status === "success") {
        onCommandSuccess(command);
      } else {
        toast({
          title: "Command Error",
          description: data.response || "Command execution failed",
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
      const encodedCommand = encodeURIComponent(previousCommand);
      const response = await fetch(
        `/cgi-bin/quecmanager/at_cmd/at_queue_client.sh?command=${encodedCommand}`,
        {
          method: "GET",
          headers: {
            Authorization: `${authToken}`,
          },
        }
      );
      const data: QueueResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.command || data.status === undefined) {
        throw new Error("Invalid response from server. Check command syntax.");
      }

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

      if (data.status === "success") {
        onCommandSuccess(previousCommand);
      } else {
        toast({
          title: "Command Error",
          description: data.response || "Command execution failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      setOutput(`> ${previousCommand}\nError: ${errorMessage}`);

      toast({
        title: "Error",
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
          <InputGroupInput
            id="at-terminal-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="text-sm"
            placeholder="Enter AT command here (Press Ctrl + Enter to send)"
          />
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
