/**
 * admin-campaigns — read the pstgm admin campaign cache (source of truth for
 * campaign id ↔ name ↔ brand) and provide the fuzzy matchers the recap-intake
 * pipeline uses for validation, brand resolution, and duplicate detection.
 *
 * Data lives in the `admin_campaigns` Supabase table (seeded from a CSV export;
 * a scheduled live sync can repopulate it later without touching this code).
 *
 * All fuzzy matching is deliberately punctuation/case/whitespace-insensitive:
 * admin brand strings diverge from Hub brand names ("adidas"→"Adidas",
 * "McDonalds"→"McDonald's", "Cane's"→"Raising Cane's", "Hey Dude"→"Heydude").
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminCampaign {
  admin_id: number;
  name: string;
  brand: string | null;
  status: string | null;
}

// ── Normalization ─────────────────────────────────────────────────────────────

/** Aggressive normalize: lowercase, strip every non-alphanumeric (incl. spaces).
 *  "Dr. Scholl's" → "drscholls", "Hey Dude" → "heydude", "McDonalds" → "mcdonalds". */
export function normLoose(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

/** Word normalize: lowercase, punctuation → spaces, collapse. "Alabama + Georgia"
 *  and "Alabama & Georgia" both → "alabama georgia". */
export function normWords(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Two names "relate" if equal-normalized, or one contains the other (guarded by
 *  a minimum length so short tokens don't over-match). */
export function namesRelate(a: string, b: string, minLen = 5): boolean {
  const na = normLoose(a);
  const nb = normLoose(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= minLen && nb.length >= minLen && (na.includes(nb) || nb.includes(na))) return true;
  return false;
}

// ── Cache access ──────────────────────────────────────────────────────────────

/** Look up one admin campaign by id. Non-integer id → null. */
export async function getAdminCampaign(
  supabase: SupabaseClient,
  campaignId: string | number | undefined,
): Promise<AdminCampaign | null> {
  const idNum = typeof campaignId === "number" ? campaignId : parseInt(String(campaignId ?? "").trim(), 10);
  if (!Number.isInteger(idNum)) return null;
  const { data } = await supabase
    .from("admin_campaigns")
    .select("admin_id, name, brand, status")
    .eq("admin_id", idNum)
    .maybeSingle();
  return (data as AdminCampaign) || null;
}

// ── Brand matching (pure, over a preloaded brand list) ────────────────────────

export interface BrandRow {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface BrandMatch {
  matched: boolean;
  brand_id: string | null;
  client_name: string;
  brand_logo_url: string;
  confidence?: "exact" | "fuzzy";
  candidates?: { id: string; name: string }[];
  note?: string;
}

/**
 * Match a brand string to a Hub brand row. Exact normalized match first, then
 * substring-either-direction (min length 4). No confident match → not matched.
 */
export function matchBrandInList(brands: BrandRow[], brandText: string | null | undefined): BrandMatch {
  const raw = (brandText ?? "").trim();
  if (!raw) return { matched: false, brand_id: null, client_name: "", brand_logo_url: "", note: "empty brand" };

  const t = normLoose(raw);
  let confidence: "exact" | "fuzzy" = "exact";
  let hits = brands.filter((b) => normLoose(b.name) === t);

  if (hits.length === 0) {
    confidence = "fuzzy";
    hits = brands.filter((b) => {
      const n = normLoose(b.name);
      return n.length >= 4 && t.length >= 4 && (n.includes(t) || t.includes(n));
    });
  }

  if (hits.length === 0) {
    return { matched: false, brand_id: null, client_name: raw, brand_logo_url: "", note: "no brand match" };
  }

  // Prefer the candidate whose normalized length is closest to the target.
  hits.sort((a, b) => Math.abs(normLoose(a.name).length - t.length) - Math.abs(normLoose(b.name).length - t.length));
  const chosen = hits[0];
  return {
    matched: true,
    brand_id: chosen.id,
    client_name: chosen.name,
    brand_logo_url: chosen.logo_url || "",
    confidence,
    ...(hits.length > 1
      ? { candidates: hits.map((h) => ({ id: h.id, name: h.name })), note: `multiple ${confidence} brand matches` }
      : {}),
  };
}

// ── Fuzzy existing-recap detection (pure) ─────────────────────────────────────

export interface RecapRow {
  id: string;
  name: string;
  slug: string;
  client_name: string;
  admin_campaign_id: string | null;
}

/**
 * Find a recap that likely already covers this campaign under a DIFFERENT id or
 * none — matched on normalized name + brand. Conservative by design: a hit means
 * "flag for a human", not "definitely a dup".
 */
export function findFuzzyExistingRecap(
  recaps: RecapRow[],
  name: string,
  brand: string | null | undefined,
): RecapRow | null {
  const tb = normLoose(brand);
  for (const r of recaps) {
    if (!namesRelate(r.name, name)) continue;
    const rb = normLoose(r.client_name);
    // Require the brands to relate too (unless we have no brand signal at all).
    const brandOk = !tb || !rb || rb === tb || rb.includes(tb) || tb.includes(rb);
    if (brandOk) return r;
  }
  return null;
}

/** Build the set of known brand names (Hub brands ∪ admin brands), normalized,
 *  for the "campaign name is actually a brand" safety brake. */
export function knownBrandSet(brandNames: (string | null)[], adminBrands: (string | null)[]): Set<string> {
  const set = new Set<string>();
  for (const n of [...brandNames, ...adminBrands]) {
    const k = normLoose(n);
    if (k) set.add(k);
  }
  return set;
}
