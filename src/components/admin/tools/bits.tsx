// ============================================================
// Small server-safe pieces for the Admin tools / Social / Overview
// screens: a plain prototype-style table (always inside an
// overflow-x wrapper so 375px never scrolls sideways), the bar list,
// the blue "existing Hub screen" note, and a tabbed card shell.
// ============================================================

import { CardTabs, type CardTab } from "@/components/admin/ops-bits";

export interface Col<Row> {
  h: string;
  num?: boolean;
  r: (row: Row) => React.ReactNode;
}

export function SimpleTable<Row>({
  cols,
  rows,
  rowKey,
  empty = "Nothing here yet.",
}: {
  cols: Col<Row>[];
  rows: Row[];
  rowKey: (row: Row, i: number) => string;
  empty?: string;
}) {
  if (rows.length === 0) {
    return <div className="px-4 py-10 text-center text-[13px] text-stone-500">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-stone-200 text-left text-[12px] text-stone-500">
            {cols.map((c, i) => (
              <th key={i} className={"whitespace-nowrap px-4 py-2.5 font-medium " + (c.num ? "text-right" : "")}>
                {c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={rowKey(row, ri)} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60">
              {cols.map((c, ci) => (
                <td key={ci} className={"px-4 py-2.5 align-middle text-stone-700 " + (c.num ? "text-right tabular-nums" : "")}>
                  {c.r(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The prototype's horizontal bar list (label · track · value). */
export function BarList({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="grid gap-2.5">
      {rows.map(([l, v]) => (
        <div key={l} className="grid grid-cols-[84px_minmax(0,1fr)_64px] items-center gap-3 text-[13px]">
          <span className="truncate text-stone-600">{l}</span>
          <span className="h-2 overflow-hidden rounded-full bg-stone-100">
            <i className="block h-full rounded-full bg-stone-800" style={{ width: `${Math.round((v / max) * 100)}%` }} />
          </span>
          <span className="text-right tabular-nums text-stone-900">{v.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export function HubNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex gap-2.5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[13px] text-stone-600">
      <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

/** One card with link tabs on top (the prototype's `tabbed()` body). */
export function TabbedCard({ tabs, children }: { tabs: CardTab[]; children: React.ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white">
      <CardTabs tabs={tabs} />
      {children}
    </section>
  );
}

export function Dim({ children }: { children: React.ReactNode }) {
  return <span className="text-stone-400">{children}</span>;
}

export const btnCls =
  "inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400";
export const btnPrimaryCls =
  "inline-flex items-center gap-1.5 rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#B33407]";
export const btnDisabledCls =
  "inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-400";
