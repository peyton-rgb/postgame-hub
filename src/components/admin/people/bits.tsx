// ============================================================
// Pieces shared by the People screens (/admin/athletes, audiences,
// rosters, invites, team, roles): the stat tile row, the tab strip,
// the GET toolbar (search + selects), the avatar-initials "who"
// cell, the card foot and the info note. Server-safe.
//
// The prototype's `tiles` / `card({tabs, toolbar, foot})` / `hubNote`
// helpers, done as components. Everything is a plain link or a GET
// form so the pages stay server components.
// ============================================================

import Link from "next/link";
import { ATHLETE_LEVELS, initialsOf, isInfluencer, levelOf } from "@/lib/admin/athletes";

export function Tiles({
  items,
}: {
  items: Array<{ n: string; l: string; flag?: boolean; href?: string }>;
}) {
  const cols = items.length >= 5 ? "lg:grid-cols-5" : items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <div className={"grid grid-cols-2 gap-3 pb-4 " + cols}>
      {items.map((t) => {
        const inner = (
          <div className="h-full rounded-lg border border-stone-200 bg-white p-3.5">
            <div className="text-[22px] font-semibold leading-tight text-stone-900 tabular-nums">{t.n}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-stone-500">
              {t.flag && <i className="inline-block h-2 w-2 rounded-full bg-[#D73F09]" title="Needs attention" />}
              {t.l}
            </div>
          </div>
        );
        return t.href ? (
          <Link key={t.l} href={t.href} className="block">
            {inner}
          </Link>
        ) : (
          <div key={t.l}>{inner}</div>
        );
      })}
    </div>
  );
}

