// ============================================================
// The admin → Hub Drive handoff, as rules rather than as routes.
//
// Brief 15. The admin owns where campaign-level folders and trackers ARE; the
// Hub caches those ids so submission forms, the recap and the content browser
// can reach them without waiting for a nightly sweep.
//
// Pure and import-free so `npm test` can load it. Every decision the endpoints
// make — what to write, what to refuse, what to queue — is made here, so the
// contract can be tested without a database, a secret, or Drive.
//
// THE RULE THIS FILE EXISTS FOR: a non-null id is never silently replaced.
//
// Two provisioning runs against one brand would otherwise leave the Hub
// pointing at the second root while every athlete folder, contract and invoice
// sits under the first — and nothing would say so. Content would be filed into
// a tree nobody looks at. So a conflicting id is a 409 carrying BOTH values,
// and a human decides which is real. Writing the new one and logging a warning
// is not an option: that is the silent-overwrite shape this codebase has spent
// the week paying down.
// ============================================================

/** A Drive id the admin is handing over, keyed by the column it lands in. */
export type IdPatch = Record<string, string | null | undefined>;

export type Conflict = {
  field: string;
  /** What the Hub already holds. */
  existing: string;
  /** What the admin just sent. */
  incoming: string;
};

export type MergeResult =
  | { ok: true; patch: Record<string, string>; unchanged: string[]; conflicts: [] }
  | { ok: false; conflicts: Conflict[]; patch: Record<string, string>; unchanged: string[] };

/**
 * Decide what to write, given what is already stored.
 *
 *   stored null/empty  + incoming value  -> write it
 *   stored === incoming                  -> unchanged (this is idempotency)
 *   stored !== incoming, both present    -> CONFLICT, write nothing
 *   incoming null/absent                 -> ignored entirely
 *
 * An absent field is not an instruction to clear one. The admin sends what it
 * provisioned; a field it omits is a field it has no opinion about, and the
 * Hub's existing value stands.
 */
export function mergeIds(
  stored: Record<string, unknown>,
  incoming: IdPatch,
): MergeResult {
  const patch: Record<string, string> = {};
  const unchanged: string[] = [];
  const conflicts: Conflict[] = [];

  for (const [field, raw] of Object.entries(incoming)) {
    if (raw === null || raw === undefined) continue;
    const value = String(raw).trim();
    if (value === "") continue;

    const current = stored[field];
    const currentValue = current === null || current === undefined ? "" : String(current).trim();

    if (currentValue === "") {
      patch[field] = value;
    } else if (currentValue === value) {
      unchanged.push(field);
    } else {
      conflicts.push({ field, existing: currentValue, incoming: value });
    }
  }

  // All or nothing. On a conflict the patch is returned EMPTY, even for fields
  // that were individually writable: a half-applied handoff leaves the Hub in a
  // state neither side believes in, and an `ok: false` result carrying a usable
  // patch is an invitation for some future caller to write it anyway. The
  // refusal is enforced in the data, not by convention.
  return conflicts.length > 0
    ? { ok: false, conflicts, patch: {}, unchanged }
    : { ok: true, patch, unchanged, conflicts: [] };
}

// ── Invoice file naming ───────────────────────────────────────────────────────

/**
 * Drive-safe text. Local copy rather than an import: the Drive naming module
 * (src/lib/drive/naming.ts) lives only on the redesign branch, and this ships
 * off main independently. When that branch merges these should become one — the
 * rule is identical and two copies of a naming rule is one too many.
 */
export function clean(s: string): string {
  return String(s ?? "").replace(/\//g, " ").replace(/\s+/g, " ").trim();
}

export type InvoiceContext = { brand: string; campaign: string; year: number };

/** `{Full Name} Invoice - {Brand} {Campaign} {Year}` — without the extension. */
export function invoiceBaseName(submitterName: string, ctx: InvoiceContext): string {
  return `${clean(submitterName)} Invoice - ${clean(ctx.brand)} ${clean(ctx.campaign)} ${ctx.year}`;
}

/**
 * The filename to write, given what is already in the folder.
 *
 * A second invoice from the same person becomes " (2)", a third " (3)". The
 * suffix goes before the extension, because a file called "… .pdf (2)" is not
 * a PDF to anything that reads extensions.
 *
 * Existing names are matched on the BASE, so the count is per person per
 * campaign — two different athletes never collide, and a resubmission by the
 * same athlete never overwrites their first one. Drive will happily hold two
 * files with identical names in one folder, which is exactly why this cannot
 * be left to Drive.
 */
export function invoiceFileName(
  submitterName: string,
  ctx: InvoiceContext,
  existingNames: readonly string[],
): string {
  const base = invoiceBaseName(submitterName, ctx);
  const lower = base.toLowerCase();

  // Highest suffix already present, so a gap left by a deleted file is not
  // reused and cannot collide with a link the admin already stored.
  let highest = 0;
  for (const name of existingNames) {
    const stem = String(name ?? "").replace(/\.pdf$/i, "").trim();
    const stemLower = stem.toLowerCase();
    if (stemLower === lower) {
      highest = Math.max(highest, 1);
      continue;
    }
    if (stemLower.startsWith(`${lower} (`)) {
      const m = stem.slice(base.length).match(/^\s*\((\d+)\)$/);
      if (m) highest = Math.max(highest, Number(m[1]));
    }
  }

  return highest === 0 ? `${base}.pdf` : `${base} (${highest + 1}).pdf`;
}

// ── Which folder an invoice belongs in ───────────────────────────────────────

export type SubmitterKind = "athlete" | "videographer";

export function invoiceFolderField(kind: SubmitterKind): string {
  return kind === "athlete"
    ? "drive_invoices_athlete_folder_id"
    : "drive_invoices_videographer_folder_id";
}

// ── Field maps: request body -> database column ──────────────────────────────

/** POST /api/admin-drive/brand */
export const BRAND_FIELDS: Record<string, string> = {
  drive_root_folder_id: "drive_parent_folder_id",
  legal_folder_id: "drive_legal_folder_id",
  sales_materials_folder_id: "drive_sales_materials_folder_id",
  brand_assets_folder_id: "drive_brand_assets_folder_id",
  master_tracker_id: "master_tracker_id",
  master_tracker_url: "master_tracker_url",
};

/** POST /api/admin-drive/campaign */
export const CAMPAIGN_FIELDS: Record<string, string> = {
  campaign_folder_id: "drive_folder_id",
  content_folder_id: "drive_content_folder_id",
  legal_folder_id: "drive_legal_folder_id",
  legal_brand_folder_id: "drive_legal_brand_folder_id",
  legal_athlete_folder_id: "drive_legal_athlete_folder_id",
  trackers_folder_id: "drive_trackers_folder_id",
  invoices_folder_id: "drive_invoices_folder_id",
  invoices_athlete_folder_id: "drive_invoices_athlete_folder_id",
  invoices_videographer_folder_id: "drive_invoices_videographer_folder_id",
  performance_tracker_id: "tracker_sheet_id",
  performance_tracker_url: "tracker_url",
  internal_tracker_id: "tracker_internal_sheet_id",
  internal_tracker_url: "tracker_internal_url",
  external_tracker_id: "tracker_external_sheet_id",
  external_tracker_url: "tracker_external_url",
};

/** Translate an incoming body into column-keyed ids, dropping anything unknown. */
export function toColumnPatch(body: Record<string, unknown>, map: Record<string, string>): IdPatch {
  const out: IdPatch = {};
  for (const [bodyKey, column] of Object.entries(map)) {
    const v = body[bodyKey];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s !== "") out[column] = s;
  }
  return out;
}

