"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw,
  Download,
  Filter,
  Search,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Types
interface LogEntry {
  timestamp: string;
  level: string;
  script: string;
  pid: string;
  message: string;
}

interface LogResponse {
  entries?: LogEntry[];
  total?: number;
  showing?: number;
  error?: string;
}

interface Category {
  name: string;
  scripts: string[];
}

const LogsPage = () => {
  // State management
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [scripts, setScripts] = useState<string[]>([]);
  const [selectedScript, setSelectedScript] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [maxLines, setMaxLines] = useState<string>("100");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch available categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(
        "/cgi-bin/quecmanager/experimental/logs/fetch_logs.sh"
      );
      const data = await response.json();

      if (data.categories) {
        setCategories(data.categories);
        if (data.categories.length > 0 && !selectedCategory) {
          setSelectedCategory(data.categories[0]);
        }
      }
    } catch (err) {
      setError("Failed to fetch log categories");
      console.error("Error fetching categories:", err);
    }
  }, [selectedCategory]);

  // Fetch scripts for selected category
  const fetchScripts = useCallback(async (category: string) => {
    if (!category) return;

    try {
      const response = await fetch(
        `/cgi-bin/quecmanager/experimental/logs/fetch_logs.sh?category=${encodeURIComponent(
          category
        )}`
      );
      const data = await response.json();

      if (data.scripts) {
        setScripts(data.scripts);
        setSelectedScript(""); // Reset script selection
      }
    } catch (err) {
      setError("Failed to fetch scripts for category");
      console.error("Error fetching scripts:", err);
    }
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!selectedCategory || !selectedScript) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        category: selectedCategory,
        script: selectedScript,
        lines: maxLines,
      });

      if (selectedLevel && selectedLevel !== "all") {
        params.append("level", selectedLevel);
      }

      const response = await fetch(
        `/cgi-bin/quecmanager/experimental/logs/fetch_logs.sh?${params}`
      );
      const data: LogResponse = await response.json();

      if (data.entries) {
        let filteredLogs = data.entries;

        // Apply search filter
        if (searchTerm) {
          filteredLogs = filteredLogs.filter(
            (log) =>
              log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
              log.script.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        setLogs(filteredLogs);
        setTotalLogs(data.total || 0);
        setLastRefresh(new Date());
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to fetch logs");
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedScript, selectedLevel, searchTerm, maxLines]);

  // Auto-refresh functionality
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && selectedCategory && selectedScript) {
      interval = setInterval(fetchLogs, refreshInterval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    autoRefresh,
    refreshInterval,
    fetchLogs,
    selectedCategory,
    selectedScript,
  ]);

  // Initial data loading
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (selectedCategory) {
      fetchScripts(selectedCategory);
    }
  }, [selectedCategory, fetchScripts]);

  useEffect(() => {
    if (selectedCategory && selectedScript) {
      fetchLogs();
    }
  }, [selectedCategory, selectedScript, fetchLogs]);

  // Get log level badge variant and custom colors
  const getLevelBadgeProps = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR":
        return { 
          variant: "destructive" as const,
          className: "bg-red-500 hover:bg-red-600 text-white border-red-500"
        };
      case "WARN":
        return { 
          variant: "secondary" as const,
          className: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
        };
      case "INFO":
        return { 
          variant: "default" as const,
          className: "bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
        };
      case "DEBUG":
        return { 
          variant: "outline" as const,
          className: "bg-green-500 hover:bg-green-600 text-white border-green-500"
        };
      default:
        return { 
          variant: "default" as const,
          className: "bg-gray-500 hover:bg-gray-600 text-white border-gray-500"
        };
    }
  };

  // Get log level icon
  const getLevelIcon = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR":
        return <XCircle className="h-4 w-4" />;
      case "WARN":
        return <AlertCircle className="h-4 w-4" />;
      case "INFO":
        return <Info className="h-4 w-4" />;
      case "DEBUG":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  // Export logs functionality
  const exportLogs = () => {
    const logText = logs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level}] [${log.script}] [PID:${log.pid}] ${log.message}`
      )
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedScript}_${selectedCategory}_logs_${
      new Date().toISOString().split("T")[0]
    }.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>System Logs</CardTitle>
          <CardDescription>
            View and analyze centralized logs from QuecManager services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* First row - Category and Script selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="script">Script</Label>
              <Select
                value={selectedScript}
                onValueChange={setSelectedScript}
                disabled={!selectedCategory}
              >
                <SelectTrigger id="script">
                  <SelectValue placeholder="Select script..." />
                </SelectTrigger>
                <SelectContent>
                  {scripts.map((script) => (
                    <SelectItem key={script} value={script}>
                      {script}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Second row - Level and Lines */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Log Level</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger id="level">
                  <SelectValue placeholder="All levels..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                  <SelectItem value="WARN">Warning</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="DEBUG">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lines">Max Lines</Label>
              <Select value={maxLines} onValueChange={setMaxLines}>
                <SelectTrigger id="lines">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 lines</SelectItem>
                  <SelectItem value="100">100 lines</SelectItem>
                  <SelectItem value="200">200 lines</SelectItem>
                  <SelectItem value="500">500 lines</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Third row - Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button onClick={fetchLogs} disabled={loading || !selectedScript}>
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                onClick={exportLogs}
                variant="outline"
                disabled={logs.length === 0}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Auto-refresh:</span>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? "On" : "Off"}
              </Button>
              {autoRefresh && (
                <Select
                  value={refreshInterval.toString()}
                  onValueChange={(value) => setRefreshInterval(parseInt(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5000">5s</SelectItem>
                    <SelectItem value="10000">10s</SelectItem>
                    <SelectItem value="30000">30s</SelectItem>
                    <SelectItem value="60000">1m</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Log Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Log Entries</CardTitle>
              <CardDescription>
                {selectedScript ? (
                  <>
                    Showing {logs.length} of {totalLogs} entries from{" "}
                    {selectedScript}
                    {searchTerm && ` (filtered by "${searchTerm}")`}
                  </>
                ) : (
                  "Select a category and script to view logs"
                )}
              </CardDescription>
            </div>
            {lastRefresh && (
              <div className="text-sm text-muted-foreground">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {selectedScript ? (
            <ScrollArea className="h-[600px] w-full rounded-md border p-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading logs...
                </div>
              ) : logs.length > 0 ? (
                <div className="space-y-2">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors font-mono text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
                        {getLevelIcon(log.level)}
                        <Badge
                          {...getLevelBadgeProps(log.level)}
                          className={`text-xs ${getLevelBadgeProps(log.level).className}`}
                        >
                          {log.level}
                        </Badge>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <span>{log.timestamp}</span>
                          <span>•</span>
                          <span>{log.script}</span>
                          <span>•</span>
                          <span>PID:{log.pid}</span>
                        </div>
                        <div className="break-words">{log.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  No log entries found
                </div>
              )}
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Select a category and script to view logs
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LogsPage;
