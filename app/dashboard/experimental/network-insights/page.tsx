"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Activity,
  Zap,
  Radio,
  Signal,
  AlertCircle,
  Clock,
  WorkflowIcon,
  CloudCog,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNetworkInterpretations } from "@/hooks/use-network-interpretations";
import { Skeleton } from "@/components/ui/skeleton";

const getInterpretationIcon = (interpretation: string) => {
  if (interpretation.toLowerCase().includes("band")) return <Radio className="h-4 w-4" />;
  if (interpretation.toLowerCase().includes("carrier aggregation") || interpretation.toLowerCase().includes("carriers"))
    return <Zap className="h-4 w-4" />;
  if (interpretation.toLowerCase().includes("signal")) return <Signal className="h-4 w-4" />;
  if (interpretation.toLowerCase().includes("network mode")) return <Activity className="h-4 w-4" />;
  if (interpretation.toLowerCase().includes("pci") || interpretation.toLowerCase().includes("earfcn"))
    return <Activity className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

const getInterpretationColor = (interpretation: string) => {
  const lowerInterp = interpretation.toLowerCase();
  
  // Signal events (highest priority - red/green)
  if (lowerInterp.includes("signal lost") || lowerInterp.includes("no cellular"))
    return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
  if (lowerInterp.includes("signal restored") || lowerInterp.includes("connected"))
    return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800";
  
  // CA events (yellow/blue)
  if (lowerInterp.includes("aggregation activated") || lowerInterp.includes("carriers increased"))
    return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800";
  if (lowerInterp.includes("aggregation deactivated") || lowerInterp.includes("single carrier"))
    return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800";
  
  // Network mode changes (purple)
  if (lowerInterp.includes("network mode changed") || lowerInterp.includes("nsa") || lowerInterp.includes("lte") || lowerInterp.includes("5g sa"))
    return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800";
  
  // Band changes (teal)
  if (lowerInterp.includes("band") && (lowerInterp.includes("added") || lowerInterp.includes("removed") || lowerInterp.includes("changed")))
    return "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800";
  
  // Default
  return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800";
};

export default function NetworkInsights() {
  const { interpretations, loading, error, lastUpdate, refresh } =
    useNetworkInterpretations(30000);

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

  const groupedInterpretations = interpretations.reduce(
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
    <Card>
      <CardHeader>
        <CardTitle>Network Insights</CardTitle>
        <CardDescription>
          Real-time insights into your cellular network changes, including band
          switches, carrier aggregation events, and signal quality changes. The
          monitoring service runs automatically as part of QuecManager services.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load network insights: {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6">
            {/* Stats Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Activity className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Total Events</p>
                      {loading && interpretations.length === 0 ? (
                        <Skeleton className="h-8 w-6 mt-1" />
                      ) : (
                        <p className="text-2xl font-bold">
                          {interpretations.length}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Radio className="h-8 w-8 text-teal-500" />
                    <div>
                      <p className="text-sm font-medium">Band Changes</p>
                      {loading && interpretations.length === 0 ? (
                        <Skeleton className="h-8 w-6 mt-1" />
                      ) : (
                        <p className="text-2xl font-bold">
                          {
                            interpretations.filter((i) =>
                              i.interpretation.toLowerCase().includes("band")
                            ).length
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Zap className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">CA Events</p>
                      {loading && interpretations.length === 0 ? (
                        <Skeleton className="h-8 w-6 mt-1" />
                      ) : (
                        <p className="text-2xl font-bold">
                          {
                            interpretations.filter((i) =>
                              i.interpretation.toLowerCase().includes("carrier aggregation") ||
                              i.interpretation.toLowerCase().includes("carriers")
                            ).length
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Signal className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Network Events</p>
                      {loading && interpretations.length === 0 ? (
                        <Skeleton className="h-8 w-6 mt-1" />
                      ) : (
                        <p className="text-2xl font-bold">
                          {
                            interpretations.filter((i) =>
                              i.interpretation.toLowerCase().includes("signal") ||
                              i.interpretation.toLowerCase().includes("network mode")
                            ).length
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {loading && interpretations.length === 0 ? (
              <Card className="pt-6">
                <CardContent className="flex flex-col gap-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Interpretations */}
                {!loading && sortedDates.length === 0 ? (
                  <Card>
                    <CardContent className="flex items-center justify-center p-8">
                      <div className="text-center">
                        <Activity className="h-12 w-12 text-primary mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">
                          No Network Changes Detected
                        </h3>
                        <p className="text-muted-foreground max-w-md">
                          The system is actively monitoring your cellular
                          network for changes. When your modem switches bands,
                          activates carrier aggregation, or changes cells, those
                          events will appear here.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  sortedDates.map((date) => (
                    <Card key={date}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>{date}</CardTitle>
                          <Badge variant="secondary">
                            {groupedInterpretations[date].length} event
                            {groupedInterpretations[date].length !== 1
                              ? "s"
                              : ""}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {groupedInterpretations[date]
                            .sort(
                              (a, b) =>
                                new Date(b.datetime).getTime() -
                                new Date(a.datetime).getTime()
                            )
                            .map((interpretation, index) => {
                              const { time } = formatDateTime(
                                interpretation.datetime
                              );
                              return (
                                <div key={index}>
                                  <div className="flex items-start space-x-3">
                                    <div
                                      className={`p-2 rounded-full border ${getInterpretationColor(
                                        interpretation.interpretation
                                      )}`}
                                    >
                                      {getInterpretationIcon(
                                        interpretation.interpretation
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm font-medium text-muted-foreground">
                                          {time}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-sm leading-relaxed">
                                        {interpretation.interpretation}
                                      </p>
                                    </div>
                                  </div>
                                  {index <
                                    groupedInterpretations[date].length - 1 && (
                                    <Separator className="mt-4" />
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        {/* Last Update and Refresh Button */}
        <div>
          <Button onClick={refresh} size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Insights
          </Button>
        </div>

        {lastUpdate && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4 mr-1" />
            {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
