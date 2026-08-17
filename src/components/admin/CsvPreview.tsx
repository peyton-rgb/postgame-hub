// ============================================================
// CsvPreview — the parse → preview → confirm upload pattern.
// Parsing happens entirely in the browser; NOTHING is written
// anywhere. The Apply step is rendered by the caller (and tonight
// every caller gates it behind an honest "storage pending" state
// or a confirmed POST once its table exists).
// ============================================================

"use client";

import { useState } from "react";

function parseCsv(text: string): string[][] {
  // Small, dependency-free CSV parse: handles quoted fields + commas.
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

export default function CsvPreview({ maxRows = 20 }: { maxRows?: number }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState<string>("");

  return (
    <div>
      <label className="block">
        <span className="text-[12px] font-medium text-stone-600">
          Upload CSV (parsed in your browser — nothing is written until you confirm)
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-1 block text-[13px]"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = () => setRows(parseCsv(String(reader.result ?? "")));
            reader.readAsText(file);
          }}
        />
      </label>

      {rows && (
        <div className="mt-4">
          <div className="pb-2 text-[13px] text-stone-600">
            <span className="font-medium text-stone-900">{fileName}</span> —{" "}
            {Math.max(0, rows.length - 1).toLocaleString()} data rows
            {rows.length - 1 > maxRows ? ` (showing first ${maxRows})` : ""}
          </div>
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
                  {(rows[0] ?? []).map((h, i) => (
                    <th key={i} className="px-2.5 py-2 font-semibold">
                      {h || `col ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1, 1 + maxRows).map((r, i) => (
                  <tr key={i} className="border-b border-stone-100 last:border-0">
                    {r.map((c, j) => (
                      <td key={j} className="px-2.5 py-1.5 text-stone-700">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
