"use client";

import type { PortfolioSummary, Period } from "@/lib/types";
import { PERIODS } from "@/lib/types";
import { formatCurrency, formatPercent, percentColor } from "@/lib/format";

interface PortfolioSummaryProps {
  summary: PortfolioSummary;
  period: Period;
}

export default function PortfolioSummaryCard({ summary, period }: PortfolioSummaryProps) {
  const perf = summary.performance[period];
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  const priceShare =
    perf.totalChangeValue !== 0
      ? Math.abs(perf.changeValue / perf.totalChangeValue) * 100
      : perf.changeValue !== 0
        ? 100
        : 0;
  const dividendShare =
    perf.totalChangeValue !== 0
      ? Math.abs(perf.dividendValue / perf.totalChangeValue) * 100
      : perf.dividendValue !== 0
        ? 100
        : 0;

  return (
    <div className="rounded-xl border border-[#2d2d44] bg-[#12121f] p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">Zusammenfassung</h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Gesamtwert" value={formatCurrency(summary.totalValue)} />
        <StatCard
          label={`Gesamtentwicklung (${periodLabel})`}
          value={formatCurrency(perf.totalChangeValue)}
          colorClass={percentColor(perf.totalChangePercent)}
        />
        <StatCard
          label={`Gesamtrendite (${periodLabel})`}
          value={formatPercent(perf.totalChangePercent)}
          colorClass={percentColor(perf.totalChangePercent)}
        />
        <StatCard label="Positionen" value={String(summary.positionCount)} />
      </div>

      <div className="mt-4 rounded-lg bg-[#0f0f1a] p-4">
        <p className="mb-3 text-sm font-medium text-gray-300">
          Entwicklung im Zeitraum {periodLabel}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <BreakdownItem
            label="Kursgewinn"
            value={formatCurrency(perf.changeValue)}
            percent={formatPercent(perf.changePercent)}
            colorClass={percentColor(perf.changePercent)}
          />
          <BreakdownItem
            label="Ausschüttungen"
            value={formatCurrency(perf.dividendValue)}
            percent={perf.dividendValue > 0 ? "inkl. Dividenden" : "keine im Zeitraum"}
            colorClass="text-amber-400"
          />
          <BreakdownItem
            label="Gesamt"
            value={formatCurrency(perf.totalChangeValue)}
            percent={formatPercent(perf.totalChangePercent)}
            colorClass={percentColor(perf.totalChangePercent)}
            highlight
          />
        </div>

        {(perf.changeValue !== 0 || perf.dividendValue !== 0) && (
          <div className="mt-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-[#1a1a2e]">
              {perf.changeValue !== 0 && (
                <div
                  className={`${perf.changeValue >= 0 ? "bg-green-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(priceShare, 100)}%` }}
                  title={`Kursgewinn: ${formatCurrency(perf.changeValue)}`}
                />
              )}
              {perf.dividendValue > 0 && (
                <div
                  className="bg-amber-500"
                  style={{ width: `${Math.min(dividendShare, 100)}%` }}
                  title={`Ausschüttungen: ${formatCurrency(perf.dividendValue)}`}
                />
              )}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Kursgewinn
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                Ausschüttungen
              </span>
            </div>
          </div>
        )}
      </div>

      {(summary.bestPerformer || summary.worstPerformer) && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {summary.bestPerformer && (
            <div className="rounded-lg bg-[#0f0f1a] p-4">
              <p className="text-sm text-gray-400">Bester Performer (inkl. Ausschüttungen)</p>
              <p className="mt-1 font-medium text-white">
                {summary.bestPerformer.name}{" "}
                <span className="font-mono text-gray-500">({summary.bestPerformer.wkn})</span>
              </p>
              <p className="mt-1 text-green-400">
                {formatPercent(summary.bestPerformer.changePercent)}
              </p>
            </div>
          )}
          {summary.worstPerformer && (
            <div className="rounded-lg bg-[#0f0f1a] p-4">
              <p className="text-sm text-gray-400">Schlechtester Performer (inkl. Ausschüttungen)</p>
              <p className="mt-1 font-medium text-white">
                {summary.worstPerformer.name}{" "}
                <span className="font-mono text-gray-500">({summary.worstPerformer.wkn})</span>
              </p>
              <p className="mt-1 text-red-400">
                {formatPercent(summary.worstPerformer.changePercent)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded-lg bg-[#0f0f1a] p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${colorClass ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function BreakdownItem({
  label,
  value,
  percent,
  colorClass,
  highlight,
}: {
  label: string;
  value: string;
  percent: string;
  colorClass: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-[#1a1a2e] ring-1 ring-[#2d2d44]" : "bg-[#12121f]"}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${colorClass}`}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-400">{percent}</p>
    </div>
  );
}
