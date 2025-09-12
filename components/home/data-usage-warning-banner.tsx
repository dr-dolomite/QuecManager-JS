/**
 * Home Data Usage Warning Banner
 * 
 * A compact, non-intrusive warning banner that appears on the home page
 * when users approach or exceed their data usage limits.
 */

import React from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, WifiOff, X, Settings } from "lucide-react";
import useHomeDataUsageWarning from "@/hooks/home-data-usage-warning";

const HomeDataUsageWarningBanner: React.FC = () => {
  const { warning, dismissWarning } = useHomeDataUsageWarning();

  if (!warning.show) {
    return null;
  }

  const getWarningIcon = () => {
    if (warning.isOverLimit) {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
    return <AlertTriangle className="h-4 w-4 text-orange-500" />;
  };

  const getWarningTitle = () => {
    if (warning.isOverLimit) {
      return "Data Limit Exceeded";
    }
    if (warning.percentage >= 95) {
      return "Approaching Data Limit";
    }
    return "Data Usage Warning";
  };

  const getWarningMessage = () => {
    if (warning.isOverLimit) {
      return `You've exceeded your monthly data limit of ${warning.monthlyLimit}. Your connection may be throttled.`;
    }
    return `You've used ${warning.percentage.toFixed(1)}% of your ${warning.monthlyLimit} monthly data limit.`;
  };

  return (
    <Alert 
      variant={warning.isOverLimit ? "destructive" : "default"}
      className="mb-6 border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-900/20"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {getWarningIcon()}
          <div className="flex-1 space-y-1">
            <div className="flex items-center space-x-2">
              <h4 className="font-semibold text-sm">{getWarningTitle()}</h4>
              <Badge 
                variant={warning.isOverLimit ? "destructive" : "secondary"}
                className="text-xs"
              >
                {warning.percentage.toFixed(1)}%
              </Badge>
            </div>
            <AlertDescription className="text-sm">
              {getWarningMessage()}
              {!warning.isOverLimit && (
                <span className="block mt-1 text-xs text-muted-foreground">
                  Remaining: {warning.remaining}
                </span>
              )}
            </AlertDescription>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <Link href="/dashboard/experimental/data-usage-tracking">
            <Button variant="outline" size="sm" className="text-xs">
              <Settings className="h-3 w-3 mr-1" />
              Manage
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={dismissWarning}
            className="h-8 w-8 p-0"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </div>
    </Alert>
  );
};

export default HomeDataUsageWarningBanner;
