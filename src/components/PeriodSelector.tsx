"use client";

import type { Period } from "@/lib/types";
import { PERIODS } from "@/lib/types";

interface PeriodSelectorProps {
  selected: Period;
  onChange: (period: Period) => void;
}

export default function PeriodSelector({ selected, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-[#0f0f1a] p-1">
      {PERIODS.map((period) => (
        <button
          key={period.key}
          onClick={() => onChange(period.key)}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            selected === period.key
              ? "bg-[#2d2d44] text-white"
              : "text-gray-400 hover:text-white hover:bg-[#1a1a2e]"
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
