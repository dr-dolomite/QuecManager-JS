import React, { useEffect } from 'react';
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
  cellType: string; // intra or inter
  frequency: number;
  pci: number;
  rsrq: number;
  rsrp: number;
}

interface LTENeighborCell extends BaseNeighborCell {
  type: 'LTE';
}

interface NR5GNeighborCell extends BaseNeighborCell {
  type: 'NR5G-NSA' | 'NR5G-SA';
}

type NeighborCell = LTENeighborCell | NR5GNeighborCell;

interface NeighborCellsProps {
  neighborCells: any | null;
}

const NeighborCellsDisplay: React.FC<NeighborCellsProps> = ({ neighborCells }) => {
  useEffect(() => {
    if (neighborCells) {
      console.log("Neighbor cells data:", neighborCells);
    }
  }, [neighborCells]);

  // Parse LTE neighbor cells
  const parseLTENeighborCells = (data: string): LTENeighborCell[] => {
    if (!data) return [];
    
    const matches = data.matchAll(/\+QENG: "neighbourcell (intra|inter)","LTE",(\d+),(\d+),(-?\d+),(-?\d+)/g);
    return Array.from(matches).map(match => ({
      type: 'LTE' as const,
      cellType: match[1],
      frequency: parseInt(match[2]),
      pci: parseInt(match[3]),
      rsrq: parseInt(match[4]),
      rsrp: parseInt(match[5])
    }));
  };

  // Parse 5G neighbor cells
  const parse5GNeighborCells = (data: string): NR5GNeighborCell[] => {
    if (!data) return [];
    
    const matches = data.matchAll(/\+QNWCFG: "nr5g_meas_info",(\d+),(\d+),(\d+),(-?\d+),(-?\d+)/g);
    return Array.from(matches).map(match => ({
      type: 'NR5G-NSA' as const,
      cellType: 'nr5g',
      frequency: parseInt(match[2]),
      pci: parseInt(match[3]),
      rsrp: parseInt(match[4]),
      rsrq: parseInt(match[5])
    }));
  };

  // Get signal icon based on RSRP
  const getSignalIcon = (rsrp: number): React.ReactElement => {
    if (rsrp >= -65) return <BiSignal5 className="text-xl text-green-500" />;
    if (rsrp >= -75) return <BiSignal4 className="text-xl text-green-400" />;
    if (rsrp >= -85) return <BiSignal3 className="text-xl text-yellow-500" />;
    if (rsrp >= -95) return <BiSignal2 className="text-xl text-yellow-600" />;
    return <BiSignal1 className="text-xl text-red-500" />;
  };

  // Process the data
  let allCells: NeighborCell[] = [];
  
  if (neighborCells?.status === "success") {
    // Check the data structure and extract cells accordingly
    if (neighborCells.data?.neighborCells) {
      allCells = [...allCells, ...parseLTENeighborCells(neighborCells.data.neighborCells)];
    } else if (neighborCells.raw_data?.neighborCells) {
      // Alternative data structure
      allCells = [...allCells, ...parseLTENeighborCells(neighborCells.raw_data.neighborCells)];
    }
    
    if (neighborCells.data?.meas) {
      allCells = [...allCells, ...parse5GNeighborCells(neighborCells.data.meas)];
    } else if (neighborCells.raw_data?.meas) {
      // Alternative data structure
      allCells = [...allCells, ...parse5GNeighborCells(neighborCells.raw_data.meas)];
    }
  }
  
  // Sort cells
  allCells.sort((a, b) => {
    // First sort by type (5G before LTE)
    if (a.type.startsWith('NR5G') && !b.type.startsWith('NR5G')) return -1;
    if (!a.type.startsWith('NR5G') && b.type.startsWith('NR5G')) return 1;
    
    // Then sort by signal strength
    return b.rsrp - a.rsrp;
  });

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
            <TableHead>Cell Type</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>PCI</TableHead>
            <TableHead>Signal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allCells.map((cell, index) => (
            <TableRow key={`${cell.type}-${cell.frequency}-${cell.pci}-${index}`}>
              <TableCell className="font-medium">{cell.type}</TableCell>
              <TableCell>{cell.cellType}</TableCell>
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