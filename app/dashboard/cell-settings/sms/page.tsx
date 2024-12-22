"use client";

import { useState, useEffect } from "react";
import { Send, Trash2, Loader2, RotateCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface SMSMessage {
  index: number;
  status: string;
  sender: string;
  timestamp: string;
  message: string;
  originalIndices?: number[]; // To keep track of combined message indices
}

const SMSPage = () => {
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<number[]>([]);
  const [newMessage, setNewMessage] = useState({
    phoneNumber: "",
    message: "",
  });

  const parseSMSMessages = (rawMessages: string[]): SMSMessage[] => {
    const tempMessages: SMSMessage[] = [];
    let currentMessage: Partial<SMSMessage> | null = null;

    // First pass: Parse individual messages
    for (let i = 0; i < rawMessages.length; i++) {
      const line = rawMessages[i];
      
      if (line.startsWith("+CMGL:")) {
        if (currentMessage?.message) {
          tempMessages.push(currentMessage as SMSMessage);
        }

        const match = line.match(/\+CMGL: (\d+),"([^"]+)","([^"]+)",,\"([^"]+)\"/);
        if (match) {
          currentMessage = {
            index: parseInt(match[1]),
            status: match[2],
            sender: match[3],
            timestamp: match[4],
            message: "",
            originalIndices: [parseInt(match[1])]
          };
        }
      } else if (currentMessage && line !== "OK" && !line.startsWith("AT+")) {
        currentMessage.message = currentMessage.message 
          ? `${currentMessage.message}\n${line}`
          : line;
      }
    }

    if (currentMessage?.message) {
      tempMessages.push(currentMessage as SMSMessage);
    }

    // Second pass: Combine messages with same sender and timestamp
    const combinedMessages: SMSMessage[] = [];
    let currentCombined: SMSMessage | null = null;

    tempMessages.forEach((msg) => {
      if (!currentCombined) {
        currentCombined = { ...msg };
      } else if (
        currentCombined.sender === msg.sender &&
        currentCombined.timestamp === msg.timestamp
      ) {
        // Combine messages
        currentCombined.message += '\n' + msg.message;
        currentCombined.originalIndices = [
          ...(currentCombined.originalIndices || []),
          ...(msg.originalIndices || [])
        ];
      } else {
        combinedMessages.push(currentCombined);
        currentCombined = { ...msg };
      }
    });

    if (currentCombined) {
      combinedMessages.push(currentCombined);
    }

    return combinedMessages;
  };

  const refreshSMS = async () => {
    setLoading(true);
    try {
      const response = await fetch("/cgi-bin/settings/change_sms_code.sh?refresh_sms");
      const data = await response.json();
      
      if (!data?.messages || !Array.isArray(data.messages)) {
        throw new Error("Invalid response format");
      }

      const parsed = parseSMSMessages(data.messages);
      setMessages(parsed);
    } catch (error) {
      console.error("Failed to refresh SMS:", error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMessage = (indices: number[]) => {
    setSelectedMessages((prev) => {
      const allIndicesIncluded = indices.every(index => prev.includes(index));
      if (allIndicesIncluded) {
        return prev.filter(index => !indices.includes(index));
      } else {
        return [...new Set([...prev, ...indices])];
      }
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIndices = messages.flatMap(msg => msg.originalIndices || [msg.index]);
      setSelectedMessages(allIndices);
    } else {
      setSelectedMessages([]);
    }
  };

  const formatDateTime = (timestamp: string) => {
    try {
      // Format: "YY/MM/DD,HH:MM:SS+32"
      const [date, timeWithOffset] = timestamp.split(",");
      const [year, month, day] = date.split("/");
      const time = timeWithOffset.replace("+32", "");
      return {
        date: `20${year}-${month}-${day}`,
        time
      };
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return {
        date: "Invalid date",
        time: "Invalid time"
      };
    }
  };

  useEffect(() => {
    refreshSMS();
  }, []);

  return (
    <div className="grid gap-6">
      <Card className="w-full max-w-screen">
        <CardHeader>
          <CardTitle>SMS Inbox</CardTitle>
          <CardDescription>
            <div className="flex justify-between items-center">
              <span>View and manage SMS messages</span>
              <div className="flex items-center space-x-1.5">
                <Checkbox
                  checked={selectedMessages.length === messages.flatMap(m => m.originalIndices || [m.index]).length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm">Select All</span>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full xs:max-w-xs p-4 grid">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="mt-2">Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No messages found
              </p>
            ) : (
              messages.map((sms) => {
                const { date, time } = formatDateTime(sms.timestamp);
                const indices = sms.originalIndices || [sms.index];
                
                return (
                  <Dialog key={indices.join('-')}>
                    <DialogTrigger className="w-full">
                      <Card className="my-2 dark:hover:bg-slate-900 hover:bg-slate-100">
                        <CardHeader>
                          <div className="flex justify-between items-center">
                            <CardTitle>{sms.sender}</CardTitle>
                            <div
                              className="flex items-center space-x-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="text-muted-foreground font-medium text-xs">
                                {indices.join(', ')}
                              </p>
                              <Checkbox
                                checked={indices.every(index => selectedMessages.includes(index))}
                                onCheckedChange={() => handleSelectMessage(indices)}
                              />
                            </div>
                          </div>
                          <CardDescription className="text-left">
                            {date} at {time}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="line-clamp-3">{sms.message}</p>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{sms.sender}</DialogTitle>
                        <DialogDescription>
                          {date} at {time}
                        </DialogDescription>
                      </DialogHeader>
                      <p className="whitespace-pre-line">{sms.message}</p>
                      <Separator className="my-2" />
                      <Textarea
                        placeholder={`Reply to ${sms.sender}...`}
                        className="h-24"
                        readOnly
                      />
                      <div className="flex justify-end">
                        <Button disabled>
                          <Send className="h-4 w-4 mr-2" />
                          Send
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                );
              })
            )}
          </ScrollArea>
        </CardContent>
        <CardFooter className="border-t py-4">
          <div className="flex w-full justify-between items-center">
            <Button variant="outline" onClick={refreshSMS} disabled={loading}>
              <RotateCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="destructive"
              disabled={selectedMessages.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send SMS</CardTitle>
          <CardDescription>Send a new SMS message</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <Input
              placeholder="Recipient Number"
              value={newMessage.phoneNumber}
              onChange={(e) =>
                setNewMessage((prev) => ({
                  ...prev,
                  phoneNumber: e.target.value,
                }))
              }
              readOnly
            />
            <Textarea
              placeholder="Sending message is still in development..."
              className="h-32"
              value={newMessage.message}
              onChange={(e) =>
                setNewMessage((prev) => ({ ...prev, message: e.target.value }))
              }
              readOnly
            />
            <div className="flex justify-end">
              <Button disabled>
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SMSPage;