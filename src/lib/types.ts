export type Period = "1d" | "1m" | "3m" | "6m" | "12m" | "3y" | "5y";

export const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "1d", label: "1T", days: 1 },
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "12m", label: "12M", days: 365 },
  { key: "3y", label: "3J", days: 1095 },
  { key: "5y", label: "5J", days: 1825 },
];

/** History lookback for price/dividend fetches (covers longest period + buffer). */
export const MAX_HISTORY_DAYS = 1900;

export interface HoldingInput {
  wkn: string;
  shares: number;
}

export interface PeriodPerformance {
  referencePrice: number;
  changePercent: number;
  changeValue: number;
  dividendValue: number;
  totalChangeValue: number;
  totalChangePercent: number;
}

export interface AnalyzedHolding {
  wkn: string;
  shares: number;
  isin: string | null;
  ticker: string | null;
  name: string;
  quoteType: string | null;
  currentPrice: number;
  currentValue: number;
  error: string | null;
  performance: Record<Period, PeriodPerformance>;
}

export interface EtfConstituent {
  symbol: string;
  name: string;
  weight: number;
  value: number;
  performance: Record<Period, PeriodPerformance>;
}

export interface EtfBreakdown {
  etfTicker: string;
  etfName: string;
  etfWkn: string;
  etfValue: number;
  constituents: EtfConstituent[];
  otherValue: number;
  otherPerformance: Record<Period, PeriodPerformance>;
  coveragePercent: number;
}

export interface PortfolioSummary {
  totalValue: number;
  positionCount: number;
  performance: Record<
    Period,
    {
      changeValue: number;
      changePercent: number;
      dividendValue: number;
      totalChangeValue: number;
      totalChangePercent: number;
    }
  >;
  bestPerformer: { wkn: string; name: string; period: Period; changePercent: number } | null;
  worstPerformer: { wkn: string; name: string; period: Period; changePercent: number } | null;
}

export interface AnalyzeResponse {
  holdings: AnalyzedHolding[];
  summary: PortfolioSummary;
  etfBreakdowns: EtfBreakdown[];
  analyzedAt: string;
}
