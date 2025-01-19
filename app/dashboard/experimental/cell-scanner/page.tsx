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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CellScannerPage = () => {
  const [cellScanResult, setCellScanResult] = useState(null);
  const [cellScanLoading, setCellScanLoading] = useState(false);

  const startCellScan = async () => {
    setCellScanLoading(true);
    try {
      const response = await fetch("/api/cgi-bin/experimental/cell_scan.sh", {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to scan cells");
      }

      const result = await response.json();
      console.log(result);
      setCellScanResult(result);
    } catch (error) {
      console.error(error);
    } finally {
      setCellScanLoading(false);
    }
  };

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Full Network Cell Scan</CardTitle>
          <CardDescription>
            Scan all the of the available cells in the network including other
            network providers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Card className="p-4 grid gap-2">
              <div>
                <Badge>51506</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Network Type</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead>E/ARFCN</TableHead>
                    <TableHead>TAC</TableHead>
                    <TableHead className="text-right">Signal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>LTE</TableCell>
                    <TableCell>41</TableCell>
                    <TableCell>39965</TableCell>
                    <TableCell>12345</TableCell>
                    <TableCell className="text-right">-45 dBm</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CellScannerPage;
