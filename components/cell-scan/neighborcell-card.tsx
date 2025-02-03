import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BiSignal1,
  BiSignal2,
  BiSignal3,
  BiSignal4,
  BiSignal5,
} from "react-icons/bi";

// Types for neighbor cell data
type CellType = 'LTE' | 'NR5G-NSA' | 'NR5G-SA';

interface BaseNeighborCell {
  type: CellType;
  frequency: number;
  pci: number;
  rsrp: number;
  rsrq: number;
}

interface LTENeighborCell extends BaseNeighborCell {
  type: 'LTE';
}

interface NR5GNeighborCell extends BaseNeighborCell {
  type: 'NR5G-NSA' | 'NR5G-SA';
}

type NeighborCell = LTENeighborCell | NR5GNeighborCell;

interface NeighborCellsData {
  neighborCells?: string;
  meas?: string;
}

interface NeighborCellsResponse {
  status: 'success' | 'error' | 'running' | 'idle';
  timestamp: string;
  data: NeighborCellsData;
}

interface NeighborCellsProps {
  neighborCells: NeighborCellsResponse | null;
}

const NeighborCellsDisplay: React.FC<NeighborCellsProps> = ({ neighborCells }) => {
  // Parse LTE neighbor cells
  const parseLTENeighborCells = (data: NeighborCellsData): LTENeighborCell[] => {
    if (!data?.neighborCells) return [];
    
    const matches = data.neighborCells.matchAll(/\+QENG: "neighbourcell (?:intra|inter)","LTE",(\d+),(\d+),(-?\d+),(-?\d+)/g);
    return Array.from(matches).map(match => ({
      type: 'LTE',
      frequency: parseInt(match[1]),
      pci: parseInt(match[2]),
      rsrq: parseInt(match[3]),
      rsrp: parseInt(match[4])
    }));
  };

  // Parse 5G neighbor cells
  const parse5GNeighborCells = (data: NeighborCellsData): NR5GNeighborCell[] => {
    if (!data?.meas) return [];
    
    const matches = data.meas.matchAll(/\+QNWCFG: "nr5g_meas_info",(\d+),(\d+),(\d+),(-?\d+),(-?\d+)/g);
    return Array.from(matches).map(match => ({
      type: match[1] === '1' ? 'NR5G-NSA' : 'NR5G-SA',
      frequency: parseInt(match[2]),
      pci: parseInt(match[3]),
      rsrp: parseInt(match[4]),
      rsrq: parseInt(match[5])
    }));
  };

  // Get signal icon based on RSRP
  const getSignalIcon = (rsrp: number): React.ReactElement => {
    if (rsrp >= -65) return <BiSignal5 className="text-xl" />;
    if (rsrp >= -75) return <BiSignal4 className="text-xl" />;
    if (rsrp >= -85) return <BiSignal3 className="text-xl" />;
    if (rsrp >= -95) return <BiSignal2 className="text-xl" />;
    return <BiSignal1 className="text-xl" />;
  };

  // Combine and sort all cells
  const allCells: NeighborCell[] = neighborCells?.data ? [
    ...parseLTENeighborCells(neighborCells.data),
    ...parse5GNeighborCells(neighborCells.data)
  ].sort((a, b) => {
    // First sort by type (5G before LTE)
    if (a.type.startsWith('NR5G') && !b.type.startsWith('NR5G')) return -1;
    if (!a.type.startsWith('NR5G') && b.type.startsWith('NR5G')) return 1;
    
    // Then sort by signal strength
    return b.rsrp - a.rsrp;
  }) : [];

  if (!neighborCells || allCells.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No neighbor cells data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>PCI</TableHead>
            <TableHead>Signal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allCells.map((cell, index) => (
            <TableRow key={`${cell.type}-${cell.frequency}-${index}`}>
              <TableCell className="font-medium">{cell.type}</TableCell>
              <TableCell>{cell.frequency}</TableCell>
              <TableCell>{cell.pci}</TableCell>
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      {getSignalIcon(cell.rsrp)}
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="grid gap-1">
                        <div className="grid grid-cols-2 gap-1">
                          RSRP <span className="font-medium">{cell.rsrp} dBm</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          RSRQ <span className="font-medium">{cell.rsrq} dB</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default NeighborCellsDisplay;