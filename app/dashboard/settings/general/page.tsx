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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import GithubButtonToast from "@/components/github-button";
import { Skeleton } from "@/components/ui/skeleton";

const GeneralSettingsPage = () => {
  const [config, setConfig] = useState({
    AT_port: "Unknown",
    AT_port_custom: "Unknown",
    data_refresh_rate: "Unknown",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toast = useToast();

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/config-fetch");
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setConfig(data);
      }
    } catch (error) {
      setError("Failed to fetch configuration");
      toast.toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Please report this issue",
        action: <GithubButtonToast />,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (
    section: "AT_port" | "AT_port_custom" | "data_refresh_rate"
  ) => {
    try {
      setSaving(true);
      const response = await fetch("/api/config-save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast.toast({
        title: "Success",
        description: "Configuration saved successfully!",
      });

      // Refresh the configuration
      await fetchConfig();
    } catch (error) {
      toast.toast({
        variant: "destructive",
        title: "Save failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save configuration",
        action: <GithubButtonToast />,
      });
    } finally {
      setSaving(false);
    }
  };

  const refreshRateInSeconds = Math.floor(
    parseInt(config.data_refresh_rate) / 1000
  );

  if (error) {
    return <div className="grid gap-6 text-red-500">{error}</div>;
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>AT Port Main Interface</CardTitle>
          <CardDescription>
            Change the main interface of the AT Port configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave("AT_port");
            }}
          >
            {loading && <Skeleton className="h-8" />}
            {!loading && (
              <Input
                placeholder="Main AT port interface"
                value={config.AT_port}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, AT_port: e.target.value }))
                }
              />
            )}
          </form>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={() => handleSave("AT_port")} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AT Port Custom Command Interface</CardTitle>
          <CardDescription>
            Change the custom command interface of the AT Port configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave("AT_port_custom");
            }}
          >
            {loading && <Skeleton className="h-8" />}
            {!loading && (
              <Input
                placeholder="Custom AT port interface"
                value={config.AT_port_custom}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    AT_port_custom: e.target.value,
                  }))
                }
              />
            )}
          </form>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button
            onClick={() => handleSave("AT_port_custom")}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Refresh Rate</CardTitle>
          <CardDescription>
            Change the frequency of data refresh rate. Slower refresh rate is
            recommended.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave("data_refresh_rate");
            }}
          >
            {loading && <Skeleton className="h-8" />}
            {!loading && (
              <Select
                value={refreshRateInSeconds.toString()}
                onValueChange={(value) =>
                  setConfig((prev) => ({
                    ...prev,
                    data_refresh_rate: (parseInt(value) * 1000).toString(),
                  }))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Refresh Rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="20">20 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                </SelectContent>
              </Select>
            )}
          </form>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button
            onClick={() => handleSave("data_refresh_rate")}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default GeneralSettingsPage;
