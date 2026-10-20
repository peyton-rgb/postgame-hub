// ============================================================
// Shared pieces for the ops screens (content, feed, requests, data
// tools, instagram, schools, settings): in-card link tabs with counts,
// a GET toolbar (search + selects), the card footer line, the grid of
// stat tiles with a "needs attention" flag, and the campaign cell
// (brand mark from the brands row + name + brand). Server-safe.
// ============================================================

import Link from "next/link";
import { BrandMark } from "@/components/admin/brand-bits";
import AutoSubmitSelect from "@/components/admin/AutoSubmitSelect";

export interface CardTab {
  href: string;
  label: string;
  count?: number | string | null;
  active: boolean;
}

/** The prototype's in-card tab strip: each tab is its own link so it can be bookmarked. */
export function CardTabs({ tabs }: { tabs: CardTab[] }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-stone-200 px-2 pt-1">
      {tabs.map((t) => (
        <Link
          key={t.href + t.label}
          href={t.href}
          role="tab"
          aria-selected={t.active}
          className={
            "-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium " +
            (t.active
              ? "border-[#D73F09] text-stone-900"
              : "border-transparent text-stone-500 hover:text-stone-800")
          }
        >
          {t.label}
          {t.count != null && (
            <span
              className={
                "rounded-full px-1.5 py-px text-[11px] tabular-nums " +
                (t.active ? "bg-[#D73F09]/10 text-[#D73F09]" : "bg-stone-100 text-stone-500")
              }
            >
              {typeof t.count === "number" ? t.count.toLocaleString() : t.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export interface ToolbarSelect {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

/**
 * GET toolbar: a search box, selects that submit on change, and hidden
 * fields so the current tab/filters survive a new search.
 */
export function Toolbar({
  action,
  placeholder,
  q,
  selects = [],
  hidden = {},
  right,
}: {
  action: string;
  placeholder: string;
  q?: string;
  selects?: ToolbarSelect[];
  hidden?: Record<string, string | undefined>;
  right?: React.ReactNode;
}) {
  return (
    <form
      action={action}
      method="GET"
      className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2.5"
    >
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-500">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full bg-transparent text-stone-900 outline-none placeholder:text-stone-400"
        />
      </label>
      {selects.map((s) => (
        <AutoSubmitSelect key={s.name} name={s.name} label={s.label} value={s.value} options={s.options} />
      ))}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </form>
  );
}

export function CardFoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 px-4 py-2.5 text-[12px] text-stone-500">
      {children}
    </div>
  );
}

export interface Tile {
  n: string;
  l: string;
  flag?: boolean;
  href?: string;
}

/** The prototype's stat tiles. `flag` draws the orange "needs attention" dot. */
export function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => {
        const inner = (
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-2xl font-semibold tabular-nums text-stone-900">{t.n}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] uppercase tracking-wide text-stone-500">
              {t.flag && <i className="inline-block h-2 w-2 rounded-full bg-[#D73F09]" title="Needs attention" />}
              {t.l}
            </div>
          </div>
        );
        return t.href ? (
          <Link key={t.l} href={t.href}>
            {inner}
          </Link>
        ) : (
          <div key={t.l}>{inner}</div>
        );
      })}
    </div>
  );
}

/** Campaign cell: brand mark (from the brands row — never text) + campaign name + brand name. */
export function CampCell({
  name,
  brandName,
  logo,
  href,
}: {
  name: string;
  brandName: string | null;
  logo: string | null;
  href?: string;
}) {
  const title = href ? (
    <Link href={href} className="truncate font-medium text-stone-900 hover:underline">
      {name}
    </Link>
  ) : (
    <div className="truncate font-medium text-stone-900">{name}</div>
  );
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandMark src={logo} name={brandName} />
      <div className="min-w-0">
        {title}
        <div className="truncate text-[12px] text-stone-500">{brandName ?? "No brand"}</div>
      </div>
    </div>
  );
}

/** Thin green progress bar (the prototype's posting progress column). */
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-[120px] max-w-full overflow-hidden rounded-full bg-stone-100" title={`${pct}%`}>
      <div className="h-full rounded-full bg-status-ok" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Honest note when a screen's table is not in the database yet. */
export function TablePending({ table, feature, migration = "083" }: { table: string; feature: string; migration?: string }) {
  return (
    <div className="px-4 py-10 text-center text-[13px] text-stone-500">
      <div className="font-medium text-stone-700">{feature}</div>
      <div className="mt-1">
        Nothing to show yet: the <code className="rounded bg-stone-100 px-1">{table}</code> table arrives with
        migration {migration}, which is written but not applied. No placeholder rows are shown on purpose.
      </div>
    </div>
  );
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "—";
  return name
    .replace(/^@/, "")
    .split(/[\s._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

export function Avatar({ name }: { name: string | null | undefined }) {
  return (
    <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-stone-200 text-[11px] font-semibold text-stone-600">
      {initialsOf(name)}
    </span>
  );
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
