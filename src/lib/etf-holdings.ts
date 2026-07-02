import "server-only";
import YahooFinance from "yahoo-finance2";
import { getCached, setCache, sanitizeCacheKey } from "./cache";
import { fetchPriceData, computePerformance } from "./prices";
import type {
  AnalyzedHolding,
  EtfBreakdown,
  EtfConstituent,
  Period,
  PeriodPerformance,
} from "./types";
import { PERIODS } from "./types";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const GERMAN_YAHOO_SUFFIXES = [".DE", ".DU", ".MU", ".HM", ".F", ".SG", ".HA", ".AS"];

interface RawEtfHolding {
  symbol?: string;
  holdingName?: string;
  holdingPercent?: number;
}

async function fetchTopHoldings(ticker: string): Promise<RawEtfHolding[]> {
  const cacheKey = sanitizeCacheKey(`etf_holdings_${ticker}`);
  const cached = await getCached<RawEtfHolding[]>(cacheKey);
  if (cached) return cached;

  const tickersToTry = withPreferredTickers(ticker);

  for (const candidate of tickersToTry) {
    try {
      const summary = await yahooFinance.quoteSummary(candidate, {
        modules: ["topHoldings"],
      });
      const holdings = summary.topHoldings?.holdings ?? [];
      if (holdings.length > 0) {
        await setCache(cacheKey, holdings);
        return holdings;
      }
    } catch {
      // try next ticker variant
    }
  }

  return [];
}

function withPreferredTickers(symbol: string): string[] {
  const base = symbol.includes(".") ? symbol.slice(0, symbol.lastIndexOf(".")) : symbol;
  return [...new Set([`${base}.DE`, symbol, ...GERMAN_YAHOO_SUFFIXES.map((suffix) => `${base}${suffix}`)])];
}

function emptyPeriodPerformance(): Record<Period, PeriodPerformance> {
  const perf = {} as Record<Period, PeriodPerformance>;
  for (const period of PERIODS) {
    perf[period.key] = {
      referencePrice: 0,
      changePercent: 0,
      changeValue: 0,
      dividendValue: 0,
      totalChangeValue: 0,
      totalChangePercent: 0,
    };
  }
  return perf;
}

async function fetchConstituentPerformance(
  symbol: string
): Promise<Record<Period, PeriodPerformance>> {
  try {
    const priceData = await fetchPriceData(symbol);
    const perf = {} as Record<Period, PeriodPerformance>;
    for (const period of PERIODS) {
      const refPrice = priceData.historicalPrices[period.key];
      const { changePercent, changeValue } = computePerformance(
        priceData.currentPrice,
        refPrice,
        1
      );
      perf[period.key] = {
        referencePrice: refPrice,
        changePercent,
        changeValue,
        dividendValue: 0,
        totalChangeValue: changeValue,
        totalChangePercent: changePercent,
      };
    }
    return perf;
  } catch {
    return emptyPeriodPerformance();
  }
}

export async function buildEtfBreakdowns(
  holdings: AnalyzedHolding[]
): Promise<EtfBreakdown[]> {
  const etfs = holdings.filter(
    (h) => !h.error && h.ticker && h.quoteType === "ETF" && h.currentValue > 0
  );

  const breakdowns: EtfBreakdown[] = [];

  for (const etf of etfs) {
    const rawHoldings = await fetchTopHoldings(etf.ticker!);
    const validHoldings = rawHoldings.filter(
      (h) => h.symbol && h.holdingPercent && h.holdingPercent > 0
    );

    const coveragePercent = validHoldings.reduce(
      (sum, h) => sum + (h.holdingPercent ?? 0),
      0
    );
    const otherWeight = Math.max(0, 1 - coveragePercent);

    const uniqueSymbols = [...new Set(validHoldings.map((h) => h.symbol!))];
    const performanceBySymbol = new Map<string, Record<Period, PeriodPerformance>>();

    await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        const perf = await fetchConstituentPerformance(symbol);
        performanceBySymbol.set(symbol, perf);
      })
    );

    const constituents: EtfConstituent[] = validHoldings.map((h) => {
      const value = etf.currentValue * (h.holdingPercent ?? 0);
      return {
        symbol: h.symbol!,
        name: h.holdingName ?? h.symbol!,
        weight: h.holdingPercent ?? 0,
        value,
        performance: performanceBySymbol.get(h.symbol!) ?? emptyPeriodPerformance(),
      };
    });

    const otherValue = etf.currentValue * otherWeight;
    const otherPerformance = {} as Record<Period, PeriodPerformance>;
    for (const period of PERIODS) {
      otherPerformance[period.key] = {
        referencePrice: etf.performance[period.key].referencePrice * otherWeight,
        changePercent: etf.performance[period.key].changePercent,
        changeValue: etf.performance[period.key].changeValue * otherWeight,
        dividendValue: etf.performance[period.key].dividendValue * otherWeight,
        totalChangeValue: etf.performance[period.key].totalChangeValue * otherWeight,
        totalChangePercent: etf.performance[period.key].totalChangePercent,
      };
    }

    breakdowns.push({
      etfTicker: etf.ticker!,
      etfName: etf.name,
      etfWkn: etf.wkn,
      etfValue: etf.currentValue,
      constituents,
      otherValue,
      otherPerformance,
      coveragePercent,
    });
  }

  return breakdowns;
}
