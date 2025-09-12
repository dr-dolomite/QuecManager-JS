/**
 * Data Usage Warning Dialog Component
 *
 * Displays a warning dialog when the user reaches their configured data usage threshold.
 * Integrates with the data usage tracking system to provide actionable warnings.
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, WifiOff, Settings, Zap } from "lucide-react";

interface DataUsageWarningDialogProps {
  open: boolean;
  onClose: () => void;
  onDismiss: () => void;
  usagePercentage: number;
  currentUsage: string;
  monthlyLimit: string;
  remaining: string;
  onOpenSettings?: () => void;
}

const DataUsageWarningDialog: React.FC<DataUsageWarningDialogProps> = ({
  open,
  onClose,
  onDismiss,
  usagePercentage,
  currentUsage,
  monthlyLimit,
  remaining,
  onOpenSettings,
}) => {
  const isOverLimit = usagePercentage >= 100;
  const isNearLimit = usagePercentage >= 95;

  const getWarningLevel = () => {
    if (isOverLimit) return "critical";
    if (isNearLimit) return "severe";
    return "moderate";
  };

  const getWarningTitle = () => {
    if (isOverLimit) return "Data Limit Exceeded";
    if (isNearLimit) return "Approaching Data Limit";
    return "Data Usage Warning";
  };

  const getWarningMessage = () => {
    if (isOverLimit) {
      return "You have exceeded your monthly data limit. Your connection may be throttled or additional charges may apply.";
    }
    if (isNearLimit) {
      return "You're very close to reaching your monthly data limit. Consider monitoring your usage closely.";
    }
    return "You're approaching your monthly data usage limit. You may want to monitor your usage more carefully.";
  };

  const getWarningColor = () => {
    if (isOverLimit) return "bg-red-500";
    if (isNearLimit) return "bg-orange-500";
    return "bg-yellow-500";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getWarningTitle()}
          </DialogTitle>
          <DialogDescription>{getWarningMessage()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Usage Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Current Usage</span>
              <span className="font-medium">{currentUsage}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${getWarningColor()}`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>0 GB</span>
              <span>{monthlyLimit}</span>
            </div>
          </div>

          {/* Warning Alert */}
          <Alert variant={isOverLimit ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-bold">
              {isOverLimit
                ? "Limit Exceeded"
                : isNearLimit
                ? "Approaching Limit"
                : "Usage Warning"}
            </AlertTitle>
            <AlertDescription>
              {isOverLimit ? (
                <>
                  You've used all of your monthly data allowance. Consider
                  upgrading your plan or enabling data-saving features.
                </>
              ) : isNearLimit ? (
                <>
                  You have very little data remaining. Monitor your usage
                  carefully to avoid overages.
                </>
              ) : (
                <>
                  You're approaching your monthly limit. Consider adjusting your
                  usage patterns or increasing your limit.
                </>
              )}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            onClick={onDismiss}
            variant={isOverLimit ? "destructive" : "default"}
          >
            Don't Show Again This Month
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DataUsageWarningDialog;
