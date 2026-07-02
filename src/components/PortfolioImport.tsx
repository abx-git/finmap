"use client";

import { useCallback, useRef, useState } from "react";
import Papa from "papaparse";
import { isValidWkn } from "@/lib/validation";
import type { HoldingInput } from "@/lib/types";

interface PortfolioImportProps {
  holdings: HoldingInput[];
  onChange: (holdings: HoldingInput[]) => void;
  onAnalyze: () => void;
  loading: boolean;
}

interface EditableRow extends HoldingInput {
  id: string;
  wknError?: string;
  sharesError?: string;
}

function toRows(holdings: HoldingInput[]): EditableRow[] {
  return holdings.map((h, i) => ({ ...h, id: `row-${i}` }));
}

function fromRows(rows: EditableRow[]): HoldingInput[] {
  return rows.map(({ wkn, shares }) => ({ wkn: wkn.toUpperCase().trim(), shares }));
}

function validateRow(row: EditableRow): EditableRow {
  const wknError = !row.wkn.trim()
    ? "WKN erforderlich"
    : !isValidWkn(row.wkn)
      ? "6-stellige alphanumerische WKN"
      : undefined;
  const sharesError =
    !row.shares || row.shares <= 0 ? "Positive Zahl erforderlich" : undefined;
  return { ...row, wknError, sharesError };
}

export default function PortfolioImport({
  holdings,
  onChange,
  onAnalyze,
  loading,
}: PortfolioImportProps) {
  const [rows, setRows] = useState<EditableRow[]>(() => toRows(holdings));
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateRows = useCallback(
    (newRows: EditableRow[]) => {
      setRows(newRows);
      const valid = newRows.every((r) => !validateRow(r).wknError && !validateRow(r).sharesError);
      if (valid) {
        onChange(fromRows(newRows));
      }
    },
    [onChange]
  );

  const parseFile = useCallback(
    (content: string, isJson: boolean) => {
      let parsed: HoldingInput[] = [];

      if (isJson) {
        const data = JSON.parse(content);
        const list = Array.isArray(data) ? data : data.holdings;
        parsed = list.map((item: { wkn: string; shares: number; anteile?: number }) => ({
          wkn: String(item.wkn),
          shares: Number(item.shares ?? item.anteile),
        }));
      } else {
        const result = Papa.parse<Record<string, string>>(content, {
          header: true,
          skipEmptyLines: true,
          delimiter: content.includes(";") ? ";" : ",",
        });
        parsed = result.data.map((row) => ({
          wkn: String(row.wkn ?? row.WKN ?? "").trim(),
          shares: Number(row.anteile ?? row.Anteile ?? row.shares ?? row.Shares ?? 0),
        }));
      }

      const newRows = parsed.map((h, i) => validateRow({ ...h, id: `import-${i}` }));
      updateRows(newRows);
    },
    [updateRows]
  );

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        parseFile(content, file.name.endsWith(".json"));
      };
      reader.readAsText(file);
    },
    [parseFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const addRow = () => {
    updateRows([...rows, { id: `new-${Date.now()}`, wkn: "", shares: 0 }]);
  };

  const removeRow = (id: string) => {
    updateRows(rows.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, field: keyof HoldingInput, value: string | number) => {
    updateRows(
      rows.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        return validateRow(updated);
      })
    );
  };

  const exportCsv = () => {
    const csv = "wkn;anteile\n" + rows.map((r) => `${r.wkn};${r.shares}`).join("\n");
    downloadFile(csv, "portfolio.csv", "text/csv");
  };

  const exportJson = () => {
    const json = JSON.stringify({ holdings: fromRows(rows) }, null, 2);
    downloadFile(json, "portfolio.json", "application/json");
  };

  const hasErrors = rows.some((r) => validateRow(r).wknError || validateRow(r).sharesError);
  const isEmpty = rows.length === 0;

  return (
    <div className="rounded-xl border border-[#2d2d44] bg-[#12121f] p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">Portfolio</h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`mb-4 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-400/10"
            : "border-[#2d2d44] hover:border-[#4a4a6a]"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <p className="text-gray-300">CSV oder JSON hierher ziehen oder klicken</p>
        <p className="mt-1 text-sm text-gray-500">Format: wkn;anteile</p>
      </div>

      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2d2d44] text-left text-gray-400">
              <th className="pb-2 pr-4">WKN</th>
              <th className="pb-2 pr-4">Anteile</th>
              <th className="pb-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const validated = validateRow(row);
              return (
                <tr key={row.id} className="border-b border-[#1a1a2e]">
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      value={row.wkn}
                      onChange={(e) => updateRow(row.id, "wkn", e.target.value)}
                      placeholder="716460"
                      className="w-full rounded bg-[#0f0f1a] px-3 py-1.5 text-white outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {validated.wknError && (
                      <p className="mt-0.5 text-xs text-red-400">{validated.wknError}</p>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      value={row.shares || ""}
                      onChange={(e) => updateRow(row.id, "shares", Number(e.target.value))}
                      placeholder="100"
                      min={0}
                      step={1}
                      className="w-full rounded bg-[#0f0f1a] px-3 py-1.5 text-white outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {validated.sharesError && (
                      <p className="mt-0.5 text-xs text-red-400">{validated.sharesError}</p>
                    )}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-gray-500 hover:text-red-400"
                      title="Zeile entfernen"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={addRow}
          className="rounded-lg border border-[#2d2d44] px-4 py-2 text-sm text-gray-300 hover:bg-[#1a1a2e]"
        >
          + Zeile
        </button>
        <button
          onClick={exportCsv}
          disabled={isEmpty}
          className="rounded-lg border border-[#2d2d44] px-4 py-2 text-sm text-gray-300 hover:bg-[#1a1a2e] disabled:opacity-40"
        >
          CSV Export
        </button>
        <button
          onClick={exportJson}
          disabled={isEmpty}
          className="rounded-lg border border-[#2d2d44] px-4 py-2 text-sm text-gray-300 hover:bg-[#1a1a2e] disabled:opacity-40"
        >
          JSON Export
        </button>
        <button
          onClick={onAnalyze}
          disabled={loading || hasErrors || isEmpty}
          className="ml-auto rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {loading ? "Analysiere…" : "Analysieren"}
        </button>
      </div>
    </div>
  );
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
