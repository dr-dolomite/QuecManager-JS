"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Activity,
  Zap,
  Radio,
  Signal,
  AlertCircle,
  Clock,
  ArrowUpDown,
  ListFilter,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNetworkInterpretations } from "@/hooks/use-network-interpretations";
import { Skeleton } from "@/components/ui/skeleton";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const getInterpretationIcon = (interpretation: string) => {
  if (interpretation.toLowerCase().includes("band"))
    return <Radio className="h-4 w-4" />;
  if (
    interpretation.toLowerCase().includes("carrier aggregation") ||
    interpretation.toLowerCase().includes("carriers")
  )
    return <Zap className="h-4 w-4" />;
  if (interpretation.toLowerCase().includes("signal"))
    return <Signal className="h-4 w-4" />;
  if (interpretation.toLowerCase().includes("network mode"))
    return <Activity className="h-4 w-4" />;
  if (
    interpretation.toLowerCase().includes("pci") ||
    interpretation.toLowerCase().includes("earfcn")
  )
    return <Activity className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

const getInterpretationColor = (interpretation: string) => {
  const lowerInterp = interpretation.toLowerCase();

  // Signal events (highest priority - red/green)
  if (
    lowerInterp.includes("signal lost") ||
    lowerInterp.includes("no cellular")
  )
    return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
  if (
    lowerInterp.includes("signal restored") ||
    lowerInterp.includes("connected")
  )
    return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800";

  // CA events (yellow/blue)
  if (
    lowerInterp.includes("aggregation activated") ||
    lowerInterp.includes("carriers increased")
  )
    return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800";
  if (
    lowerInterp.includes("aggregation deactivated") ||
    lowerInterp.includes("single carrier")
  )
    return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800";

  // Network mode changes (purple)
  if (
    lowerInterp.includes("network mode changed") ||
    lowerInterp.includes("nsa") ||
    lowerInterp.includes("lte") ||
    lowerInterp.includes("5g sa")
  )
    return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800";

  // Band changes (teal)
  if (
    lowerInterp.includes("band") &&
    (lowerInterp.includes("added") ||
      lowerInterp.includes("removed") ||
      lowerInterp.includes("changed"))
  )
    return "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800";

  // Default
  return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800";
};

const NetworkInsights = () => {
  const { interpretations, loading, error, lastUpdate, refresh } =
    useNetworkInterpretations(30000);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "type">(
    "newest"
  );
  const [maxEvents, setMaxEvents] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("all");

  const formatDateTime = (datetime: string) => {
    try {
      const date = new Date(datetime);
      return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    } catch {
      return {
        date: datetime.split(" ")[0] || "",
        time: datetime.split(" ")[1] || "",
      };
    }
  };

  // Helper function to categorize event type
  const getEventCategory = (interpretation: string) => {
    const lower = interpretation.toLowerCase();
    if (lower.includes("band")) return "bandChanges";
    if (lower.includes("carrier aggregation") || lower.includes("carriers"))
      return "caEvents";
    if (lower.includes("signal") || lower.includes("network mode"))
      return "networkEvents";
    return "other";
  };

  // Apply max events limit and sorting
  const processedInterpretations = useMemo(() => {
    let result = [...interpretations];

    // Filter by active tab
    if (activeTab !== "all") {
      result = result.filter(
        (i) => getEventCategory(i.interpretation) === activeTab
      );
    }

    // Sort interpretations
    if (sortOrder === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
      );
    } else if (sortOrder === "oldest") {
      result.sort(
        (a, b) =>
          new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );
    } else if (sortOrder === "type") {
      // Sort by event type, then by date within each type
      result.sort((a, b) => {
        const typeCompare = a.interpretation.localeCompare(b.interpretation);
        if (typeCompare !== 0) return typeCompare;
        return new Date(b.datetime).getTime() - new Date(a.datetime).getTime();
      });
    }

    // Apply max events limit
    if (maxEvents !== "all") {
      const limit = parseInt(maxEvents);
      result = result.slice(0, limit);
    }

    return result;
  }, [interpretations, sortOrder, maxEvents, activeTab]);

  const groupedInterpretations = processedInterpretations.reduce(
    (groups, interpretation) => {
      const { date } = formatDateTime(interpretation.datetime);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(interpretation);
      return groups;
    },
    {} as Record<string, typeof interpretations>
  );

  // Sort dates in descending order (newest first)
  const sortedDates = Object.keys(groupedInterpretations).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
        <div className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="bandChanges">
                  {/* If screen size is md and up show this text, otherwise show icon */}
                  <span className="hidden md:inline">Band Changes</span>
                  <Radio className="md:hidden" />
                </TabsTrigger>
                <TabsTrigger value="caEvents">
                  <span className="hidden md:inline">CA Events</span>
                  <Zap className="md:hidden" />
                </TabsTrigger>
                <TabsTrigger value="networkEvents">
                  <span className="hidden md:inline">Network Events</span>
                  <Signal className="md:hidden" />
                </TabsTrigger>
              </TabsList>
              <div className="ml-auto flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1">
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Sort
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={sortOrder === "newest"}
                      onCheckedChange={() => setSortOrder("newest")}
                    >
                      Newest first
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={sortOrder === "oldest"}
                      onCheckedChange={() => setSortOrder("oldest")}
                    >
                      Oldest first
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={sortOrder === "type"}
                      onCheckedChange={() => setSortOrder("type")}
                    >
                      Event type
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1">
                      <ListFilter className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Limit
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Max Events</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={maxEvents === "all"}
                      onCheckedChange={() => setMaxEvents("all")}
                    >
                      All Events
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={maxEvents === "10"}
                      onCheckedChange={() => setMaxEvents("10")}
                    >
                      10 Events
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={maxEvents === "25"}
                      onCheckedChange={() => setMaxEvents("25")}
                    >
                      25 Events
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={maxEvents === "50"}
                      onCheckedChange={() => setMaxEvents("50")}
                    >
                      50 Events
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={maxEvents === "100"}
                      onCheckedChange={() => setMaxEvents("100")}
                    >
                      100 Events
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={maxEvents === "200"}
                      onCheckedChange={() => setMaxEvents("200")}
                    >
                      200 Events
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1"
                  onClick={refresh}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                  />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Refresh
                  </span>
                </Button>
              </div>
            </div>
            {error && (
              <Alert variant="destructive" className="my-4">
                <div className="flex items-center gap-x-2">
                  <AlertCircle className="size-5" />
                  <AlertTitle>
                    Failed to load network insights: {error}
                  </AlertTitle>
                </div>
              </Alert>
            )}

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>Network Insights</CardTitle>
                  <CardDescription>
                    Real-time insights into your cellular network changes,
                    including band switches, carrier aggregation events, and
                    signal quality changes. The monitoring service runs
                    automatically as part of QuecManager services.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden md:table-cell">
                          Event Type
                        </TableHead>
                        <TableHead>Interpretation</TableHead>
                        <TableHead>Date & Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && interpretations.length === 0 ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell className="hidden md:table-cell">
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-32" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : processedInterpretations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <Activity className="h-8 w-8 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                No network events found
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        processedInterpretations.map(
                          (interpretation, index) => {
                            const { date, time } = formatDateTime(
                              interpretation.datetime
                            );
                            return (
                              <TableRow key={index}>
                                <TableCell className="font-medium hidden md:table-cell ">
                                  <Badge
                                    variant="outline"
                                    className={getInterpretationColor(
                                      interpretation.interpretation
                                    )}
                                  >
                                    {getInterpretationIcon(
                                      interpretation.interpretation
                                    )}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-md">
                                  {interpretation.interpretation}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="text-sm">{date}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {time}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }
                        )
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    Showing <strong>{processedInterpretations.length}</strong>{" "}
                    of <strong>{interpretations.length}</strong> event
                    {interpretations.length !== 1 ? "s" : ""}
                  </div>
                  {lastUpdate && (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      Last updated: {lastUpdate.toLocaleTimeString()}
                    </div>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
            <TabsContent value="bandChanges">
              <Card>
                <CardHeader>
                  <CardTitle>Band Changes</CardTitle>
                  <CardDescription>
                    Events related to cellular band changes and frequency
                    shifts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden md:table-cell">
                          Event Type
                        </TableHead>
                        <TableHead>Interpretation</TableHead>
                        <TableHead>Date & Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && interpretations.length === 0 ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell className="hidden md:table-cell">
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-32" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : processedInterpretations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <Radio className="h-8 w-8 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                No band change events found
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        processedInterpretations.map(
                          (interpretation, index) => {
                            const { date, time } = formatDateTime(
                              interpretation.datetime
                            );

                            return (
                              <TableRow key={index}>
                                <TableCell className="font-medium hidden md:table-cell">
                                  <Badge
                                    variant="outline"
                                    className={getInterpretationColor(
                                      interpretation.interpretation
                                    )}
                                  >
                                    <Radio className="h-4 w-4" />
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-md">
                                  {interpretation.interpretation}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="text-sm">{date}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {time}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }
                        )
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    Showing <strong>{processedInterpretations.length}</strong>{" "}
                    of{" "}
                    <strong>
                      {
                        interpretations.filter(
                          (i) =>
                            getEventCategory(i.interpretation) === "bandChanges"
                        ).length
                      }
                    </strong>{" "}
                    event
                    {interpretations.filter(
                      (i) =>
                        getEventCategory(i.interpretation) === "bandChanges"
                    ).length !== 1
                      ? "s"
                      : ""}
                  </div>
                  {lastUpdate && (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      Last updated: {lastUpdate.toLocaleTimeString()}
                    </div>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
            <TabsContent value="caEvents">
              <Card>
                <CardHeader>
                  <CardTitle>Carrier Aggregation Events</CardTitle>
                  <CardDescription>
                    Events related to carrier aggregation changes and
                    multi-carrier operations.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden md:table-cell">
                          Event Type
                        </TableHead>
                        <TableHead>Interpretation</TableHead>
                        <TableHead>Date & Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && interpretations.length === 0 ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell className="hidden md:table-cell">
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-32" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : processedInterpretations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <Zap className="h-8 w-8 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                No CA events found
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        processedInterpretations.map(
                          (interpretation, index) => {
                            const { date, time } = formatDateTime(
                              interpretation.datetime
                            );

                            return (
                              <TableRow key={index}>
                                <TableCell className="font-medium hidden md:table-cell">
                                  <Badge
                                    variant="outline"
                                    className={getInterpretationColor(
                                      interpretation.interpretation
                                    )}
                                  >
                                    <Zap className="h-4 w-4" />
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-md">
                                  {interpretation.interpretation}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="text-sm">{date}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {time}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }
                        )
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    Showing <strong>{processedInterpretations.length}</strong>{" "}
                    of{" "}
                    <strong>
                      {
                        interpretations.filter(
                          (i) =>
                            getEventCategory(i.interpretation) === "caEvents"
                        ).length
                      }
                    </strong>{" "}
                    event
                    {interpretations.filter(
                      (i) => getEventCategory(i.interpretation) === "caEvents"
                    ).length !== 1
                      ? "s"
                      : ""}
                  </div>
                  {lastUpdate && (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      Last updated: {lastUpdate.toLocaleTimeString()}
                    </div>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
            <TabsContent value="networkEvents">
              <Card>
                <CardHeader>
                  <CardTitle>Network Events</CardTitle>
                  <CardDescription>
                    Signal quality changes and network mode transitions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden md:table-cell">
                          Event Type
                        </TableHead>
                        <TableHead>Interpretation</TableHead>
                        <TableHead>Date & Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && interpretations.length === 0 ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell className="hidden md:table-cell">
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-32" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : processedInterpretations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <Signal className="h-8 w-8 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                No network events found
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        processedInterpretations.map(
                          (interpretation, index) => {
                            const { date, time } = formatDateTime(
                              interpretation.datetime
                            );

                            return (
                              <TableRow key={index}>
                                <TableCell className="font-medium hidden md:table-cell">
                                  <Badge
                                    variant="outline"
                                    className={getInterpretationColor(
                                      interpretation.interpretation
                                    )}
                                  >
                                    <Signal className="h-4 w-4" />
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-md">
                                  {interpretation.interpretation}
                                </TableCell>
                                <TableCell className=" whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="text-sm">{date}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {time}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }
                        )
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    Showing <strong>{processedInterpretations.length}</strong>{" "}
                    of{" "}
                    <strong>
                      {
                        interpretations.filter(
                          (i) =>
                            getEventCategory(i.interpretation) ===
                            "networkEvents"
                        ).length
                      }
                    </strong>{" "}
                    event
                    {interpretations.filter(
                      (i) =>
                        getEventCategory(i.interpretation) === "networkEvents"
                    ).length !== 1
                      ? "s"
                      : ""}
                  </div>
                  {lastUpdate && (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      Last updated: {lastUpdate.toLocaleTimeString()}
                    </div>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default NetworkInsights;
