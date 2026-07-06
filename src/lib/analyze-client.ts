import { resolveWkn } from "./wkn-browser";
import {
  fetchPriceData,
  fetchDividends,
  fetchTopHoldings,
} from "./yahoo-browser";
import {
  computePerformance,
  computeDividendsForPeriod,
  enrichWithDividends,
} from "./dividends-calc";
import { buildSummary, emptyPerformance } from "./portfolio-summary";
import type {
  HoldingInput,
  AnalyzeResponse,
  AnalyzedHolding,
  EtfBreakdown,
  EtfConstituent,
  Period,
  PeriodPerformance,
} from "./types";
import { PERIODS } from "./types";

function emptyPeriodPerformance(): Record<Period, PeriodPerformance> {
  return emptyPerformance() as Record<Period, PeriodPerformance>;
}

async function buildEtfBreakdowns(holdings: AnalyzedHolding[]): Promise<EtfBreakdown[]> {
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

    const constituents: EtfConstituent[] = [];
    for (const h of validHoldings) {
      const value = etf.currentValue * (h.holdingPercent ?? 0);
      let performance = emptyPeriodPerformance();
      try {
        const priceData = await fetchPriceData(h.symbol!);
        performance = {} as Record<Period, PeriodPerformance>;
        for (const period of PERIODS) {
          const refPrice = priceData.historicalPrices[period.key];
          const { changePercent, changeValue } = computePerformance(
            priceData.currentPrice,
            refPrice,
            1
          );
          performance[period.key] = {
            referencePrice: refPrice,
            changePercent,
            changeValue,
            dividendValue: 0,
            totalChangeValue: changeValue,
            totalChangePercent: changePercent,
          };
        }
      } catch {
        // keep empty performance
      }

      constituents.push({
        symbol: h.symbol!,
        name: h.holdingName ?? h.symbol!,
        weight: h.holdingPercent ?? 0,
        value,
        performance,
      });
    }

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

export async function analyzePortfolioClient(
  holdings: HoldingInput[]
): Promise<AnalyzeResponse> {
  const analyzed: AnalyzedHolding[] = [];

  for (const holding of holdings) {
    const wkn = holding.wkn.toUpperCase().replace(/\s/g, "");

    try {
      const resolved = await resolveWkn(wkn);
      if (!resolved) {
        analyzed.push({
          wkn,
          shares: holding.shares,
          isin: null,
          ticker: null,
          name: "Unbekannt",
          quoteType: null,
          currentPrice: 0,
          currentValue: 0,
          error: `WKN ${wkn} konnte nicht aufgelöst werden`,
          performance: emptyPerformance(),
        });
        continue;
      }

      const [priceData, dividends] = await Promise.all([
        fetchPriceData(resolved.ticker),
        fetchDividends(resolved.ticker),
      ]);
      const currentValue = priceData.currentPrice * holding.shares;

      const performance = {} as AnalyzedHolding["performance"];
      for (const period of PERIODS) {
        const refPrice = priceData.historicalPrices[period.key];
        const pricePerf = computePerformance(
          priceData.currentPrice,
          refPrice,
          holding.shares
        );
        const dividendValue = computeDividendsForPeriod(
          dividends,
          holding.shares,
          period.key
        );
        performance[period.key] = enrichWithDividends(
          { ...pricePerf, referencePrice: refPrice },
          dividendValue,
          holding.shares
        );
      }

      analyzed.push({
        wkn,
        shares: holding.shares,
        isin: resolved.isin,
        ticker: resolved.ticker,
        name: resolved.name,
        quoteType: priceData.quoteType,
        currentPrice: priceData.currentPrice,
        currentValue,
        error: null,
        performance,
      });
    } catch (err) {
      analyzed.push({
        wkn,
        shares: holding.shares,
        isin: null,
        ticker: null,
        name: "Fehler",
        quoteType: null,
        currentPrice: 0,
        currentValue: 0,
        error: err instanceof Error ? err.message : "Unbekannter Fehler",
        performance: emptyPerformance(),
      });
    }
  }

  const validHoldings = analyzed.filter((h) => !h.error);
  const summary = buildSummary(validHoldings);
  const etfBreakdowns = await buildEtfBreakdowns(validHoldings);

  return {
    holdings: analyzed,
    summary,
    etfBreakdowns,
    analyzedAt: new Date().toISOString(),
  };
}
