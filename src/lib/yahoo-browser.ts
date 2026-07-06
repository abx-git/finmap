import type { Period } from "./types";
import { PERIODS, MAX_HISTORY_DAYS } from "./types";
import type { DividendEvent } from "./dividends-calc";
import { getMemoryCached, setMemoryCache, sanitizeCacheKey } from "./memory-cache";

export interface PriceData {
  currentPrice: number;
  previousClose: number;
  historicalPrices: Record<Period, number>;
  quoteType: string | null;
}

interface ChartResult {
  meta?: {
    regularMarketPrice?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    longName?: string;
    shortName?: string;
    instrumentType?: string;
    quoteType?: string;
  };
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
  events?: {
    dividends?: Record<string, { amount: number; date: number }>;
  };
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

async function yahooGet(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Yahoo API Fehler: ${res.status}`);
  }
  return res.json();
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

function parseChartResult(result: ChartResult) {
  const meta = result.meta ?? {};
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const history = timestamps
    .map((ts, i) => {
      const close = closes[i];
      if (close == null) return null;
      return { date: new Date(ts * 1000), close };
    })
    .filter((p): p is { date: Date; close: number } => p !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const dividends: DividendEvent[] = Object.values(result.events?.dividends ?? {}).map(
    (d) => ({ date: new Date(d.date * 1000), amount: d.amount })
  );

  return {
    currentPrice: meta.regularMarketPrice ?? 0,
    previousClose: meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice ?? 0,
    quoteType: meta.instrumentType ?? meta.quoteType ?? null,
    name: meta.longName ?? meta.shortName ?? null,
    history,
    dividends,
  };
}

export async function fetchChartData(
  ticker: string,
  range = "5y",
  includeDividends = false
) {
  const cacheKey = sanitizeCacheKey(`chart_${ticker}_${range}_${includeDividends}`);
  const cached = getMemoryCached<ReturnType<typeof parseChartResult>>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    interval: "1d",
    range,
  });
  if (includeDividends) params.set("events", "dividends");

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${params}`;
  const data = (await yahooGet(url)) as { chart?: { result?: ChartResult[] } };
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(`Keine Kursdaten für ${ticker}`);

  const parsed = parseChartResult(result);
  setMemoryCache(cacheKey, parsed);
  return parsed;
}

export async function fetchPriceData(ticker: string): Promise<PriceData> {
  const cacheKey = sanitizeCacheKey(`prices_browser_${ticker}`);
  const cached = getMemoryCached<PriceData>(cacheKey);
  if (cached && PERIODS.every((p) => cached.historicalPrices[p.key] != null)) {
    return cached;
  }

  const chart = await fetchChartData(ticker, "5y", false);
  const now = new Date();
  const historicalPrices = {} as Record<Period, number>;

  for (const period of PERIODS) {
    if (period.key === "1d") {
      historicalPrices["1d"] = chart.previousClose;
    } else {
      const targetDate = subtractDays(now, period.days);
      const price = findClosestPrice(chart.history, targetDate);
      historicalPrices[period.key] = price ?? chart.previousClose;
    }
  }

  const data: PriceData = {
    currentPrice: chart.currentPrice,
    previousClose: chart.previousClose,
    historicalPrices,
    quoteType: chart.quoteType,
  };
  setMemoryCache(cacheKey, data);
  return data;
}

export async function fetchDividends(ticker: string): Promise<DividendEvent[]> {
  const cacheKey = sanitizeCacheKey(`dividends_browser_${ticker}`);
  const cached = getMemoryCached<DividendEvent[]>(cacheKey);
  if (cached) return cached;

  const chart = await fetchChartData(ticker, "5y", true);
  const cutoff = subtractDays(new Date(), MAX_HISTORY_DAYS);
  const dividends = chart.dividends
    .filter((d) => d.date >= cutoff)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  setMemoryCache(cacheKey, dividends);
  return dividends;
}

export async function verifyYahooTicker(ticker: string): Promise<{
  name: string;
} | null> {
  try {
    const chart = await fetchChartData(ticker, "5d", false);
    if (!chart.currentPrice) return null;
    return { name: chart.name ?? ticker };
  } catch {
    return null;
  }
}

export async function searchYahoo(query: string): Promise<object[]> {
  const params = new URLSearchParams({ q: query, quotesCount: "10" });
  const url = `https://query1.finance.yahoo.com/v1/finance/search?${params}`;
  const data = (await yahooGet(url)) as { quotes?: object[] };
  return data.quotes ?? [];
}

export interface TopHolding {
  symbol?: string;
  holdingName?: string;
  holdingPercent?: number;
}

export async function fetchTopHoldings(ticker: string): Promise<TopHolding[]> {
  const cacheKey = sanitizeCacheKey(`top_holdings_${ticker}`);
  const cached = getMemoryCached<TopHolding[]>(cacheKey);
  if (cached) return cached;

  const suffixes = [".DE", ".DU", ".MU", ".HM", ".F", ".AS"];
  const base = ticker.includes(".") ? ticker.slice(0, ticker.lastIndexOf(".")) : ticker;
  const candidates = [...new Set([ticker, `${base}.DE`, ...suffixes.map((s) => base + s)])];

  for (const symbol of candidates) {
    try {
      const params = new URLSearchParams({ modules: "topHoldings" });
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?${params}`;
      const data = (await yahooGet(url)) as {
        quoteSummary?: { result?: Array<{ topHoldings?: { holdings?: TopHolding[] } }> };
      };
      const holdings = data.quoteSummary?.result?.[0]?.topHoldings?.holdings ?? [];
      if (holdings.length > 0) {
        setMemoryCache(cacheKey, holdings);
        return holdings;
      }
    } catch {
      // try next symbol
    }
  }
  return [];
}
