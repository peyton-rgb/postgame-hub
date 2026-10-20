// ============================================================
// Small server-safe pieces for the Content screens: the white card,
// the status pill (prototype .pill / .pill.ok / .pill.warn), the
// segmented link control (prototype .seg), and the scrolling table
// wrapper so wide tables never push the page sideways at 375px.
// ============================================================

import Link from "next/link";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={"overflow-hidden rounded-xl border border-stone-200 bg-white " + className}>{children}</section>
  );
}

export type PillTone = "ok" | "warn" | "bad" | "info" | "muted" | "accent";

export function Pill({ tone = "muted", children }: { tone?: PillTone; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-status-ok/10 text-status-ok"
      : tone === "warn"
        ? "bg-status-warn/10 text-status-warn"
        : tone === "bad"
          ? "bg-status-bad/10 text-status-bad"
          : tone === "accent"
            ? "bg-[#D73F09]/10 text-[#D73F09]"
            : tone === "info"
              ? "bg-stone-900/5 text-stone-700"
              : "bg-stone-100 text-stone-500";
  return (
    <span className={"inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium " + cls}>
      {children}
    </span>
  );
}

export interface SegItem {
  href: string;
  label: string;
  count?: number | null;
  active: boolean;
}

/** The prototype's segmented control, as links (bookmarkable, no client state). */
export function SegLinks({ items }: { items: SegItem[] }) {
  return (
    <div role="tablist" className="inline-flex max-w-full overflow-x-auto rounded-lg border border-stone-200 bg-stone-100 p-0.5">
      {items.map((i) => (
        <Link
          key={i.href + i.label}
          href={i.href}
          role="tab"
          aria-selected={i.active}
          className={
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium " +
            (i.active ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800")
          }
        >
          {i.label}
          {i.count != null && <span className="text-[11px] tabular-nums text-stone-400">{i.count.toLocaleString()}</span>}
        </Link>
      ))}
    </div>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">{children}</table>
    </div>
  );
}

export function Th({ children, right = false }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={
        "whitespace-nowrap border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-[12px] font-medium text-stone-500 " +
        (right ? "text-right" : "text-left")
      }
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right = false,
  className = "",
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td className={"border-b border-stone-100 px-4 py-3 align-middle " + (right ? "text-right " : "") + className}>
      {children}
    </td>
  );
}

export function BtnLink({
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
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-medium " +
    (primary
      ? "bg-[#D73F09] text-white hover:bg-[#c23808]"
      : "border border-stone-300 bg-white text-stone-700 hover:border-stone-400");
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/** Note shown where a screen opens an existing Hub editor instead of rebuilding it. */
export function EditorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-[13px] text-stone-600">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-stone-400">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v4h1" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

export function Crumb({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-1 inline-flex items-center gap-1 text-[12px] text-stone-500 hover:text-stone-800">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </Link>
  );
}
