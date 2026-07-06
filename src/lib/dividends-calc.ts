import type { Period } from "./types";
import { PERIODS } from "./types";

export interface DividendEvent {
  date: Date;
  amount: number;
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

export function computeDividendsForPeriod(
  dividends: DividendEvent[],
  shares: number,
  period: Period
): number {
  const periodConfig = PERIODS.find((p) => p.key === period);
  if (!periodConfig) return 0;

  const cutoff = subtractDays(new Date(), periodConfig.days);

  return dividends
    .filter((d) => d.date >= cutoff)
    .reduce((sum, d) => sum + d.amount * shares, 0);
}

export function enrichWithDividends(
  pricePerf: {
    referencePrice: number;
    changePercent: number;
    changeValue: number;
  },
  dividendValue: number,
  shares: number
): {
  referencePrice: number;
  changePercent: number;
  changeValue: number;
  dividendValue: number;
  totalChangeValue: number;
  totalChangePercent: number;
} {
  const previousValue = pricePerf.referencePrice * shares;
  const totalChangeValue = pricePerf.changeValue + dividendValue;
  const totalChangePercent =
    previousValue > 0 ? (totalChangeValue / previousValue) * 100 : 0;

  return {
    ...pricePerf,
    dividendValue,
    totalChangeValue,
    totalChangePercent,
  };
}

export function computePerformance(
  currentPrice: number,
  referencePrice: number,
  shares: number
): { changePercent: number; changeValue: number } {
  if (referencePrice === 0) {
    return { changePercent: 0, changeValue: 0 };
  }
  const changePercent = ((currentPrice - referencePrice) / referencePrice) * 100;
  const changeValue = (currentPrice - referencePrice) * shares;
  return { changePercent, changeValue };
}
