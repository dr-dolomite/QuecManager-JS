"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, Zap, Radio, Signal, AlertCircle, Clock, WorkflowIcon, CloudCog } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNetworkInterpretations } from "@/hooks/use-network-interpretations";

const getInterpretationIcon = (interpretation: string) => {
  if (interpretation.includes("band")) return <Radio className="h-4 w-4" />;
  if (interpretation.includes("carrier aggregation")) return <Zap className="h-4 w-4" />;
  if (interpretation.includes("signal")) return <Signal className="h-4 w-4" />;
  if (interpretation.includes("PCI") || interpretation.includes("EARFCN")) return <Activity className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

const getInterpretationColor = (interpretation: string) => {
  if (interpretation.includes("activated")) return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800";
  if (interpretation.includes("deactivated")) return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
  if (interpretation.includes("improved")) return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800";
  if (interpretation.includes("degraded")) return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800";
  if (interpretation.includes("changed")) return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800";
  return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800";
};

export default function NetworkInsights() {
  const { interpretations, loading, error, lastUpdate, refresh } = useNetworkInterpretations(30000);

  const formatDateTime = (datetime: string) => {
    try {
      const date = new Date(datetime);
      return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    } catch {
      return { date: datetime.split(' ')[0] || '', time: datetime.split(' ')[1] || '' };
    }
  };

  const groupedInterpretations = interpretations.reduce((groups, interpretation) => {
    const { date } = formatDateTime(interpretation.datetime);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(interpretation);
    return groups;
  }, {} as Record<string, typeof interpretations>);

  // Sort dates in descending order (newest first)
  const sortedDates = Object.keys(groupedInterpretations).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (loading && interpretations.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">Loading Network Insights</p>
            <p className="text-sm text-muted-foreground">Fetching cellular network interpretations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Network Insights</h1>
          <p className="text-muted-foreground mt-1">
            Real-time cellular network changes and interpretations
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {lastUpdate && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              {lastUpdate.toLocaleTimeString()}
            </div>
          )}
          <Button 
            onClick={refresh} 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Activity className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Total Events</p>
                  <p className="text-2xl font-bold">{interpretations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <CloudCog className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Band Changes</p>
                  <p className="text-2xl font-bold">
                    {interpretations.filter(i => i.interpretation.includes("band")).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <WorkflowIcon className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">CA Events</p>
                  <p className="text-2xl font-bold">
                    {interpretations.filter(i => i.interpretation.includes("carrier aggregation")).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Interpretations */}
        {sortedDates.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <div className="text-center">
                <Activity className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Network Changes Detected</h3>
                <p className="text-muted-foreground max-w-md">
                  The system is actively monitoring your cellular network for changes. 
                  When your modem switches bands, activates carrier aggregation, or changes cells, 
                  those events will appear here.
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
                    {groupedInterpretations[date].length} event{groupedInterpretations[date].length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {groupedInterpretations[date]
                    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
                    .map((interpretation, index) => {
                    const { time } = formatDateTime(interpretation.datetime);
                    return (
                      <div key={index}>
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-full border ${getInterpretationColor(interpretation.interpretation)}`}>
                            {getInterpretationIcon(interpretation.interpretation)}
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
                        {index < groupedInterpretations[date].length - 1 && (
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
      </div>
    </div>
  );
}
