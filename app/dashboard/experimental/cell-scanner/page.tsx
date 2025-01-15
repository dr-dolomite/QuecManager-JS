"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ScanResponse {
  response: string;
}

type APIResponse = ScanResponse[] | ScanResponse;

const CellScannerPage = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [ATresponse, setATResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testCellScanner = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setATResponse(null);

      const response = await fetch("/cgi-bin/fetch_data.sh?set=8");

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const data: APIResponse = await response.json();
      setATResponse(Array.isArray(data) ? data[0]?.response : data.response);
    } catch (error: unknown) {
      console.error(error);
      setError("Failed to perform scan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 grid-cols-1 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Full Cell Scanner</CardTitle>
          <CardDescription>
            Scan for all nearby cells in the area including their signal strength
            and other details. Please wait for the scan to complete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p>Scanning cells... Please wait for the scan to complete.</p>
            </div>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <p className="whitespace-pre-wrap font-mono text-sm">{ATresponse}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button
            // disabled={loading}
            disabled
            onClick={testCellScanner}
            className="min-w-[100px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Under Development"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CellScannerPage;