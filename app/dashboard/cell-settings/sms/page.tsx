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
import { toast } from "@/hooks/use-toast";
import { PhoneInput } from "@/components/sms/phone-input";
import { ShineBorder } from "@/components/ui/shine-border";

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
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  // const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");

  const processPhoneNumber = (phone: string) => {
    // Remove the "+" sign and any whitespace
    return phone.replace(/\+|\s/g, "");
  };

  const validateInputs = (phone: string, message: string) => {
    if (!phone.trim() || !message.trim()) {
      toast({
        title: "Validation Error",
        description: "Phone number and message are required",
        variant: "destructive",
      });
      return false;
    }

    // Phone number validation (only numbers allowed after processing)
    const processedPhone = processPhoneNumber(phone);
    if (!/^\d+$/.test(processedPhone)) {
      toast({
        title: "Validation Error",
        description: "Phone number should contain only numbers",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const sendMessage = async () => {
    if (!validateInputs(sendTo, newMessage)) {
      return;
    }

    setSending(true);
    try {
      const payload = {
        phone: processPhoneNumber(sendTo.trim()),
        message: newMessage.trim(),
      };

      const response = await fetch(
        `/cgi-bin/quecmanager/cell-settings/sms/sms_send.sh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          body: new URLSearchParams(payload).toString(),
        }
      );

      const data = await response.json();
      console.log("Response data:", data);

      if (data.success) {
        toast({
          title: "Success",
          description: "Message sent successfully",
        });
        setSendTo("");
        setNewMessage("");
        refreshSMS();
      } else {
        throw new Error(data.error || "Failed to send message");
      }
    } catch (error) {
      console.error("Send operation failed:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (recipient: string, message: string) => {
    if (!validateInputs(recipient, message)) {
      return;
    }

    setSending(true);
    try {
      const payload = {
        phone: processPhoneNumber(recipient.trim()),
        message: message.trim(),
      };

      // Changed the API endpoint to match the working sendMessage function
      const response = await fetch(
        `/cgi-bin/quecmanager/cell-settings/sms/sms_send.sh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          body: new URLSearchParams(payload).toString(),
        }
      );

      const data = await response.json();
      console.log("Response data:", data);

      if (data.success) {
        toast({
          title: "Success",
          description: "Reply sent successfully",
        });
        setReplyMessage(""); // Clear reply message
        refreshSMS();
      } else {
        throw new Error(data.error || "Failed to send reply");
      }
    } catch (error) {
      console.error("Reply operation failed:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const parseSMSMessages = (rawMessages: { msg: any[] }): SMSMessage[] => {
    const tempMessages: Record<string, SMSMessage> = {};
    const combinedMessages: SMSMessage[] = [];

    rawMessages.msg.forEach((message) => {
      if (message.reference !== undefined && message.part !== undefined) {
        const key = `${message.sender}-${message.reference}`;
        if (!tempMessages[key]) {
          tempMessages[key] = {
            index: message.index,
            status: "received",
            sender: message.sender,
            timestamp: message.timestamp,
            message: "",
            originalIndices: [],
          };
        }

        tempMessages[key].message += message.content;
        tempMessages[key].originalIndices?.push(message.index);

        if (message.part === message.total) {
          combinedMessages.push(tempMessages[key]);
          delete tempMessages[key];
        }
      } else {
        combinedMessages.push({
          index: message.index,
          status: "received",
          sender: message.sender,
          timestamp: message.timestamp,
          message: message.content,
          originalIndices: [message.index],
        });
      }
    });

    Object.values(tempMessages).forEach((incompleteMessage) => {
      combinedMessages.push(incompleteMessage);
    });

    // Sort messages by timestamp in descending order (newest first)
    return combinedMessages.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };

  const refreshSMS = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/cell-settings/sms/sms_inbox.sh"
      );
      const data = await response.json();

      if (!data?.msg || !Array.isArray(data.msg)) {
        throw new Error("Invalid response format");
      }

      const parsed = parseSMSMessages(data);
      setMessages(parsed);
      setSelectedMessages([]); // Clear selections after refresh
      setIsSelectAllChecked(false); // Clear select all state
    } catch (error) {
      console.error("Failed to refresh SMS:", error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteMessages = async (indices: number[] | "all") => {
    setLoading(true);
    try {
      // Validate indices
      if (indices !== "all" && (!indices.length || indices.length === 0)) {
        throw new Error("No messages selected");
      }

      // Create the payload - use "all" if requested, otherwise join indices
      let payload: string;
      if (indices === "all") {
        payload = "all";
        console.log("Deleting all messages");
      } else {
        // Sort and deduplicate indices
        const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b);
        payload = uniqueIndices.join(",");
        console.log("Deleting messages with indices:", payload);
      }

      const response = await fetch(
        `/cgi-bin/quecmanager/cell-settings/sms/sms_delete.sh?indexes=${payload}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
        }
      );

      // Get the raw response text first for debugging
      const responseText = await response.text();
      console.log("Raw delete response:", responseText);

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("Parsed delete response:", data);
      } catch (parseError) {
        console.error("Failed to parse JSON response:", parseError);
        throw new Error(
          `Invalid response format: ${responseText.substring(0, 100)}`
        );
      }

      // Check status from JSON response
      if (data.status === "success" || data.status === "partial") {
        toast({
          title: data.status === "success" ? "Success!" : "Partial Success",
          description: data.message || "Messages deleted",
        });

        // Refresh messages list
        await refreshSMS();
      } else {
        throw new Error(data.message || "Failed to delete messages");
      }
    } catch (error) {
      console.error("Delete operation failed:", error);
      toast({
        title: "Error!",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedMessages = () => {
    if (selectedMessages.length === 0) {
      toast({
        title: "Delete Messages",
        description: "No messages selected",
      });
      return;
    }

    // If "Select All" checkbox is checked, send "all" to backend
    if (isSelectAllChecked) {
      deleteMessages("all");
    } else {
      // Otherwise send the specific selected indexes
      deleteMessages(selectedMessages);
    }
  };

  const handleSelectMessage = (indices: number[]) => {
    // When manually selecting/deselecting, uncheck "Select All"
    setIsSelectAllChecked(false);

    setSelectedMessages((prev) => {
      const currentSelectedSet = new Set(prev);
      const allSelected = indices.every((index) =>
        currentSelectedSet.has(index)
      );

      if (allSelected) {
        indices.forEach((index) => currentSelectedSet.delete(index));
      } else {
        indices.forEach((index) => currentSelectedSet.add(index));
      }

      return Array.from(currentSelectedSet);
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setIsSelectAllChecked(checked);

    if (checked) {
      const allIndices = messages.flatMap(
        (msg) => msg.originalIndices || [msg.index]
      );
      setSelectedMessages(allIndices);
    } else {
      setSelectedMessages([]);
    }
  };

  const formatDateTime = (timestamp: string) => {
    try {
      const [datePart, timePart] = timestamp.split(" ");
      const [month, day, year] = datePart.split("/");
      const formattedDate = `20${year}-${month}-${day}`;

      return {
        date: formattedDate,
        time: timePart,
      };
    } catch (error) {
      console.error("Error parsing timestamp:", error);
      return {
        date: "Invalid date",
        time: "Invalid time",
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
          <div className="text-sm text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>View and manage SMS messages</span>
              <div className="flex items-center space-x-1.5">
                <Checkbox
                  checked={
                    messages.length > 0 &&
                    selectedMessages.length ===
                      messages.flatMap((m) => m.originalIndices || [m.index])
                        .length
                  }
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm">Select All</span>
              </div>
            </div>
          </div>
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
                  <Dialog key={indices.join("-")}>
                    <DialogTrigger className="w-full" asChild>
                      <Card className="my-2 dark:hover:bg-slate-900 hover:bg-slate-100">
                        <CardHeader>
                          <div className="flex justify-between items-center">
                            <CardTitle>{sms.sender}</CardTitle>
                            <div
                              className="flex items-center space-x-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="text-muted-foreground font-medium text-xs">
                                {indices.join(", ")}
                              </p>
                              <Checkbox
                                checked={indices.every((index) =>
                                  selectedMessages.includes(index)
                                )}
                                onCheckedChange={() =>
                                  handleSelectMessage(indices)
                                }
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
                      <div className="space-y-4">
                        <Textarea
                          placeholder={`Reply to ${sms.sender}...`}
                          className="h-24"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <Button
                            onClick={() =>
                              handleReply(sms.sender, replyMessage)
                            }
                            disabled={sending || !replyMessage.trim()}
                          >
                            {sending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            {sending ? "Sending..." : "Reply"}
                          </Button>
                        </div>
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
              disabled={selectedMessages.length === 0 || loading}
              onClick={deleteSelectedMessages}
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
            {/* <Input
              placeholder='Recipient number with country code not including "+" symbol.'
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              required
            /> */}
            <PhoneInput
              value={sendTo}
              onChange={(value) => setSendTo(value)}
              placeholder="Enter recipient phone number"
            />
            <Textarea
              placeholder="Type your SMS here..."
              className="h-32"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              required
            />
            <div className="flex justify-end">
              <Button
                onClick={sendMessage}
                disabled={sending || !sendTo.trim() || !newMessage.trim()}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? "Sending SMS..." : "Send SMS"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SMSPage;
