"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EtfBreakdown, Period } from "@/lib/types";
import { finvizColor, formatCurrency, formatPercent } from "@/lib/format";

interface EtfBreakdownMapProps {
  breakdowns: EtfBreakdown[];
  period: Period;
}

interface TreemapNode {
  name: string;
  value: number;
  changePercent: number;
  changeValue: number;
  symbol?: string;
  etfName?: string;
  weight?: number;
  children?: TreemapNode[];
  itemStyle?: { color: string; borderColor: string; borderWidth: number; gapWidth: number };
  label?: {
    show: boolean;
    formatter: () => string;
    rich: Record<string, { fontSize: number; fontWeight?: string; color: string; lineHeight: number }>;
  };
}

function shortName(name: string, max = 14): string {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

function buildLeafNode(
  name: string,
  value: number,
  changePercent: number,
  changeValue: number,
  meta: { symbol?: string; etfName?: string; weight?: number }
): TreemapNode {
  return {
    name,
    value,
    changePercent,
    changeValue,
    ...meta,
    itemStyle: {
      color: finvizColor(changePercent),
      borderColor: "#1a1a2e",
      borderWidth: 1,
      gapWidth: 1,
    },
    label: {
      show: value > 0,
      formatter: () =>
        `{name|${shortName(name)}}\n{pct|${formatPercent(changePercent)}}`,
      rich: {
        name: { fontSize: 11, fontWeight: "bold", color: "#fff", lineHeight: 14 },
        pct: { fontSize: 10, color: "#fff", lineHeight: 12 },
      },
    },
  };
}

export default function EtfBreakdownMap({ breakdowns, period }: EtfBreakdownMapProps) {
  const option = useMemo(() => {
    if (breakdowns.length === 0) return null;

    const children: TreemapNode[] = breakdowns.map((etf) => {
      const etfPerf = etf.constituents.reduce(
        (sum, c) => sum + c.performance[period].changePercent * c.weight,
        0
      );

      const leaves: TreemapNode[] = etf.constituents.map((c) =>
        buildLeafNode(c.name, c.value, c.performance[period].changePercent, c.performance[period].changeValue * c.value, {
          symbol: c.symbol,
          etfName: etf.etfName,
          weight: c.weight,
        })
      );

      if (etf.otherValue > 0) {
        leaves.push(
          buildLeafNode(
            "Übrige Bestandteile",
            etf.otherValue,
            etf.otherPerformance[period].changePercent,
            etf.otherPerformance[period].changeValue,
            { etfName: etf.etfName, weight: 1 - etf.coveragePercent }
          )
        );
      }

      return {
        name: etf.etfName,
        value: etf.etfValue,
        changePercent: etfPerf,
        changeValue: 0,
        symbol: etf.etfTicker,
        children: leaves,
        itemStyle: {
          color: "#2d2d44",
          borderColor: "#1a1a2e",
          borderWidth: 2,
          gapWidth: 2,
        },
        label: {
          show: true,
          formatter: () => `{name|${shortName(etf.etfName, 20)}}`,
          rich: {
            name: { fontSize: 12, fontWeight: "bold", color: "#fff", lineHeight: 16 },
            pct: { fontSize: 11, color: "#ccc", lineHeight: 14 },
          },
        },
      };
    });

    return {
      backgroundColor: "transparent",
      tooltip: {
        backgroundColor: "#1a1a2e",
        borderColor: "#2d2d44",
        textStyle: { color: "#fff", fontSize: 13 },
        formatter: (params: {
          name: string;
          value: number;
          treePathInfo?: { name: string }[];
          data: TreemapNode;
        }) => {
          const d = params.data;
          const path = params.treePathInfo?.map((p) => p.name).filter(Boolean).join(" → ");
          const lines = [`<b>${params.name}</b>`];
          if (path) lines.push(path);
          if (d.symbol) lines.push(`Symbol: ${d.symbol}`);
          if (d.weight != null) lines.push(`Gewicht: ${formatPercent(d.weight * 100)}`);
          lines.push(`Wert im Portfolio: ${formatCurrency(params.value)}`);
          if (d.changePercent != null) {
            lines.push(
              `Performance: ${formatPercent(d.changePercent)} (${formatCurrency(d.changeValue)})`
            );
          }
          return lines.join("<br/>");
        },
      },
      series: [
        {
          type: "treemap",
          width: "100%",
          height: "100%",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: true },
          levels: [
            {
              itemStyle: {
                borderColor: "#1a1a2e",
                borderWidth: 3,
                gapWidth: 3,
              },
              upperLabel: { show: true, height: 28, color: "#fff" },
            },
            {
              itemStyle: {
                borderColor: "#1a1a2e",
                borderWidth: 1,
                gapWidth: 1,
              },
            },
          ],
          data: children,
        },
      ],
    };
  }, [breakdowns, period]);

  if (!option) {
    return (
      <div className="rounded-xl border border-[#2d2d44] bg-[#12121f] p-6">
        <h2 className="mb-2 text-lg font-semibold text-white">ETF-Aufschlüsselung</h2>
        <p className="text-sm text-gray-400">
          Keine ETFs im Portfolio – diese Karte zeigt die Top-Bestandteile Ihrer ETF-Positionen.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#2d2d44] bg-[#12121f] p-4">
      <div className="mb-4 px-2">
        <h2 className="text-lg font-semibold text-white">ETF-Aufschlüsselung</h2>
        <p className="mt-1 text-sm text-gray-400">
          Top-Bestandteile je ETF, gewichtet nach Portfoliowert. Yahoo Finance liefert typischerweise
          die 10 größten Positionen (ø{" "}
          {formatPercent(
            breakdowns.reduce((sum, e) => sum + e.coveragePercent, 0) /
              breakdowns.length *
              100
          )}{" "}
          Abdeckung); der Rest erscheint als „Übrige Bestandteile“.
        </p>
      </div>
      <ReactECharts
        option={option}
        style={{ height: "560px", width: "100%" }}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
