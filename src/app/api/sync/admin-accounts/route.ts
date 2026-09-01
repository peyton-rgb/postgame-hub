// ============================================================
// POST /api/sync/admin-accounts — build and refresh the account → brand map,
// then stamp brand_id onto campaigns that can now be resolved through it.
//
// Read-only against the admin API; writes only to admin_account_map and to
// campaign_recaps.{admin_account_id, brand_id}.
//
// Three passes:
//   1. accounts  → upsert into admin_account_map (name refreshed, brand_id
//                  never touched on conflict — a human's mapping is sacred)
//   2. auto-link → EXACT name match only, and only when exactly one brand
//                  matches. An account matching nothing is either created as a
//                  new brand or handed to a human; see below.
//   3. backfill  → read the admin's campaigns, stamp admin_account_id on the
//                  matching Hub rows, and set brand_id where it is still null
//                  and the map now resolves it.
//
// `?dry_run=1` computes all three and writes NOTHING — including the counts it
// would have written, so the effect can be read before it happens. The dry run
// and the real run classify the SAME candidate set, so the two reports diff.
//
// THIS ROUTE CREATES A BRAND, but only for an account that is unambiguously
// new. Burger King (1 Sep 2026) is why: sales opened the account, Rich's admin
// made the campaign, and it provisioned no Drive folders because no Hub brand
// existed to hang them on — a chain that died two links before Drive.
//
// LINKING is still exact-only; the fuzzy ban in lib/account-brand-map.ts is
// intact. What is new is a veto on CREATING: an account close to an existing
// brand ("Cane's" beside "Raising Cane's") is refused and queued for a human,
// because the exact matcher cannot tell a new brand from one already here under
// a different spelling, and auto-creating that difference makes a duplicate.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { getAccounts, getCampaigns, PostgameAdminError } from "@/lib/postgame-admin";
import {
  exactBrandFor,
  indexBrandsByName,
  nearExistingBrands,
  normaliseName,
  type MappedBy,
} from "@/lib/account-brand-map";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Stands in for a brand id in `?dry_run=1`, where no brand was inserted and
 * there is therefore no uuid to report.
 *
 * Deliberately not a fake uuid: a preview that looks like a real id invites
 * someone to go looking for the row. Nothing is written in a dry run, so this
 * value only ever appears in the report.
 */
const DRY_RUN_BRAND_ID = "(would-create)";

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production";
}

