// ============================================================
// POST /api/admin-drive/brand — the admin hands the Hub a brand's Drive ids.
//
// Brief 15 §1a. The admin provisions the brand-level tree (the brand root, the
// Legal / Sales Materials / Brand Assets folders, the master tracker) and tells
// the Hub the ids the moment it has them, instead of the Hub discovering them
// by name on a nightly sweep.
//
// The brand is resolved through admin_account_map, never by name. Name
// resolution is what put "Cane's" beside "Raising Cane's" and it is banned in
// lib/account-brand-map.ts for that reason.
//
// AN UNMAPPED ACCOUNT IS A 409, NOT A NEW BRAND. /api/sync/admin-accounts can
// create a brand for an unambiguously new account and deliberately refuses when
// anything close already exists; that veto is the reason the duplicate-brand
// problem stopped. This endpoint does not get to reopen it from off-box — an
// account with no mapping is handed back for a human, which is the same
// needs_human queue the Brands screen already surfaces.
//
// Idempotent. Re-posting the same ids writes nothing and returns 200.
// A DIFFERENT id for a field that already holds one is a 409 carrying both.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  BRAND_FIELDS,
  mergeIds,
  requireFields,
  toColumnPatch,
} from "@/lib/admin-drive/contract";
import type { UpdateFor } from "@/lib/admin-drive/db-types";
import {
  adminDriveDb,
  authorized,
  logRun,
  NOT_FOUND,
  readJsonBody,
} from "@/lib/admin-drive/service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NOT_FOUND;

  const startedAt = Date.now();
  const body = await readJsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const missing = requireFields(body, ["admin_account_id"]);
  if (missing.length > 0) {
    return NextResponse.json({ error: "Missing required fields", missing }, { status: 400 });
  }

  const adminAccountId = String(body.admin_account_id).trim();
  const db = adminDriveDb();

  try {
    // ── Resolve the brand ────────────────────────────────────────────────────
    const { data: mapRow, error: mapError } = await db
      .from("admin_account_map")
      .select("brand_id, account_name")
      .eq("admin_account_id", adminAccountId)
      .maybeSingle();

    if (mapError) throw new Error(`admin_account_map lookup failed: ${mapError.message}`);

    if (!mapRow || !mapRow.brand_id) {
      const detail = mapRow
        ? `account ${adminAccountId} ("${mapRow.account_name ?? "unnamed"}") is in the map but not linked to a brand yet`
        : `account ${adminAccountId} has no row in admin_account_map yet`;
      await logRun(db, {
        endpoint: "brand",
        input: { admin_account_id: adminAccountId },
        output: { resolved: false, reason: "brand_not_mapped" },
        status: "failed",
        startedAt,
        errorMessage: detail,
      });
      return NextResponse.json(
        {
          error: "brand_not_mapped",
          detail,
          // Said plainly so the admin does not retry on a timer. Nothing this
          // endpoint can do will resolve it; a person has to pick the brand.
          resolution: "A human links the account to a brand on the Hub's Brands screen, then this handoff succeeds on retry.",
          admin_account_id: adminAccountId,
        },
        { status: 409 },
      );
    }

    const brandId = mapRow.brand_id;

    // ── Compare against what the Hub already holds ───────────────────────────
    const { data: brand, error: brandError } = await db
      .from("brands")
      .select(
        "id, name, drive_parent_folder_id, drive_legal_folder_id, drive_sales_materials_folder_id, drive_brand_assets_folder_id, master_tracker_id, master_tracker_url",
      )
      .eq("id", brandId)
      .maybeSingle();

    if (brandError) throw new Error(`brands lookup failed: ${brandError.message}`);
    if (!brand) {
      // The map points at a brand that no longer exists. Not the admin's
      // problem to retry, and not something to paper over.
      throw new Error(`admin_account_map.brand_id ${brandId} has no brands row`);
    }

    const incoming = toColumnPatch(body, BRAND_FIELDS);
    const merged = mergeIds(brand as unknown as Record<string, unknown>, incoming);

    if (!merged.ok) {
      await logRun(db, {
        endpoint: "brand",
        input: { admin_account_id: adminAccountId, brand_id: brandId, incoming },
        output: { conflicts: merged.conflicts },
        status: "failed",
        startedAt,
        errorMessage: `${merged.conflicts.length} id conflict(s)`,
      });
      return NextResponse.json(
        {
          error: "id_conflict",
          detail: "One or more ids already hold a different value. Nothing was written.",
          brand_id: brandId,
          conflicts: merged.conflicts,
        },
        { status: 409 },
      );
    }

    // ── Write ────────────────────────────────────────────────────────────────
    const fields = Object.keys(merged.patch);
    if (fields.length > 0) {
      // .select('id') because PostgREST reports NO error when an UPDATE matches
      // zero rows. Without the row count back, a write that hit nothing is
      // indistinguishable from one that succeeded.
      const { data: updated, error: updateError } = await db
        .from("brands")
        .update(merged.patch as UpdateFor<"brands">)
        .eq("id", brandId)
        .select("id");

      if (updateError) throw new Error(`brands update failed: ${updateError.message}`);
      if (!updated || updated.length === 0) {
        throw new Error(`brands update matched no rows for id ${brandId}`);
      }
    }

    const output = {
      brand_id: brandId,
      brand_name: brand.name,
      written: fields,
      unchanged: merged.unchanged,
    };
    await logRun(db, {
      endpoint: "brand",
      input: { admin_account_id: adminAccountId, brand_id: brandId, incoming },
      output,
      status: "complete",
      startedAt,
    });

    return NextResponse.json({ ok: true, ...output }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-drive/brand]", message);
    await logRun(db, {
      endpoint: "brand",
      input: { admin_account_id: adminAccountId },
      output: null,
      status: "failed",
      startedAt,
      errorMessage: message,
    });
    return NextResponse.json({ error: "internal_error", detail: message }, { status: 500 });
  }
}
