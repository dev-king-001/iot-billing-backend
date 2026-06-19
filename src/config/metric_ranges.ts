export const MetricRangeMap: Record<string, { lowerBound: bigint; upperBound: bigint }> = {
  temperature: { lowerBound: -50n, upperBound: 150n },
  humidity: { lowerBound: 0n, upperBound: 100n },
  voltage: { lowerBound: 0n, upperBound: 500n },
  energy_kwh: { lowerBound: 0n, upperBound: 1000000n },
};
