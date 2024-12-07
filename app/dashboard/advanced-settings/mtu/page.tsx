"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import GithubButtonToast from "@/components/github-button";

const MTUSettingsPage = () => {
  const [mtuValue, setMtuValue] = useState("1500");
  const [mtuState, setMtuState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const toast = useToast();

  // Fetch current MTU state
  useEffect(() => {
    const fetchMtuState = async () => {
      try {
        const response = await fetch("/cgi-bin/advance/mtu.sh");
        const data = await response.json();
        
        // Update state based on response
        setMtuState(data.isEnabled);
        setMtuValue(data.currentValue.toString());
        setLoading(false);

      } catch (err) {
        setError("Failed to fetch MTU settings");
        setLoading(false);
        toast.toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: "Failed to fetch MTU settings",
          action: <GithubButtonToast />,
        });
      }
    };

    fetchMtuState();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Determine the value to send
    const valueToSend = mtuState ? mtuValue : "disable";

    try {
      const response = await fetch("/cgi-bin/advance/mtu.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `mtu=${valueToSend}`,
      });

      const data = await response.json();

      if (data.success === true) {
        toast.toast({
          title: "Success",
          description: data.message || "MTU settings saved successfully",
        });
      } else {
        toast.toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: data.error || "Failed to save MTU settings",
          action: <GithubButtonToast />,
        });
      }
    } catch (err) {
      setError("Failed to save MTU settings");
      toast.toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Network error while saving MTU settings",
        action: <GithubButtonToast />,
      });
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">Loading MTU settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>MTU Settings</CardTitle>
        <CardDescription>
          Configure MTU for rmnet_data0 interface.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium">MTU Value</label>
              <Input
                type="number"
                value={mtuValue}
                onChange={(e) => setMtuValue(e.target.value)}
                disabled={!mtuState}
                className="mt-1"
                min="68"  // Minimum valid MTU
                max="9000"  // Maximum typical MTU
              />
              <p className="text-sm text-gray-500 mt-1">
                Set the MTU value for your connection (default: 1500).
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <label className="text-base font-medium">MTU State</label>
                <p className="text-sm text-gray-500">
                  Toggle to enable or disable custom MTU value.
                </p>
              </div>
              <Switch 
                checked={mtuState} 
                onCheckedChange={(checked) => {
                  setMtuState(checked);
                  // Reset to default when disabled
                  if (!checked) setMtuValue("1500");
                }} 
              />
            </div>
          </div>

          <Button type="submit" className="w-full">
            Save Configuration
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MTUSettingsPage;