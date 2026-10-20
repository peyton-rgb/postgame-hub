// ============================================================
// Small server-safe pieces for the Admin tools / Social / Overview
// screens: a plain prototype-style table (always inside an
// overflow-x wrapper so 375px never scrolls sideways), the bar list,
// the blue "existing Hub screen" note, and a tabbed card shell.
//
// SimpleTable also renders as a card grid (view="cards", the admin
// Rows / Cards toggle). Pass `card` for a hand-shaped card; without it
// each card is the first column as the title and the rest as
// label / value pairs. A card with `href` is one link, so its parts
// must not contain links of their own.
// ============================================================

import Link from "next/link";
import { CardTabs, type CardTab } from "@/components/admin/ops-bits";

export interface Col<Row> {
  h: string;
  num?: boolean;
  r: (row: Row) => React.ReactNode;
}

export interface SimpleCardSpec {
  /** leading logo / avatar */
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** right-aligned key number */
  figure?: React.ReactNode;
  /** pills / short facts under the title */
  strip?: React.ReactNode;
  details?: { label: string; value: React.ReactNode }[];
  /** bottom line: the next action or most useful figure */
  foot?: React.ReactNode;
  /** whole card links here (then nothing inside may be a link) */
  href?: string | null;
  /** href opens a new tab (an outside site) */
  external?: boolean;
}

export function SimpleCard({ spec }: { spec: SimpleCardSpec }) {
  const cls =
    "flex h-full flex-col gap-3 rounded-[10px] border border-[#E3E5E9] bg-white p-3.5 text-[13px] text-inherit no-underline transition-colors hover:border-stone-300";
  const body = (
    <>
      <div className="flex min-w-0 items-start gap-2.5">
        {spec.icon && <div className="shrink-0">{spec.icon}</div>}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-stone-900">{spec.title}</div>
          {spec.subtitle && <div className="truncate text-[12px] text-stone-500">{spec.subtitle}</div>}
        </div>
        {spec.figure != null && spec.figure !== false && (
          <div className="shrink-0 text-right font-semibold tabular-nums text-stone-900">{spec.figure}</div>
        )}
      </div>
      {spec.strip && <div className="flex flex-wrap items-center gap-2 text-[12px] text-stone-500">{spec.strip}</div>}
      {spec.details && spec.details.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
          {spec.details.map((d, i) => (
            <div key={d.label + i} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-stone-400">{d.label}</dt>
              <dd className="mt-0.5 truncate text-stone-800">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {spec.foot && <div className="mt-auto border-t border-[#E3E5E9] pt-2.5 text-[13px] text-stone-700">{spec.foot}</div>}
    </>
  );
  if (spec.href && spec.external) {
    return (
      <a href={spec.href} target="_blank" rel="noreferrer" className={cls}>
        {body}
      </a>
    );
  }
  if (spec.href) {
    return (
      <Link href={spec.href} className={cls}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** The card grid every list uses in Cards view. */
export function CardGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 md:p-4 xl:grid-cols-3">{children}</ul>;
}

export function SimpleTable<Row>({
  cols,
  rows,
  rowKey,
  empty = "Nothing here yet.",
  view = "rows",
  card,
}: {
  cols: Col<Row>[];
  rows: Row[];
  rowKey: (row: Row, i: number) => string;
  empty?: string;
  /** "cards" shows a grid of cards (see ViewToggle) */
  view?: "rows" | "cards";
  card?: (row: Row) => SimpleCardSpec;
}) {
  if (rows.length === 0) {
    return <div className="px-4 py-10 text-center text-[13px] text-stone-500">{empty}</div>;
  }
  if (view === "cards") {
    const auto = (row: Row): SimpleCardSpec => ({
      title: cols[0]?.r(row),
      details: cols.slice(1).filter((c) => c.h).map((c) => ({ label: c.h, value: c.r(row) })),
    });
    return (
      <CardGrid>
        {rows.map((row, ri) => (
          <li key={rowKey(row, ri)} className="min-w-0">
            <SimpleCard spec={card ? card(row) : auto(row)} />
          </li>
        ))}
      </CardGrid>
    );
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

/** One card with link tabs on top (the prototype's `tabbed()` body). `right` sits at the end of the tab strip (the Rows / Cards toggle). */
export function TabbedCard({ tabs, children, right }: { tabs: CardTab[]; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white">
      {right ? (
        <div className="flex items-stretch">
          <div className="min-w-0 flex-1">
            <CardTabs tabs={tabs} />
          </div>
          <div className="flex shrink-0 items-center border-b border-stone-200 px-2 md:px-3">{right}</div>
        </div>
      ) : (
        <CardTabs tabs={tabs} />
      )}
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
