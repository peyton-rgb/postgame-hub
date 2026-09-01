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
// SIMILARITY IS A VETO, NEVER A LINK. isNearExistingBrand() below measures the
// same closeness the ban rejects — and uses it only to REFUSE, never to map.
// The account → brand link is still exact-only; what similarity gates is
// whether an unmatched account may be treated as a genuinely NEW brand. The
// four names above are exactly the ones that must not be, because the exact
// matcher cannot tell "new" from "already here, spelled differently".
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * How a mapping was made. Mirrors the CHECK constraint on the column.
 *
 * 'auto_exact'   — matched an existing brand a human had already vouched for.
 * 'auto_created' — the brand did not exist and the sync created it.
 * 'human'        — set at /dashboard/settings/brand-mapping.
 */
export type MappedBy = "auto_exact" | "human" | "auto_created";

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

/** Normalised, then stripped to letters and digits: "Dr. Scholl's" → "drscholls". */
function alphanumericOnly(value: string): string {
  return normaliseName(value).replace(/[^a-z0-9]/g, "");
}

/**
 * Levenshtein edit distance. Two rows rather than a full matrix — the inputs
 * are brand names, but this runs accounts × brands (120 × 131) every sync.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1, // deletion
        current[j - 1] + 1, // insertion
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Existing brands `accountName` is too close to for it to count as new, nearest
 * first.
 *
 * THIS NEVER LINKS ANYTHING. Its only caller uses a non-empty result to REFUSE
 * to create a brand and hand the account to a human instead. That asymmetry is
 * the whole design: a wrong "these are the same" would stamp a guess onto a
 * campaign, while a wrong "these might be the same" only adds a row to a queue
 * someone already reads. So the rules below are deliberately generous, and the
 * cost of a false positive is a human glance.
 *
 * Near when ANY of these holds against ANY brand, all on normalised names:
 *   1. either name contains the other  — "Cane's" ⊂ "Raising Cane's"
 *   2. equal once non-alphanumerics go — "McDonalds" = "McDonald's"
 *   3. edit distance ≤ 2 for names of 8+ characters, ≤ 1 for shorter ones
 *
 * Rule 3's budget scales with length because two edits in an eight-character
 * name is a typo and two edits in a four-character name is a different word.
 * The length taken is the SHORTER of the pair, which is the conservative read:
 * it hands the tighter budget to the case where a slip matters more.
 *
 * Rule 1 is blunt on purpose and will over-fire on very short brands — "SI"
 * is a substring of "Ykone - Vi(si)t Las Vegas". That costs one queue entry
 * and is ordered last by distance, behind the match a human actually wants.
 */
export function nearExistingBrands(
  accountName: string | null | undefined,
  brandNames: string[],
): string[] {
  const account = normaliseName(accountName);
  if (!account) return [];
  const accountAlnum = alphanumericOnly(account);

  const hits: Array<{ name: string; distance: number }> = [];
  for (const brandName of brandNames) {
    const brand = normaliseName(brandName);
    if (!brand) continue;

    // An exact match is not "near" — it is the existing-brand link, decided by
    // exactBrandFor() before this is ever consulted.
    if (brand === account) continue;

    const budget = Math.min(account.length, brand.length) >= 8 ? 2 : 1;
    const near =
      account.includes(brand) ||
      brand.includes(account) ||
      (accountAlnum.length > 0 && accountAlnum === alphanumericOnly(brand)) ||
      levenshtein(account, brand) <= budget;

    if (near) hits.push({ name: brandName, distance: levenshtein(account, brand) });
  }

  // Nearest first, so the brand a human is most likely to have meant leads the
  // queue entry even when a short-name substring also matched.
  hits.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
  return hits.map((h) => h.name);
}

/**
 * True when `accountName` is close enough to an existing brand that creating a
 * new one would risk a duplicate. See nearExistingBrands() for the rules.
 */
export function isNearExistingBrand(
  accountName: string | null | undefined,
  brandNames: string[],
): boolean {
  return nearExistingBrands(accountName, brandNames).length > 0;
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