// ── Request validation ───────────────────────────────────────────────────────

export type Invalid = { field: string; reason: string };

export function requireFields(body: Record<string, unknown>, fields: readonly string[]): Invalid[] {
  const missing: Invalid[] = [];
  for (const f of fields) {
    const v = body[f];
    if (v === null || v === undefined || String(v).trim() === "") {
      missing.push({ field: f, reason: "required" });
    }
  }
  return missing;
}

/**
 * The campaign columns the read-back endpoint selects, as one literal string.
 *
 * Lives here, pure, for two reasons. supabase-js parses a select string AT THE
 * TYPE LEVEL to derive the row type, so it must be a literal it can read — a
 * value joined at runtime from Object.values() collapses the result type to a
 * ParserError, and every field then reads as garbage with no runtime symptom.
 * And being pure, it can be checked against CAMPAIGN_FIELDS by a test, which is
 * what stops the literal drifting from the map it is supposed to mirror.
 */
export const CAMPAIGN_SELECT =
  "drive_folder_id, drive_content_folder_id, drive_legal_folder_id, drive_legal_brand_folder_id, drive_legal_athlete_folder_id, drive_trackers_folder_id, drive_invoices_folder_id, drive_invoices_athlete_folder_id, drive_invoices_videographer_folder_id, tracker_sheet_id, tracker_url, tracker_internal_sheet_id, tracker_internal_url, tracker_external_sheet_id, tracker_external_url" as const;

/** The same columns as a list, for comparison. */
export function campaignSelectColumns(): string[] {
  return CAMPAIGN_SELECT.split(",").map((c) => c.trim());
}

// ── Resolving the brand behind an admin account ──────────────────────────────

/** What the Hub holds in admin_account_map for an account, if anything. */
export type AccountMapRow = { brand_id: string | null; account_name: string | null } | null;

export type BrandResolution =
  | { ok: true; brandId: string }
  | { ok: false; status: 404; reason: "brand_not_mapped"; detail: string; resolution: string };

/**
 * 404, NOT 409.
 *
 * The difference is the admin's retry policy, and getting it wrong strands the
 * handoff. 409 means "this will never succeed as you sent it" — the repoint
 * conflict, where a human has to decide which of two ids is real and the
 * handoff as posted is simply wrong. An unmapped account is the opposite: the
 * handoff is CORRECT and will succeed unchanged, as soon as somebody links the
 * account to a brand. Returning 409 for it tells the admin to give up on a
 * request that was never wrong.
 *
 * 409 is therefore reserved strictly for the repoint conflict. Nothing else in
 * these endpoints may use it to mean "not ready yet".
 *
 * Both unmapped shapes answer 404 because the admin's next move is identical
 * for both — wait for a human, then retry. They stay tellable apart in `detail`
 * so whoever reads the log knows which screen to go to.
 */
export function resolveBrand(mapRow: AccountMapRow, adminAccountId: string): BrandResolution {
  const resolution =
    "Retry after a human links the account to a brand on the Hub's Brands screen. The handoff as sent is correct and needs no change.";

  if (!mapRow) {
    return {
      ok: false,
      status: 404,
      reason: "brand_not_mapped",
      detail: `account ${adminAccountId} has no row in admin_account_map yet`,
      resolution,
    };
  }

  if (!mapRow.brand_id || String(mapRow.brand_id).trim() === "") {
    return {
      ok: false,
      status: 404,
      reason: "brand_not_mapped",
      detail: `account ${adminAccountId} ("${mapRow.account_name ?? "unnamed"}") is in admin_account_map but not linked to a brand yet`,
      resolution,
    };
  }

  return { ok: true, brandId: mapRow.brand_id };
}
