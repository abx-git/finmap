import "server-only";
import { resolveWkn } from "./wkn";
import { fetchPriceData, computePerformance } from "./prices";
import { fetchDividends, computeDividendsForPeriod, enrichWithDividends } from "./dividends";
import { buildEtfBreakdowns } from "./etf-holdings";
import type {
  HoldingInput,
  AnalyzeResponse,
  AnalyzedHolding,
  PortfolioSummary,
  Period,
} from "./types";
import { PERIODS } from "./types";

export async function analyzePortfolio(
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

      const priceData = await fetchPriceData(resolved.ticker);
      const dividends = await fetchDividends(resolved.ticker);
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

function emptyPerformance(): AnalyzedHolding["performance"] {
  const perf = {} as AnalyzedHolding["performance"];
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

function buildSummary(holdings: AnalyzedHolding[]): PortfolioSummary {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  const performance = {} as PortfolioSummary["performance"];
  for (const period of PERIODS) {
    const totalChangeValue = holdings.reduce(
      (sum, h) => sum + h.performance[period.key].changeValue,
      0
    );
    const totalDividendValue = holdings.reduce(
      (sum, h) => sum + h.performance[period.key].dividendValue,
      0
    );
    const totalReturnValue = holdings.reduce(
      (sum, h) => sum + h.performance[period.key].totalChangeValue,
      0
    );
    const previousTotal = holdings.reduce(
      (sum, h) =>
        sum + h.performance[period.key].referencePrice * h.shares,
      0
    );
    const changePercent =
      previousTotal > 0 ? (totalChangeValue / previousTotal) * 100 : 0;
    const totalChangePercent =
      previousTotal > 0 ? (totalReturnValue / previousTotal) * 100 : 0;
    performance[period.key] = {
      changeValue: totalChangeValue,
      changePercent,
      dividendValue: totalDividendValue,
      totalChangeValue: totalReturnValue,
      totalChangePercent,
    };
  }

  const bestPerformer = findExtreme(holdings, "max");
  const worstPerformer = findExtreme(holdings, "min");

  return {
    totalValue,
    positionCount: holdings.length,
    performance,
    bestPerformer,
    worstPerformer,
  };
}

function findExtreme(
  holdings: AnalyzedHolding[],
  mode: "max" | "min"
): PortfolioSummary["bestPerformer"] {
  if (holdings.length === 0) return null;

  let best: { holding: AnalyzedHolding; period: Period; changePercent: number } | null =
    null;

  for (const holding of holdings) {
    for (const period of PERIODS) {
      const cp = holding.performance[period.key].totalChangePercent;
      if (
        best === null ||
        (mode === "max" && cp > best.changePercent) ||
        (mode === "min" && cp < best.changePercent)
      ) {
        best = { holding, period: period.key, changePercent: cp };
      }
    }
  }

  if (!best) return null;
  return {
    wkn: best.holding.wkn,
    name: best.holding.name,
    period: best.period,
    changePercent: best.changePercent,
  };
}
