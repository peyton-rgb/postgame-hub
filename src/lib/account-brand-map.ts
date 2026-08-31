// ============================================================
// account → brand mapping.
//
// Campaigns synced from Rich's admin arrive with an `account_id` and no brand:
// the admin's accounts and the Hub's `brands` have never been linked. This
// module owns that translation table (`admin_account_map`).
//
// THE ONLY AUTOMATIC LINK IS AN EXACT NAME MATCH — lower(trim(account)) equals
// lower(trim(brand.name)) AND exactly one brand matches. Everything else waits
// for a human at /dashboard/settings/brand-mapping.
//
// Fuzzy matching is banned outright, and the live data shows why: "Cane's" vs
// "Raising Cane's", "Hey Dude" vs "Heydude", "McDonalds" vs "McDonald's",
// "Ykone - Visit Las Vegas" vs "Visit Las Vegas". Every one of those is a
// plausible guess and a guess is not good enough to stamp on a campaign.
//
// This module NEVER creates a brand. An account with no matching brand waits.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

/** How a mapping was made. Mirrors the CHECK constraint on the column. */
export type MappedBy = "auto_exact" | "human";

export interface AccountMapRow {
  admin_account_id: string;
  account_name: string | null;
  brand_id: string | null;
  mapped_by: MappedBy | null;
}

/**
 * Normalised form used on BOTH sides of every comparison.
 *
 * Trim is load-bearing, not defensive: two accounts in the live admin carry a
 * trailing space ("L'Oreal ", "Zenni ") and would otherwise never match a
 * brand. Case-folding likewise — the admin says "adidas", the Hub "Adidas".
 * Nothing else is touched; punctuation and spacing differences are exactly the
 * cases a human must decide.
 */
export function normaliseName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Brands indexed by normalised name.
 *
 * A name owned by more than one brand can never auto-link — "exactly one brand
 * matches" is part of the rule, not an implementation detail.
 */
export function indexBrandsByName(
  brands: Array<{ id: string; name: string }>,
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const brand of brands) {
    const key = normaliseName(brand.name);
    const bucket = index.get(key);
    if (bucket) bucket.push(brand.id);
    else index.set(key, [brand.id]);
  }
  return index;
}

/** The brand an account name resolves to, or null when it is not unambiguous. */
export function exactBrandFor(
  accountName: string | null | undefined,
  brandsByName: Map<string, string[]>,
): string | null {
  const key = normaliseName(accountName);
  if (!key) return null;
  const hits = brandsByName.get(key);
  return hits && hits.length === 1 ? hits[0] : null;
}

/**
 * Every mapping, keyed by admin account id.
 *
 * Read whole rather than per-campaign: the table is ~120 rows, and a sync that
 * touches 620 campaigns would otherwise issue 620 lookups.
 */
export async function loadAccountMap(
  supabase: SupabaseClient,
): Promise<Map<string, AccountMapRow>> {
  const { data, error } = await supabase
    .from("admin_account_map")
    .select("admin_account_id, account_name, brand_id, mapped_by");
  if (error) throw new Error(`admin_account_map read failed: ${error.message}`);

  const map = new Map<string, AccountMapRow>();
  for (const row of (data ?? []) as AccountMapRow[]) map.set(row.admin_account_id, row);
  return map;
}

/**
 * Record accounts the sync has seen but the map has not.
 *
 * Inserted with brand_id NULL so the human queue stays complete without anyone
 * re-running the seed. Deliberately an INSERT that ignores conflicts rather
 * than an upsert: an existing row may carry a human's mapping, and a sync must
 * never overwrite that with a null.
 */
export async function recordUnknownAccounts(
  supabase: SupabaseClient,
  accounts: Array<{ admin_account_id: string; account_name: string | null }>,
): Promise<number> {
  if (accounts.length === 0) return 0;
  const { data, error } = await supabase
    .from("admin_account_map")
    .upsert(accounts, { onConflict: "admin_account_id", ignoreDuplicates: true })
    .select("admin_account_id");
  if (error) {
    console.error("[account-map] recording unknown accounts failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}
