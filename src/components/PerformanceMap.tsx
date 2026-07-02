"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { AnalyzedHolding, Period } from "@/lib/types";
import { finvizColor, formatCurrency, formatPercent } from "@/lib/format";

interface PerformanceMapProps {
  holdings: AnalyzedHolding[];
  period: Period;
}

export default function PerformanceMap({ holdings, period }: PerformanceMapProps) {
  const validHoldings = holdings.filter((h) => !h.error && h.currentValue > 0);

  const option = useMemo(() => {
    if (validHoldings.length === 0) {
      return null;
    }

    const children = validHoldings.map((h) => {
      const perf = h.performance[period];
      return {
        name: h.name,
        value: h.currentValue,
        changePercent: perf.changePercent,
        changeValue: perf.changeValue,
        wkn: h.wkn,
        shares: h.shares,
        itemStyle: {
          color: finvizColor(perf.changePercent),
          borderColor: "#1a1a2e",
          borderWidth: 2,
          gapWidth: 2,
        },
        label: {
          show: true,
          formatter: () => {
            const shortName =
              h.name.length > 12 ? h.name.slice(0, 10) + "…" : h.name;
            return `{name|${shortName}}\n{pct|${formatPercent(perf.changePercent)}}`;
          },
          rich: {
            name: {
              fontSize: 12,
              fontWeight: "bold",
              color: "#fff",
              lineHeight: 16,
            },
            pct: {
              fontSize: 11,
              color: "#fff",
              lineHeight: 14,
            },
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
          data: {
            wkn: string;
            shares: number;
            changePercent: number;
            changeValue: number;
          };
        }) => {
          const d = params.data;
          return [
            `<b>${params.name}</b>`,
            `WKN: ${d.wkn}`,
            `Anteile: ${d.shares}`,
            `Wert: ${formatCurrency(params.value)}`,
            `Änderung: ${formatCurrency(d.changeValue)} (${formatPercent(d.changePercent)})`,
          ].join("<br/>");
        },
      },
      series: [
        {
          type: "treemap",
          width: "100%",
          height: "100%",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          levels: [
            {
              itemStyle: {
                borderColor: "#1a1a2e",
                borderWidth: 2,
                gapWidth: 2,
              },
            },
          ],
          data: children,
        },
      ],
    };
  }, [validHoldings, period]);

  if (!option) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-xl border border-[#2d2d44] bg-[#12121f] text-gray-400">
        Keine gültigen Positionen für die Karte verfügbar
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#2d2d44] bg-[#12121f] p-4">
      <ReactECharts
        option={option}
        style={{ height: "500px", width: "100%" }}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
