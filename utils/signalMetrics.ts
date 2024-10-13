// utils/signalMetrics.ts

interface SignalRanges {
    min: number;  // poorest value
    max: number;  // ideal value
  }
  
  const SIGNAL_RANGES: Record<string, SignalRanges> = {
    rsrp: { min: -140, max: -70 },  // -140 (poor) to -70 (ideal)
    rsrq: { min: -20, max: -10 },   // -20 (poor) to -10 (ideal)
    sinr: { min: 0, max: 20 }       // 0 (poor) to 20 (ideal)
  };
  
  export const calculateSignalPercentage = (
    type: 'rsrp' | 'rsrq' | 'sinr',
    value: number
  ): number => {
    const range = SIGNAL_RANGES[type];
    
    // Ensure value stays within bounds
    const clampedValue = Math.max(Math.min(value, range.max), range.min);
    
    // Calculate percentage
    const percentage = ((clampedValue - range.min) / (range.max - range.min)) * 100;
    
    // Round to 1 decimal place and ensure it's between 0 and 100
    return Math.min(Math.max(Math.round(percentage * 10) / 10, 0), 100);
  };