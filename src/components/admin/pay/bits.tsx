// ============================================================
// Pay-suite pieces shared by the five payment screens: the stat
// tiles row, link tabs that sit at the top of a card, the search /
// filter toolbar (a plain GET form — server-rendered, no client JS),
// a table that collapses to cards on phones WITHOUT wrapping rows in
// a link (so the confirmed-POST forms inside a row stay valid HTML),
// the athlete / campaign cells, and the status + method pills.
//
// Server-safe: no hooks. Pills reuse the campaign bits' tones.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Pill, type Tone } from "@/components/admin/campaign/bits";
import { BrandMark } from "@/components/admin/brand-bits";
import { EmptyRows } from "@/components/admin/ui";

// ------------------------------------------------------------
// Tiles
// ------------------------------------------------------------

export interface TileSpec {
  n: string;
  label: string;
  /** small second line under the label — the honest "why" when n is "—" */
  sub?: string;
  href?: string;
  /** needs attention — orange dot before the label */
  flag?: boolean;
}

export function Tiles({ items }: { items: TileSpec[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
      {items.map((t) => {
        const body = (
          <>
            <span className="text-2xl font-semibold text-stone-900 tabular-nums">{t.n}</span>
            <span className="flex items-center gap-1.5 text-[12px] text-stone-500">
              {t.flag && <i className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#D73F09]" title="Needs attention" />}
              <span className="truncate">{t.label}</span>
            </span>
            {t.sub && <span className="text-[11px] leading-4 text-stone-400">{t.sub}</span>}
          </>
        );
        const cls = "flex min-w-0 flex-col gap-0.5 rounded-xl border border-stone-200 bg-white px-3.5 py-3";
        return t.href ? (
          <Link key={t.label} href={t.href} className={cls + " hover:border-stone-400"}>
            {body}
          </Link>
        ) : (
          <div key={t.label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------
// Card tabs (links, so the active tab survives a refresh)
// ------------------------------------------------------------

export interface TabSpec {
  key: string;
  label: string;
  href: string;
  count?: number | null;
  /** show the count pill even when count is null (renders "—") */
  showCount?: boolean;
}

export function CardTabs({ tabs, active }: { tabs: TabSpec[]; active: string }) {
  return (
    <div className="flex gap-0.5 overflow-x-auto border-b border-stone-200 px-3" role="tablist">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={active === t.key}
          className={
            "whitespace-nowrap border-b-2 px-2.5 pb-2 pt-3 text-[13px] font-medium " +
            (active === t.key ? "border-[#D73F09] text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800")
          }
        >
          {t.label}
          {(t.showCount || t.count != null) && (
            <span className="ml-1 rounded-full bg-stone-100 px-1.5 text-[11px] text-stone-500 tabular-nums">
              {t.count == null ? "—" : t.count.toLocaleString()}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// Toolbar — GET form. Hidden fields keep the current tab/filters.
// ------------------------------------------------------------

export interface SelectSpec {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
}

export function Toolbar({
  action,
  hidden = {},
  search,
  selects = [],
  right,
}: {
  action: string;
  hidden?: Record<string, string | undefined>;
  search?: { name: string; value: string; placeholder: string };
  selects?: SelectSpec[];
  right?: React.ReactNode;
}) {
  const field = "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-900";
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2.5 md:px-4">
      <form action={action} method="get" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        {search && (
          <label className="flex min-w-0 flex-1 items-center gap-1.5 sm:max-w-xs">
            <span className="sr-only">{search.placeholder}</span>
            <input
              type="search"
              name={search.name}
              defaultValue={search.value}
              placeholder={search.placeholder}
              className={field + " w-full"}
            />
          </label>
        )}
        {selects.map((s) => (
          <select key={s.name} name={s.name} defaultValue={s.value} aria-label={s.ariaLabel} className={field}>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        <button type="submit" className="rounded-md border border-stone-300 px-2.5 py-1.5 text-[12px] font-medium text-stone-700 hover:border-stone-400">
          Apply
        </button>
      </form>
      {right && <div className="flex flex-wrap items-center gap-1.5 md:ml-auto">{right}</div>}
    </div>
  );
}

// ------------------------------------------------------------
// Table that collapses to cards on phones. Rows are never wrapped
// in a link, so forms (confirmed POST buttons) can live in a cell.
// ------------------------------------------------------------

export interface PayColumn<Row> {
  key: string;
  header: React.ReactNode;
  render: (row: Row) => React.ReactNode;
  align?: "left" | "right";
  /** hide below lg (desktop only) */
  secondary?: boolean;
}

export function PayTable<Row>({
  rows,
  columns,
  rowKey,
  mobile,
  emptyLabel,
}: {
  rows: Row[];
  columns: PayColumn<Row>[];
  rowKey: (row: Row) => string;
  /** the phone card for one row */
  mobile: (row: Row) => React.ReactNode;
  emptyLabel: string;
}) {
  if (rows.length === 0) return <EmptyRows label={emptyLabel} />;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={
                    "px-4 py-2.5 font-semibold " +
                    (c.align === "right" ? "text-right " : "") +
                    (c.secondary ? "hidden lg:table-cell" : "")
                  }
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={
                      "px-4 py-2.5 align-middle " +
                      (c.align === "right" ? "text-right tabular-nums " : "") +
                      (c.secondary ? "hidden lg:table-cell" : "")
                    }
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-stone-100 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="px-4 py-3">
            {mobile(row)}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Phone card layout: who/what on the left, figure on the right, actions below. */
export function MobileRow({
  top,
  figure,
  strip,
  actions,
}: {
  top: React.ReactNode;
  figure?: React.ReactNode;
  strip?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{top}</div>
        {figure && <div className="shrink-0 text-right text-[14px] font-semibold tabular-nums text-stone-900">{figure}</div>}
      </div>
      {strip && <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-stone-500">{strip}</div>}
      {actions && <div className="mt-2.5 flex flex-wrap gap-1.5">{actions}</div>}
    </div>
  );
}

// ------------------------------------------------------------
// Cells
// ------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "—";
}

/** Avatar + name (+ handle). The avatar is the profile picture when there is one, initials otherwise. */
export function AthleteCell({
  name,
  handle,
  pic,
  href,
}: {
  name: string;
  handle?: string | null;
  pic?: string | null;
  href?: string;
}) {
  const nameNode = href ? (
    <Link href={href} className="truncate font-medium text-stone-900 hover:underline">
      {name}
    </Link>
  ) : (
    <div className="truncate font-medium text-stone-900">{name}</div>
  );
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {pic ? (
        <img src={pic} alt="" className="h-[30px] w-[30px] shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-stone-200 text-[11px] font-semibold text-stone-600">
          {initials(name)}
        </span>
      )}
      <div className="min-w-0">
        {nameNode}
        {handle && <div className="truncate text-[12px] text-stone-500">@{handle.replace(/^@/, "")}</div>}
      </div>
    </div>
  );
}

/** Brand mark (logo file from the brands row, or an empty tile) + campaign title. */
export function CampaignCell({
  title,
  brandName,
  brandLogo,
}: {
  title: string | null;
  brandName: string | null;
  brandLogo: string | null;
}) {
  if (!title && !brandName) return <span className="text-stone-400">—</span>;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <BrandMark src={brandLogo} name={brandName} size={26} />
      <div className="min-w-0">
        <div className="truncate text-stone-900">{title ?? "—"}</div>
        {brandName && <div className="truncate text-[11px] text-stone-500">{brandName}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Pills
// ------------------------------------------------------------

const METHOD_LABEL: Record<string, string> = {
  paypal: "PayPal",
  venmo: "Venmo",
  zelle: "Zelle",
  ach: "ACH",
  wire: "Wire",
  check: "Check",
};

export function methodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return METHOD_LABEL[method.toLowerCase()] ?? method;
}

export function MethodPill({ method }: { method: string | null | undefined }) {
  if (!method) return <span className="text-stone-400">—</span>;
  return <Pill tone="info">{methodLabel(method)}</Pill>;
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warn" },
  processing: { label: "Processing", tone: "info" },
  paid: { label: "Paid", tone: "ok" },
  failed: { label: "Failed", tone: "bad" },
  denied: { label: "Denied", tone: "muted" },
  removed: { label: "Removed", tone: "muted" },
};

export function StatusPill({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-stone-400">—</span>;
  const s = STATUS[status] ?? { label: status, tone: "muted" as Tone };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

// ------------------------------------------------------------
// Notes
// ------------------------------------------------------------

export function ResultNote({ tone, children }: { tone: "ok" | "warn" | "err"; children: React.ReactNode }) {
  return (
    <div
      className={
        "mb-4 rounded-lg border px-4 py-3 text-[13px] " +
        (tone === "ok"
          ? "border-status-ok bg-green-50 text-status-ok"
          : tone === "warn"
            ? "border-status-warn bg-amber-50 text-status-warn"
            : "border-status-bad bg-red-50 text-status-bad")
      }
    >
      {children}
    </div>
  );
}

/** The honest empty state for an 083 table that isn't applied yet. Sits inside a card. */
export function Pending083({ feature }: { feature: string }) {
  return (
    <div className="px-4 py-8 text-center text-[13px] text-stone-500">
      <div className="font-medium text-stone-700">{feature} arrive with migration 083.</div>
      <div className="mt-1">
        <code className="rounded bg-stone-100 px-1">20261019_083_blended_admin_schema.sql</code> is written but not applied, so
        there is nothing real to show here yet. No placeholder rows on purpose.
      </div>
    </div>
  );
}

export function Btn({
  href,
  children,
  primary = false,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  external?: boolean;
}) {
  const cls =
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium " +
    (primary ? "bg-[#D73F09] text-white hover:bg-[#B33407]" : "border border-stone-300 bg-white text-stone-700 hover:border-stone-400");
  return external ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
