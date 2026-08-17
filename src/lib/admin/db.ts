// ============================================================
// Migration-aware query helpers for /admin.
//
// Six migrations (022–027) are written but UNAPPLIED tonight. Code
// paths that read their columns/tables must degrade to an honest
// "pending migration" state instead of crashing. `safeQuery` runs a
// query and reports { pending: true } when the failure is a missing
// column/table — anything else is a real error and is surfaced.
// ============================================================

import { isMissingSchemaError } from "@/lib/admin/auth";

export interface SafeResult<T> {
  data: T | null;
  /** true = the schema this feature needs hasn't been migrated yet */
  pending: boolean;
  error: string | null;
}

export async function safeQuery<T>(
  run: () => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>
): Promise<SafeResult<T>> {
  try {
    const { data, error } = await run();
    if (!error) return { data, pending: false, error: null };
    if (isMissingSchemaError(error)) return { data: null, pending: true, error: null };
    return { data: null, pending: false, error: error.message ?? "query failed" };
  } catch (err) {
    return {
      data: null,
      pending: false,
      error: err instanceof Error ? err.message : "query failed",
    };
  }
}

/** Format cents as $1,234.56 (payouts store amount_cents). */
export function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Format a date as MM/DD/YYYY (the CF admin's format, kept for muscle memory). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

export const PAGE_SIZE = 50;

export function pageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}

/**
 * Strip characters that carry meaning inside a PostgREST filter string
 * (same rule as /api/people — commas separate .or() terms, parens group,
 * % is the ilike wildcard).
 */
export function sanitizeFilterValue(raw: string): string {
  return raw.replace(/[%,()\\*]/g, "").trim();
}