/** See /api/sync/asana-managers: triggered_by is NOT NULL → auth.users. */
async function resolveActor(
  supabase: ReturnType<typeof createLiveServiceSupabase>,
  staffId: string | null,
): Promise<string | null> {
  if (staffId) return staffId;
  const email = process.env.SLACK_FALLBACK_EMAIL;
  if (!email) return null;
  const { data } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** agent_runs, same shape and same enum reuse as the other syncs. */
async function logRun(
  supabase: ReturnType<typeof createLiveServiceSupabase>,
  actorId: string | null,
  inputPayload: Record<string, unknown>,
  outputPayload: Record<string, unknown> | null,
  status: "complete" | "failed",
  startedAt: number,
  errorMessage?: string,
): Promise<void> {
  if (!actorId) {
    console.warn("[account-map] no actor to attribute the run to — skipping agent_runs insert");
    return;
  }
  const { error } = await supabase.from("agent_runs").insert({
    agent_name: "admin_sync",
    triggered_by: actorId,
    input_payload: inputPayload,
    output_payload: outputPayload,
    model: "none",
    status,
    duration_ms: Date.now() - startedAt,
    error_message: errorMessage ?? null,
  });
  if (error) console.error("[account-map] agent_runs insert failed:", error.message);
}

/**
 * GET and POST are the same run.
 *
 * GET exists because that is the only method Vercel cron issues — a route that
 * exports POST alone answers its own schedule with 405 and never runs. POST
 * stays for the staff button.
 *
 * Neither method reads a request body, so delegating is exact rather than
 * approximate.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const supabase = createLiveServiceSupabase();

  const viaCron = cronAuthorized(req);
  const staff = viaCron ? null : await getStaffUser();
  if (!viaCron && !staff) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry_run") === "1";
  const actorId = await resolveActor(supabase, staff?.id ?? null);
  const inputPayload = { source: "admin-account-brand-map", via: viaCron ? "cron" : "staff", dryRun };

  try {
    // ── 1. accounts → map ────────────────────────────────────────────────────
    const accounts = await getAccounts();
    const accountRows = accounts
      .map((a) => ({
        admin_account_id: (a.account_id ?? "").trim(),
        account_name: a.account ?? null,
      }))
      .filter((a) => a.admin_account_id.length > 0);

    if (!dryRun && accountRows.length) {
      // Name is refreshed; brand_id and mapped_by are absent from the payload,
      // so an existing human mapping survives untouched.
      const { error } = await supabase
        .from("admin_account_map")
        .upsert(accountRows, { onConflict: "admin_account_id" });
      if (error) throw new Error(`admin_account_map upsert failed: ${error.message}`);
    }

    // ── 2. link exactly, create when unambiguously new, else queue ───────────
    const { data: brandRows, error: brandError } = await supabase.from("brands").select("id, name");
    if (brandError) throw new Error(`brands read failed: ${brandError.message}`);
    const brands = (brandRows ?? []) as Array<{ id: string; name: string }>;
    const brandsByName = indexBrandsByName(brands);
    // Kept alongside the index because the veto compares against names, and a
    // brand created below has to be visible to every candidate after it.
    const brandNames = brands.map((b) => b.name);

    const { data: mapRows, error: mapError } = await supabase
      .from("admin_account_map")
      .select("admin_account_id, account_name, brand_id");
    if (mapError) throw new Error(`admin_account_map read failed: ${mapError.message}`);

    // Accounts that already have a brand. Only ever fills a NULL — a row mapped
    // by a human or by a previous auto pass is left exactly as it is.
    const alreadyMapped = new Set(
      ((mapRows ?? []) as Array<{ admin_account_id: string; brand_id: string | null }>)
        .filter((r) => r.brand_id)
        .map((r) => r.admin_account_id),
    );

    // ONE candidate set for both modes, so `?dry_run=1` is a faithful preview
    // rather than a differently-scoped report: every unmapped row already in
    // the map, plus every account the admin returned that the map has not seen.
    // Pass 1's upsert never touches brand_id, so reading the map before it and
    // after it gives the same answer — the real run's candidates are these too.
    const candidateByAccount = new Map<string, string>();
    for (const row of (mapRows ?? []) as Array<{ admin_account_id: string; account_name: string | null; brand_id: string | null }>) {
      if (!row.brand_id) candidateByAccount.set(row.admin_account_id, row.account_name ?? "");
    }
    for (const row of accountRows) {
      // The admin's name wins over the stored one — it is the fresher of the two.
      if (!alreadyMapped.has(row.admin_account_id)) {
        candidateByAccount.set(row.admin_account_id, row.account_name ?? "");
      }
    }
    const candidates = Array.from(candidateByAccount, ([admin_account_id, account_name]) => ({
      admin_account_id,
      account_name,
    }));

    const toLink: Array<{ admin_account_id: string; account_name: string; brand_id: string }> = [];
    const created: Array<{ admin_account_id: string; account_name: string; brand_id: string }> = [];
    const vetoed: Array<{ admin_account_id: string; account_name: string; near: string[] }> = [];
    const needsHuman: Array<{ admin_account_id: string; account_name: string; reason: string }> = [];
    const mappedAt = new Date().toISOString();

    /** Fill a map row's brand_id, re-checking the NULL at write time so a human
     *  who mapped it between the read above and here is never overwritten. */
    const linkAccount = async (accountId: string, brandId: string, how: MappedBy): Promise<void> => {
      const { error } = await supabase
        .from("admin_account_map")
        .update({ brand_id: brandId, mapped_by: how, mapped_at: mappedAt })
        .eq("admin_account_id", accountId)
        .is("brand_id", null);
      if (error) console.error(`[account-map] link ${accountId} failed:`, error.message);
    };

    for (const row of candidates) {
      const brandId = exactBrandFor(row.account_name, brandsByName);
      if (brandId) {
        toLink.push({ ...row, brand_id: brandId });
        continue;
      }

      // brands.name is NOT NULL and an unnamed brand helps nobody.
      if (!normaliseName(row.account_name)) {
        needsHuman.push({ ...row, reason: "account has no usable name" });
        continue;
      }

      // THE VETO. Close to something we already have → a human decides. This is
      // the only thing standing between auto-create and a second Raising Cane's.
      const near = nearExistingBrands(row.account_name, brandNames);
      if (near.length) {
        vetoed.push({ ...row, near });
        needsHuman.push({
          ...row,
          reason: `near existing brand${near.length > 1 ? "s" : ""}: ${near.join(", ")}`,
        });
        continue;
      }

      // Unambiguously new. Name goes in VERBATIM (trimmed only) — same
      // discipline as folderNameFor(): no case changes, no punctuation tidying.
      // Everything else defaults, kit_status included: 'placeholder' already
      // means "kit not sourced yet", which is exactly the queue signal wanted.
      const name = (row.account_name ?? "").trim();
      if (dryRun) {
        created.push({ ...row, brand_id: DRY_RUN_BRAND_ID });
      } else {
        const { data: newBrand, error: insertError } = await supabase
          .from("brands")
          .insert({ name, admin_brand_id: row.admin_account_id })
          .select("id")
          .single();

        if (insertError || !newBrand) {
          console.error(`[account-map] create brand "${name}" failed:`, insertError?.message);
          needsHuman.push({ ...row, reason: `brand insert failed: ${insertError?.message ?? "no row returned"}` });
          continue;
        }
        // If this update fails the brand is orphaned for exactly one run: next
        // pass the account is still unmapped and a brand of that name now
        // exists, so exactBrandFor picks it up as auto_exact. Self-healing.
        await linkAccount(row.admin_account_id, newBrand.id, "auto_created");
        created.push({ ...row, brand_id: newBrand.id });
      }

      // Visible to the rest of this sweep, so two accounts sharing a name link
      // to the one brand instead of creating it twice.
      const key = normaliseName(name);
      const createdId = created[created.length - 1].brand_id;
      brandsByName.set(key, [...(brandsByName.get(key) ?? []), createdId]);
      brandNames.push(name);
    }

    if (!dryRun) {
      for (const link of toLink) await linkAccount(link.admin_account_id, link.brand_id, "auto_exact");
    }

    // ── 3. backfill campaigns ────────────────────────────────────────────────
    // The admin's campaigns carry account_id; the Hub's rows do not yet. Join
    // them on admin_campaign_id (text on both sides, never cast to a number).
    const adminCampaigns = await getCampaigns();
    const accountByCampaign = new Map<string, string>();
    for (const c of adminCampaigns) {
      const campaignId = (c.campaign_id ?? "").trim();
      const accountId = (c.account_id ?? "").trim();
      if (campaignId && accountId) accountByCampaign.set(campaignId, accountId);
    }

    // The map as it stands after pass 2, for resolving brand_id below. Seeded
    // from this run's own links and creations because a dry run never wrote
    // them — without that, the preview would under-report the backfill by
    // exactly the campaigns the run exists to fix.
    const brandByAccount = new Map<string, string>();
    for (const link of [...toLink, ...created]) brandByAccount.set(link.admin_account_id, link.brand_id);
    const { data: mappedRows } = await supabase
      .from("admin_account_map")
      .select("admin_account_id, brand_id")
      .not("brand_id", "is", null);
    for (const row of (mappedRows ?? []) as Array<{ admin_account_id: string; brand_id: string }>) {
      brandByAccount.set(row.admin_account_id, row.brand_id);
    }

    const { data: hubRows, error: hubError } = await supabase
      .from("campaign_recaps")
      .select("id, name, admin_campaign_id, admin_account_id, brand_id")
      .not("admin_campaign_id", "is", null);
    if (hubError) throw new Error(`campaign_recaps read failed: ${hubError.message}`);

    const stampedAccount: string[] = [];
    const stampedBrand: Array<{ id: string; name: string; brand_id: string }> = [];

    for (const row of (hubRows ?? []) as Array<{
      id: string;
      name: string;
      admin_campaign_id: string;
      admin_account_id: string | null;
      brand_id: string | null;
    }>) {
      const accountId = accountByCampaign.get(row.admin_campaign_id.trim());
      if (!accountId) continue;

      const patch: Record<string, string> = {};
      if (row.admin_account_id !== accountId) patch.admin_account_id = accountId;

      // brand_id is only ever FILLED, never changed. A campaign that already
      // has a brand keeps it, whatever the map says.
      const resolvedBrand = row.brand_id ? null : brandByAccount.get(accountId);
      if (resolvedBrand) patch.brand_id = resolvedBrand;

      if (Object.keys(patch).length === 0) continue;

      if (!dryRun) {
        // Keyed on the UUID. admin_campaign_id is not a key — six known dupes.
        const { error } = await supabase.from("campaign_recaps").update(patch).eq("id", row.id);
        if (error) {
          console.error(`[account-map] campaign ${row.id} update failed:`, error.message);
          continue;
        }
      }
      if (patch.admin_account_id) stampedAccount.push(row.id);
      if (patch.brand_id) stampedBrand.push({ id: row.id, name: row.name, brand_id: patch.brand_id });
    }

    const report = {
      dry_run: dryRun,
      accounts: {
        total: accountRows.length,
        auto_linked: toLink.length,
        created: created.length,
        vetoed: vetoed.length,
        // Everything left for a human — the vetoed accounts plus anything
        // unusable. `vetoed` is the subset that got here via the near-brand
        // veto, which is the case worth eyeballing.
        needs_human: needsHuman.length,
        created_list: created,
        // The account AND the brand it was near, nearest first. "Near what" is
        // the useful half: it is the queue a human actually works from.
        vetoed_list: vetoed,
        needs_human_list: needsHuman,
      },
      backfill: {
        admin_account_id_stamped: stampedAccount.length,
        brand_id_stamped: stampedBrand.length,
        brand_id_stamped_list: stampedBrand,
      },
    };

    await logRun(supabase, actorId, inputPayload, report, "complete", startedAt).catch(() => {});
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[account-map] run failed:", message);
    await logRun(supabase, actorId, inputPayload, null, "failed", startedAt, message).catch(() => {});
    const status = err instanceof PostgameAdminError ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
