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
//                  matches. Everything else waits for a human.
//   3. backfill  → read the admin's campaigns, stamp admin_account_id on the
//                  matching Hub rows, and set brand_id where it is still null
//                  and the map now resolves it.
//
// `?dry_run=1` computes all three and writes NOTHING — including the counts it
// would have written, so the effect can be read before it happens.
//
// This route NEVER creates a brand. An account with no matching brand waits.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { getAccounts, getCampaigns, PostgameAdminError } from "@/lib/postgame-admin";
import { exactBrandFor, indexBrandsByName, normaliseName } from "@/lib/account-brand-map";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

    // ── 2. auto-link, exact only ─────────────────────────────────────────────
    const { data: brandRows, error: brandError } = await supabase.from("brands").select("id, name");
    if (brandError) throw new Error(`brands read failed: ${brandError.message}`);
    const brandsByName = indexBrandsByName((brandRows ?? []) as Array<{ id: string; name: string }>);

    // Only ever fills a NULL. A row already mapped — by a human or a previous
    // auto pass — is left exactly as it is.
    const { data: unmappedRows, error: unmappedError } = await supabase
      .from("admin_account_map")
      .select("admin_account_id, account_name")
      .is("brand_id", null);
    if (unmappedError) throw new Error(`unmapped read failed: ${unmappedError.message}`);

    const toLink: Array<{ admin_account_id: string; account_name: string; brand_id: string }> = [];
    const needsHuman: Array<{ admin_account_id: string; account_name: string }> = [];
    // In a dry run the map has not been written, so match the freshly fetched
    // accounts; otherwise match what is actually sitting unmapped.
    const candidates = dryRun
      ? accountRows.map((a) => ({ admin_account_id: a.admin_account_id, account_name: a.account_name }))
      : ((unmappedRows ?? []) as Array<{ admin_account_id: string; account_name: string | null }>);

    for (const row of candidates) {
      const brandId = exactBrandFor(row.account_name, brandsByName);
      if (brandId) {
        toLink.push({
          admin_account_id: row.admin_account_id,
          account_name: row.account_name ?? "",
          brand_id: brandId,
        });
      } else {
        needsHuman.push({ admin_account_id: row.admin_account_id, account_name: row.account_name ?? "" });
      }
    }

    if (!dryRun && toLink.length) {
      const mappedAt = new Date().toISOString();
      for (const link of toLink) {
        const { error } = await supabase
          .from("admin_account_map")
          .update({ brand_id: link.brand_id, mapped_by: "auto_exact", mapped_at: mappedAt })
          .eq("admin_account_id", link.admin_account_id)
          // Re-checked at write time so a human who mapped this row between the
          // read above and here is never overwritten.
          .is("brand_id", null);
        if (error) console.error(`[account-map] link ${link.admin_account_id} failed:`, error.message);
      }
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

    // The map as it stands after pass 2, for resolving brand_id below.
    const brandByAccount = new Map<string, string>();
    for (const link of toLink) brandByAccount.set(link.admin_account_id, link.brand_id);
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
        needs_human: needsHuman.length,
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
