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
  index: string;
  status: string;
  sender: string;
  date: string;
  time: string;
  message: string;
}

const SMSPage = () => {
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState({
    phoneNumber: "",
    message: "",
  });

  const sendCommand = async (command: string): Promise<any> => {
    try {
      const response = await fetch("/cgi-bin/atinout_handler.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `command=${encodeURIComponent(command)}`,
      });
      return await response.json();
    } catch (error) {
      console.error("AT command failed:", error);
      throw error;
    }
  };

  const parseSMSData = (data: string): SMSMessage[] => {
    const messages: SMSMessage[] = [];
    const lines = data.split("\n");
    let currentMessage: Partial<SMSMessage> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === "OK" || line === 'AT+CMGL="ALL"') continue;

      if (line.startsWith("+CMGL:")) {
        if (currentMessage && currentMessage.message) {
          messages.push(currentMessage as SMSMessage);
        }

        const headerMatch = line.match(
          /\+CMGL:\s*(\d+),"([^"]*?)","([^"]*?)",,"([^"]*?)"/
        );
        if (headerMatch) {
          // Parse the date and time from format "YY/MM/DD,HH:MM:SS"
          const [date, time] = headerMatch[4].replace("+32", "").split(",");

          // Format date as YYYY-MM-DD
          const [year, month, day] = date.split("/");
          const formattedDate = `20${year}-${month}-${day}`;

          currentMessage = {
            index: headerMatch[1],
            status: headerMatch[2],
            sender: headerMatch[3],
            date: formattedDate,
            time: time,
            message: "",
          };
        }
      } else if (currentMessage) {
        currentMessage.message = `${currentMessage.message || ""}${
          currentMessage.message ? "\n" : ""
        }${line}`;
      }
    }

    if (currentMessage && currentMessage.message) {
      messages.push(currentMessage as SMSMessage);
    }

    return messages;
  };

  const refreshSMS = async () => {
    setLoading(true);
    try {
      await sendCommand("AT+CMGF=1");
      // wait for 2 seconds to ensure the mode is set
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await sendCommand('AT+CMGL="ALL"');

      let rawData: string;
      if (typeof response === "string") {
        rawData = response;
      } else if (response?.result) {
        rawData = response.result;
      } else if (response?.output) {
        rawData = response.output;
      } else {
        throw new Error("No valid data received");
      }

      const parsedMessages = parseSMSData(rawData);
      setMessages(parsedMessages);
    } catch (error) {
      console.error("Failed to refresh SMS:", error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMessage = (index: string) => {
    setSelectedMessages((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedMessages(checked ? messages.map((m) => m.index) : []);
  };

  const handleDeleteSelected = async () => {
    if (!selectedMessages.length) return;

    try {
      for (const index of selectedMessages) {
        await sendCommand(`AT+CMGD=${index}`);
      }
      await refreshSMS();
      setSelectedMessages([]);
    } catch (error) {
      console.error("Failed to delete messages:", error);
    }
  };

  const handleSendSMS = async () => {
    const { phoneNumber, message } = newMessage;
    if (!phoneNumber || !message) {
      alert("Please enter both phone number and message");
      return;
    }

    try {
      await sendCommand(`AT+CMGS="${phoneNumber}"`);
      await sendCommand(`${message}\x1A`);
      setNewMessage({ phoneNumber: "", message: "" });
      await refreshSMS();
    } catch (error) {
      console.error("Failed to send SMS:", error);
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
                  checked={selectedMessages.length === messages.length}
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
                messages.map((sms) => (
                  <Dialog key={sms.index}>
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
                                {sms.index}
                              </p>
                              <Checkbox
                                checked={selectedMessages.includes(sms.index)}
                                onCheckedChange={() =>
                                  handleSelectMessage(sms.index)
                                }
                              />
                            </div>
                          </div>
                          <CardDescription className="text-left">
                            {sms.date} at {sms.time}
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
                          {sms.date} at {sms.time}
                        </DialogDescription>
                      </DialogHeader>
                      <p>{sms.message}</p>
                      <Separator className="my-2" />
                      <Textarea
                        placeholder={`Reply to ${sms.sender}...`}
                        className="h-24"
                        readOnly
                      />
                      <div className="flex justify-end">
                        <Button onClick={handleSendSMS} disabled>
                          <Send className="h-4 w-4 mr-2" />
                          Send
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))
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
              onClick={handleDeleteSelected}
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
              <Button onClick={handleSendSMS} disabled>
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
