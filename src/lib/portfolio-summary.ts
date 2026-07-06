import type {
  AnalyzedHolding,
  PortfolioSummary,
  Period,
} from "./types";
import { PERIODS } from "./types";

export function emptyPerformance(): AnalyzedHolding["performance"] {
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

export function buildSummary(holdings: AnalyzedHolding[]): PortfolioSummary {
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
      (sum, h) => sum + h.performance[period.key].referencePrice * h.shares,
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

  return {
    totalValue,
    positionCount: holdings.length,
    performance,
    bestPerformer: findExtreme(holdings, "max"),
    worstPerformer: findExtreme(holdings, "min"),
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
