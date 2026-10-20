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
import { initialsOf } from "@/lib/admin/athletes";

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
