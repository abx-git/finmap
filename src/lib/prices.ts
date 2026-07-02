import "server-only";
import YahooFinance from "yahoo-finance2";
import { getCached, setCache, sanitizeCacheKey } from "./cache";
import type { Period } from "./types";
import { PERIODS, MAX_HISTORY_DAYS } from "./types";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

export interface PriceData {
  currentPrice: number;
  previousClose: number;
  historicalPrices: Record<Period, number>;
  quoteType: string | null;
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function findClosestPrice(
  prices: { date: Date; close: number }[],
  targetDate: Date
): number | null {
  if (prices.length === 0) return null;

  const target = targetDate.getTime();
  let closest = prices[0];
  let minDiff = Math.abs(prices[0].date.getTime() - target);

  for (const price of prices) {
    const diff = Math.abs(price.date.getTime() - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = price;
    }
  }

  return closest.close;
}

export async function fetchPriceData(ticker: string): Promise<PriceData> {
  const cacheKey = sanitizeCacheKey(`prices_v2_${ticker}`);
  const cached = await getCached<PriceData>(cacheKey);
  if (cached && PERIODS.every((p) => cached.historicalPrices[p.key] != null)) {
    return cached;
  }

  const now = new Date();
  const startDate = subtractDays(now, MAX_HISTORY_DAYS);

  const [quote, history] = await Promise.all([
    yahooFinance.quote(ticker),
    yahooFinance.historical(ticker, {
      period1: startDate,
      period2: now,
      interval: "1d",
    }),
  ]);

  const currentPrice =
    quote.regularMarketPrice ??
    quote.postMarketPrice ??
    quote.preMarketPrice ??
    0;

  const previousClose = quote.regularMarketPreviousClose ?? currentPrice;

  const sortedHistory = history
    .filter((h) => h.close != null)
    .map((h) => ({ date: h.date, close: h.close as number }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const historicalPrices = {} as Record<Period, number>;

  for (const period of PERIODS) {
    if (period.key === "1d") {
      historicalPrices["1d"] = previousClose;
    } else {
      const targetDate = subtractDays(now, period.days);
      const price = findClosestPrice(sortedHistory, targetDate);
      historicalPrices[period.key] = price ?? previousClose;
    }
  }

  const data: PriceData = {
    currentPrice,
    previousClose,
    historicalPrices,
    quoteType: quote.quoteType ?? null,
  };

  await setCache(cacheKey, data);
  return data;
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
