"use client";

import { useCallback, useState } from "react";
import PortfolioImport from "@/components/PortfolioImport";
import PerformanceMap from "@/components/PerformanceMap";
import PeriodSelector from "@/components/PeriodSelector";
import HoldingsTable from "@/components/HoldingsTable";
import PortfolioSummaryCard from "@/components/PortfolioSummary";
import EtfBreakdownMap from "@/components/EtfBreakdownMap";
import type { AnalyzeResponse, HoldingInput, Period } from "@/lib/types";

const DEFAULT_HOLDINGS: HoldingInput[] = [
  { wkn: "716460", shares: 100 },
  { wkn: "840400", shares: 50 },
  { wkn: "593393", shares: 40 },
];

export default function HomePage() {
  const [holdings, setHoldings] = useState<HoldingInput[]>(DEFAULT_HOLDINGS);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [period, setPeriod] = useState<Period>("1d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Analyse fehlgeschlagen");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [holdings]);

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <header className="border-b border-[#2d2d44] bg-[#12121f]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Finmap</h1>
            <p className="text-sm text-gray-400">Portfolio Performance Map</p>
          </div>
          {result && (
            <p className="text-xs text-gray-500">
              Stand: {new Date(result.analyzedAt).toLocaleString("de-DE")}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <PortfolioImport
          holdings={holdings}
          onChange={setHoldings}
          onAnalyze={analyze}
          loading={loading}
        />

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <span className="ml-3 text-gray-400">Kursdaten werden geladen…</span>
          </div>
        )}

        {result && !loading && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-white">Performance Map</h2>
              <PeriodSelector selected={period} onChange={setPeriod} />
            </div>

            <PerformanceMap holdings={result.holdings} period={period} />

            <EtfBreakdownMap breakdowns={result.etfBreakdowns} period={period} />

            <PortfolioSummaryCard summary={result.summary} period={period} />

            <HoldingsTable holdings={result.holdings} period={period} />
          </>
        )}
      </main>

      <footer className="border-t border-[#2d2d44] py-4 text-center text-xs text-gray-600">
        Kursdaten verzögert · Keine Anlageberatung
      </footer>
    </div>
  );
}
