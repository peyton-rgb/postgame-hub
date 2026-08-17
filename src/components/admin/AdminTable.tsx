// ============================================================
// AdminTable — CF-style list table: ID first, name as orange link,
// account inline. Desktop: real <table>. Mobile: rows collapse to
// compact cards (title, subtitle, a status strip, and a right-side
// figure — usually money or a count).
//
// Server-safe: pages pass column definitions with render callbacks
// during the same server render pass. Rows with `warn: true` get the
// faint warm tint (the "setup gap" treatment).
// ============================================================

import Link from "next/link";
import { EmptyRows } from "@/components/admin/ui";

export interface AdminColumn<Row> {
  key: string;
  header: React.ReactNode;
  render: (row: Row) => React.ReactNode;
  align?: "left" | "right" | "center";
  /** hide on narrow desktop widths */
  secondary?: boolean;
}

export interface MobileCardSpec<Row> {
  title: (row: Row) => React.ReactNode;
  href?: (row: Row) => string | null;
  subtitle?: (row: Row) => React.ReactNode;
  strip?: (row: Row) => React.ReactNode;
  figure?: (row: Row) => React.ReactNode;
}

export default function AdminTable<Row>({
  rows,
  columns,
  rowKey,
  mobile,
  rowWarn,
  emptyLabel = "No rows.",
}: {
  rows: Row[];
  columns: AdminColumn<Row>[];
  rowKey: (row: Row) => string;
  mobile: MobileCardSpec<Row>;
  rowWarn?: (row: Row) => boolean;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white">
        <EmptyRows label={emptyLabel} />
      </div>
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={
                    "px-3 py-2.5 font-semibold " +
                    (c.align === "right" ? "text-right " : c.align === "center" ? "text-center " : "") +
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
              <tr
                key={rowKey(row)}
                className={
                  "border-b border-stone-100 last:border-0 " +
                  (rowWarn?.(row) ? "bg-orange-50/60" : "hover:bg-stone-50")
                }
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={
                      "px-3 py-2.5 align-middle " +
                      (c.align === "right"
                        ? "text-right tabular-nums "
                        : c.align === "center"
                          ? "text-center "
                          : "") +
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

      {/* Mobile cards */}
      <ul className="md:hidden space-y-2">
        {rows.map((row) => {
          const href = mobile.href?.(row) ?? null;
          const body = (
            <div
              className={
                "rounded-lg border border-stone-200 bg-white p-3 " +
                (rowWarn?.(row) ? "bg-orange-50/60" : "")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium text-stone-900">
                    {mobile.title(row)}
                  </div>
                  {mobile.subtitle && (
                    <div className="mt-0.5 truncate text-[12px] text-stone-500">
                      {mobile.subtitle(row)}
                    </div>
                  )}
                </div>
                {mobile.figure && (
                  <div className="shrink-0 text-right text-[13px] font-medium tabular-nums text-stone-900">
                    {mobile.figure(row)}
                  </div>
                )}
              </div>
              {mobile.strip && (
                <div className="mt-2 flex items-center gap-2 text-[12px]">{mobile.strip(row)}</div>
              )}
            </div>
          );
          return (
            <li key={rowKey(row)}>{href ? <Link href={href}>{body}</Link> : body}</li>
          );
        })}
      </ul>
    </div>
  );
}

/** The CF-style orange name link. */
export function NameLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-[#D73F09] hover:underline">
      {children}
    </Link>
  );
}
