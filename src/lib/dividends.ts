import "server-only";
import YahooFinance from "yahoo-finance2";
import { getCached, setCache, sanitizeCacheKey } from "./cache";
import type { Period } from "./types";
import { PERIODS, MAX_HISTORY_DAYS } from "./types";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export interface DividendEvent {
  date: Date;
  amount: number;
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function normalizeDividends(raw: unknown): DividendEvent[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((d) => d?.date && d?.amount != null)
      .map((d) => ({ date: new Date(d.date), amount: d.amount as number }));
  }
  if (typeof raw === "object") {
    return Object.values(raw as Record<string, DividendEvent>)
      .filter((d) => d?.date && d?.amount != null)
      .map((d) => ({ date: new Date(d.date), amount: d.amount }));
  }
  return [];
}

export async function fetchDividends(ticker: string): Promise<DividendEvent[]> {
  const cacheKey = sanitizeCacheKey(`dividends_v2_${ticker}`);
  const cached = await getCached<DividendEvent[]>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const startDate = subtractDays(now, MAX_HISTORY_DAYS);

  const result = await yahooFinance.chart(ticker, {
    period1: startDate,
    period2: now,
    events: "dividends",
  });

  const dividends = normalizeDividends(result.events?.dividends).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  await setCache(cacheKey, dividends);
  return dividends;
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