export function TabStrip({
  tabs,
  current,
}: {
  tabs: Array<{ key: string; label: string; href: string; count?: string | number | null }>;
  current: string;
}) {
  return (
    <div className="flex gap-0.5 overflow-x-auto border-b border-stone-200 px-3" role="tablist">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={current === t.key}
          className={
            "whitespace-nowrap border-b-2 px-2.5 pb-2 pt-3 text-[13px] font-medium " +
            (current === t.key ? "border-[#D73F09] text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800")
          }
        >
          {t.label}
          {t.count != null && (
            <span className="ml-1 rounded-full bg-stone-100 px-1.5 text-[11px] text-stone-500 tabular-nums">{t.count}</span>
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
  options: Array<{ value: string; label: string }>;
}

/**
 * Search + selects as one GET form. Hidden fields carry the tab and any
 * other params that should survive a new search.
 */
export function Toolbar({
  action,
  placeholder,
  q,
  selects = [],
  hidden = {},
  datalist,
  right,
}: {
  action: string;
  placeholder: string;
  q: string;
  selects?: ToolbarSelect[];
  hidden?: Record<string, string | undefined>;
  /** a free-text field with suggestions (used for schools) */
  datalist?: { name: string; label: string; value: string; options: string[]; placeholder: string };
  right?: React.ReactNode;
}) {
  const selectCls = "h-[34px] max-w-[200px] rounded-md border border-stone-300 bg-white px-2 text-[13px] text-stone-700";
  return (
    <form
      action={action}
      method="get"
      className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2.5 md:px-4"
    >
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-[34px] w-full min-w-0 flex-1 rounded-md border border-stone-300 px-3 text-[13px] sm:max-w-xs"
      />
      {datalist && (
        <>
          <input
            list={`dl-${datalist.name}`}
            name={datalist.name}
            defaultValue={datalist.value}
            placeholder={datalist.placeholder}
            aria-label={datalist.label}
            className={selectCls + " w-[180px]"}
          />
          <datalist id={`dl-${datalist.name}`}>
            {datalist.options.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </>
      )}
      {selects.map((s) => (
        <select key={s.name} name={s.name} defaultValue={s.value} aria-label={s.label} className={selectCls}>
          <option value="">{s.label}</option>
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      <button
        type="submit"
        className="h-[34px] rounded-md border border-stone-300 bg-white px-3 text-[13px] font-medium text-stone-700 hover:border-stone-400"
      >
        Apply
      </button>
      {right && <div className="flex items-center gap-2 sm:ml-auto">{right}</div>}
    </form>
  );
}

export function CardFoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-2.5 text-[12px] text-stone-500 md:px-5">
      {children}
    </div>
  );
}

/** The prototype's `.hub-note`: an info line under a card. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex gap-2.5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[13px] leading-relaxed text-stone-600">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0 text-stone-400">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

export function Avatar({ name, size = 30 }: { name: string | null; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-stone-200 text-[11px] font-semibold text-stone-600"
      style={{ width: size, height: size }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Avatar initials + name + a dim second line (handle, email, school). */
export function Who({ name, sub, href }: { name: string | null; sub?: string | null; href?: string }) {
  const label = name || "—";
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={name} />
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="block truncate font-medium text-stone-900 hover:underline">
            {label}
          </Link>
        ) : (
          <div className="truncate font-medium text-stone-900">{label}</div>
        )}
        {sub && <div className="truncate text-[12px] text-stone-500">{sub}</div>}
      </div>
    </div>
  );
}

export function handleText(h: string | null | undefined): string | null {
  return h ? `@${h.replace(/^@/, "")}` : null;
}

/** Secondary button-as-link, matching bits.tsx `Btn` but for `<a>` to non-page URLs too. */
export function LinkBtn({
  href,
  children,
  primary = false,
  small = false,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  small?: boolean;
  external?: boolean;
}) {
  const cls =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium " +
    (small ? "px-2.5 py-1 text-[12px] " : "px-3 py-1.5 text-[13px] ") +
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

// ------------------------------------------------------------
// Level + app pills (the prototype's levelPill / appPill). Status
// colours only where they carry meaning; the influencer tag uses the
// accent rather than a new hue (palette rule).
// ------------------------------------------------------------

const PILL = "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ";

export function LevelPill({
  row,
}: {
  row: { person_type: string | null; roster_status: string | null; instagram_followers: number | null };
}) {
  if (isInfluencer(row)) return <span className={PILL + "bg-[#D73F09]/10 text-[#D73F09]"}>Influencer</span>;
  const l = levelOf(row);
  const label = ATHLETE_LEVELS.find((x) => x.key === l)?.short ?? l;
  const tone =
    l === "pro" ? "bg-status-ok/10 text-status-ok" : l === "high_school" ? "bg-stone-200 text-stone-700" : "bg-stone-100 text-stone-600";
  return <span className={PILL + tone}>{label}</span>;
}

/** On the Postgame app = a device on the ColdFusion user record. Shows the device. */
export function AppPill({ device }: { device: string | null }) {
  if (!device) return <span className="text-[12px] text-stone-400">Not yet</span>;
  const d = /^ip(hone|ad)$/i.test(device) ? (device.toLowerCase() === "ipad" ? "iPad" : "iPhone") : device;
  return <span className={PILL + "bg-status-ok/10 text-status-ok"}>On the app · {d}</span>;
}

export const fmtCount = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));
export const fmtUsd = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Breadcrumb line above a detail page's title (the prototype's `.crumb`). */
export function Crumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-1 text-[12px] text-stone-500">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-stone-300">/</span>}
          {it.href ? (
            <Link href={it.href} className="hover:text-stone-800 hover:underline">
              {it.label}
            </Link>
          ) : (
            <span>{it.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

/** Label / value rows inside a card (details panels). */
export function Facts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="divide-y divide-stone-100 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 py-2">
          <dt className="shrink-0 text-stone-500">{k}</dt>
          <dd className="min-w-0 text-right text-stone-900">{v ?? <span className="text-stone-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Big person header: avatar, name, a sub line and pills. */
export function PersonHead({
  name,
  sub,
  pills,
  actions,
  crumb,
}: {
  name: string;
  sub?: React.ReactNode;
  pills?: React.ReactNode;
  actions?: React.ReactNode;
  crumb?: React.ReactNode;
}) {
  return (
    <div className="pb-5">
      {crumb}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} size={48} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-stone-900">{name}</h1>
            {sub && <div className="mt-0.5 text-[13px] text-stone-500">{sub}</div>}
            {pills && <div className="mt-1.5 flex flex-wrap gap-1.5">{pills}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
