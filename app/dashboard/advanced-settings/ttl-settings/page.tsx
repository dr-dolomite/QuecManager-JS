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
import { Skeleton } from "@/components/ui/skeleton";

import GithubButtonToast from "@/components/github-button";

const TTLSettingsPage = () => {
  const [ttlValue, setTtlValue] = useState("0");
  const [ttlState, setTtlState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const toast = useToast();

  // Fetch current TTL state
  useEffect(() => {
    const fetchTTLState = async () => {
      try {
        // const response = await fetch("/api/fetch-ttl");
        const response = await fetch("/cgi-bin/advance/ttl.sh");
        const data = await response.json();
        setTtlState(data.isEnabled);
        setTtlValue(data.currentValue.toString());
        setLoading(false);

        toast.toast({
          title: "Success",
          description: "Fetched TTL settings successfully",
        });

      } catch (err) {
        setError("Failed to fetch TTL settings");
        setLoading(false);
        toast.toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: error,
          action: <GithubButtonToast />,
        });
      }
    };

    fetchTTLState();
  }, []);

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Only send TTL value if state is enabled
    const valueToSend = ttlState ? ttlValue : "0";

    try {
      // const response = await fetch("/api/save-ttl", {
      const response = await fetch("/cgi-bin/advance/ttl.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `ttl=${valueToSend}`,
        // body: JSON.stringify({ command: valueToSend }),
      });

      const data = await response.json();

      if (data.success === true) {
        setSuccess("Settings saved successfully");
        toast.toast({
          title: "Success",
          description: success,
        });
      } else {
        setError(data.error || "Failed to save settings");
        toast.toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: error,
          action: <GithubButtonToast />,
        });
      }
    } catch (err) {
      setError("Failed to save settings");
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">Loading TTL settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>TTL Settings</CardTitle>
        <CardDescription>
          Configure TTL mangling for your connection.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium">TTL Value</label>
              <Input
                type="number"
                min="0"
                max="255"
                value={ttlValue}
                onChange={(e) => setTtlValue(e.target.value)}
                disabled={!ttlState}
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Set the TTL value for your connection (0-255).
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <label className="text-base font-medium">TTL State</label>
                <p className="text-sm text-gray-500">
                  Toggle to enable or disable TTL mangling
                </p>
              </div>
              <Switch checked={ttlState} onCheckedChange={setTtlState} />
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

export default TTLSettingsPage;
