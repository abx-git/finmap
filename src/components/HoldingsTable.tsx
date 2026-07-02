"use client";

import { useMemo, useState } from "react";
import type { AnalyzedHolding, Period } from "@/lib/types";
import { formatCurrency, formatPercent, percentColor } from "@/lib/format";

interface HoldingsTableProps {
  holdings: AnalyzedHolding[];
  period: Period;
}

type SortKey =
  | "wkn"
  | "name"
  | "shares"
  | "value"
  | "changeValue"
  | "dividendValue"
  | "totalChangeValue"
  | "totalChangePercent";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      className="cursor-pointer pb-3 pr-4 text-left text-gray-400 hover:text-white"
      onClick={() => onSort(field)}
    >
      {label} {sortKey === field ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );
}

export default function HoldingsTable({ holdings, period }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const list = [...holdings];
    list.sort((a, b) => {
      let av: number | string;
      let bv: number | string;

      switch (sortKey) {
        case "wkn":
          av = a.wkn;
          bv = b.wkn;
          break;
        case "name":
          av = a.name;
          bv = b.name;
          break;
        case "shares":
          av = a.shares;
          bv = b.shares;
          break;
        case "value":
          av = a.currentValue;
          bv = b.currentValue;
          break;
        case "changeValue":
          av = a.error ? 0 : a.performance[period].changeValue;
          bv = b.error ? 0 : b.performance[period].changeValue;
          break;
        case "dividendValue":
          av = a.error ? 0 : a.performance[period].dividendValue;
          bv = b.error ? 0 : b.performance[period].dividendValue;
          break;
        case "totalChangeValue":
          av = a.error ? 0 : a.performance[period].totalChangeValue;
          bv = b.error ? 0 : b.performance[period].totalChangeValue;
          break;
        case "totalChangePercent":
          av = a.error ? 0 : a.performance[period].totalChangePercent;
          bv = b.error ? 0 : b.performance[period].totalChangePercent;
          break;
      }

      if (typeof av === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv as string)
          : (bv as string).localeCompare(av);
      }
      return sortDir === "asc" ? av - (bv as number) : (bv as number) - av;
    });
    return list;
  }, [holdings, period, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-[#2d2d44] bg-[#12121f] p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">Positionen</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2d2d44]">
            <SortHeader label="WKN" field="wkn" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Name" field="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Anteile" field="shares" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Wert (EUR)" field="value" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Kurs (EUR)" field="changeValue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Ausschüttung" field="dividendValue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Gesamt (EUR)" field="totalChangeValue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Gesamt (%)" field="totalChangePercent" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => {
            if (h.error) {
              return (
                <tr key={h.wkn} className="border-b border-[#1a1a2e] text-red-400">
                  <td className="py-3 pr-4">{h.wkn}</td>
                  <td className="py-3 pr-4" colSpan={7}>
                    {h.error}
                  </td>
                </tr>
              );
            }

            const perf = h.performance[period];
            return (
              <tr key={h.wkn} className="border-b border-[#1a1a2e] text-gray-200">
                <td className="py-3 pr-4 font-mono">{h.wkn}</td>
                <td className="py-3 pr-4">{h.name}</td>
                <td className="py-3 pr-4">{h.shares}</td>
                <td className="py-3 pr-4">{formatCurrency(h.currentValue)}</td>
                <td className={`py-3 pr-4 ${percentColor(perf.changeValue)}`}>
                  {formatCurrency(perf.changeValue)}
                </td>
                <td className={`py-3 pr-4 ${perf.dividendValue > 0 ? "text-amber-400" : "text-gray-500"}`}>
                  {perf.dividendValue > 0 ? formatCurrency(perf.dividendValue) : "—"}
                </td>
                <td className={`py-3 pr-4 ${percentColor(perf.totalChangePercent)}`}>
                  {formatCurrency(perf.totalChangeValue)}
                </td>
                <td className={`py-3 ${percentColor(perf.totalChangePercent)}`}>
                  {formatPercent(perf.totalChangePercent)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
