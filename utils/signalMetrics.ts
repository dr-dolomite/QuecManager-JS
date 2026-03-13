// utils/signalMetrics.ts

interface SignalRanges {
    min: number;  // poorest value
    max: number;  // ideal value
  }

  const SIGNAL_RANGES: Record<string, SignalRanges> = {
    rsrp: { min: -140, max: -40 },  // -140 (poor) to -40 (ideal)
    rsrq: { min: -20, max: -3 },    // -20 (poor) to -3 (ideal)
    sinr_lte: { min: -20, max: 30 }, // -20 (poor) to 30 (ideal) for LTE
    sinr_5g: { min: -23, max: 40 }   // -23 (poor) to 40 (ideal) for 5G
  };

  export const calculateSignalPercentage = (
    type: 'rsrp' | 'rsrq' | 'sinr',
    value: number,
    bandType?: string
  ): number => {
    let range: SignalRanges;

    // Handle SINR with band type differentiation
    if (type === 'sinr') {
      const is5G = bandType?.includes('NR5G') || bandType?.includes('5G');
      range = is5G ? SIGNAL_RANGES['sinr_5g'] : SIGNAL_RANGES['sinr_lte'];
    } else {
      range = SIGNAL_RANGES[type];
    }

    // Ensure value stays within bounds
    const clampedValue = Math.max(Math.min(value, range.max), range.min);

    // Calculate percentage
    const percentage = ((clampedValue - range.min) / (range.max - range.min)) * 100;

    // Round to 1 decimal place and ensure it's between 0 and 100
    return Math.min(Math.max(Math.round(percentage * 10) / 10, 0), 100);
  };