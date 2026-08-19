// ============================================================
// POST /api/admin-sync/campaigns — reconcile Hub campaign_recaps against the
// live Postgame admin API.
//
// Read-only in one direction: admin → Hub. Nothing is ever written back to the
// admin.
//
// Body: { "apply": false }   ← default. Dry run: computes and returns the diff,
//                              writes nothing to campaign_recaps.
//       { "apply": true  }     Performs the inserts/refreshes, returns the same
//                              report plus what was actually written.
//
// v1 rules (settled in the brief — do not re-litigate here):
//   • The Hub's `name` is NEVER overwritten. Admin names land in `admin_name`
//     and divergence is reported as nameDrift for a human to reconcile.
//   • Inserts only. Existing matched rows get admin_name / admin_is_active /
//     admin_synced_at refreshed and nothing else.
//   • An admin id attached to more than one Hub row is SKIPPED and reported,
//     never auto-merged.
//   • brand_id is left null — account→brand mapping is a separate job.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { getCampaigns, PostgameAdminError, type AdminCampaign } from "@/lib/postgame-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Concurrent UPDATE fan-out. The first apply run touches every matched row
 *  (both admin columns start null); later runs touch almost none. */
const UPDATE_CONCURRENCY = 25;

interface HubRow {
  id: string;
  name: string;
  slug: string;
  admin_campaign_id: string | null;
  admin_name: string | null;
  admin_is_active: boolean | null;
}

// ── Normalizers ───────────────────────────────────────────────────────────────

/** Case- and whitespace-insensitive, per the brief. Deliberately NOT
 *  punctuation-insensitive: "McDonald's" vs "McDonalds" is real drift a human
 *  should see, not noise to swallow. */
function normName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Admin ids are strings on both sides and `admin_campaign_id` is `text` —
 *  never cast either to a number. */
function isNumericId(value: string | null | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 && /^\d+$/.test(trimmed);
}

/** The admin sends booleans as "1"/"0" strings. Anything unrecognised → null
 *  rather than a wrong `false`. */
function toBool(value: string | null | undefined): boolean | null {
  if (value === null || value === undefined) return null;
  const t = String(value).trim().toLowerCase();
  if (t === "") return null;
  if (["1", "true", "t", "yes", "y"].includes(t)) return true;
  if (["0", "false", "f", "no", "n"].includes(t)) return false;
  return null;
}

function slugify(name: string): string {
  const base = (name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "campaign";
}

/** `slug` is UNIQUE (campaigns_slug_key) and NOT NULL, so a generated slug that
 *  collides would abort the whole insert batch. Suffix until free. */
function uniqueSlug(name: string, adminId: string, taken: Set<string>): string {
  const candidate = `${slugify(name)}-${adminId}`;
  if (!taken.has(candidate)) {
    taken.add(candidate);
    return candidate;
  }
  for (let n = 2; n < 100; n++) {
    const next = `${candidate}-${n}`;
    if (!taken.has(next)) {
      taken.add(next);
      return next;
    }
  }
  throw new Error(`Could not generate a unique slug for admin campaign ${adminId}`);
}

/** Run tasks with a bounded fan-out so a 600-row refresh doesn't open 600
 *  sockets at once. */
async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { apply?: unknown };
  // Anything other than a literal `true` is a dry run. Defaulting to write would
  // be the wrong failure mode.
  const apply = body?.apply === true;

  const startedAt = Date.now();
  const supabase = createLiveServiceSupabase();

  try {
    // 1 ── Every campaign the admin knows about (active and archived).
    const adminCampaigns = await getCampaigns();

    // 2 ── Every Hub row already carrying an admin id.
    const { data: hubData, error: hubError } = await supabase
      .from("campaign_recaps")
      .select("id, name, slug, admin_campaign_id, admin_name, admin_is_active")
      .not("admin_campaign_id", "is", null)
      .limit(5000);
    if (hubError) throw new Error(`Failed to load campaign_recaps: ${hubError.message}`);
    const hubRows = (hubData ?? []) as HubRow[];

    // Slug uniqueness must be checked against ALL rows, not just linked ones.
    const { data: slugData, error: slugError } = await supabase
      .from("campaign_recaps")
      .select("slug")
      .limit(5000);
    if (slugError) throw new Error(`Failed to load existing slugs: ${slugError.message}`);
    const takenSlugs = new Set<string>((slugData ?? []).map((r: { slug: string }) => r.slug));

    // 3 ── Index the Hub side, splitting off rows whose id isn't a number.
    const byAdminId = new Map<string, HubRow[]>();
    const unparseable: { hub_id: string; hub_name: string; admin_campaign_id: string | null }[] = [];

    for (const row of hubRows) {
      const raw = (row.admin_campaign_id ?? "").trim();
      if (!isNumericId(raw)) {
        unparseable.push({ hub_id: row.id, hub_name: row.name, admin_campaign_id: row.admin_campaign_id });
        continue;
      }
      const bucket = byAdminId.get(raw);
      if (bucket) bucket.push(row);
      else byAdminId.set(raw, [row]);
    }

    const duplicates = [...byAdminId.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([adminId, rows]) => ({
        admin_campaign_id: adminId,
        hub_rows: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug })),
      }));

    // 4 ── Walk the admin side.
    const toInsertRaw: AdminCampaign[] = [];
    const nameDrift: {
      hub_id: string;
      admin_campaign_id: string;
      hub_name: string;
      admin_name: string | null;
    }[] = [];
    const toRefresh: { row: HubRow; admin_name: string | null; admin_is_active: boolean | null }[] = [];
    let skippedDuplicateMatches = 0;

    for (const campaign of adminCampaigns) {
      const adminId = (campaign.campaign_id ?? "").trim();
      if (!isNumericId(adminId)) continue; // admin-side junk — not ours to fix

      const rows = byAdminId.get(adminId);
      if (!rows || rows.length === 0) {
        toInsertRaw.push(campaign);
        continue;
      }
      if (rows.length > 1) {
        // Reported in `duplicates`; never auto-merged, never written to.
        skippedDuplicateMatches++;
        continue;
      }

      const row = rows[0];
      const adminName = campaign.campaign_name;
      const adminActive = toBool(campaign.is_active);

      if (normName(row.name) !== normName(adminName)) {
        nameDrift.push({
          hub_id: row.id,
          admin_campaign_id: adminId,
          hub_name: row.name,
          admin_name: adminName,
        });
      }

      // Only write when something actually changed — keeps re-runs cheap and
      // makes a timed-out apply safe to resume.
      if (row.admin_name !== adminName || row.admin_is_active !== adminActive) {
        toRefresh.push({ row, admin_name: adminName, admin_is_active: adminActive });
      }
    }

    // 5 ── Materialise the rows we would insert.
    const syncedAt = new Date().toISOString();
    const insertRows = toInsertRaw.map((c) => {
      const adminId = (c.campaign_id ?? "").trim();
      return {
        name: c.campaign_name ?? `Admin campaign ${adminId}`,
        slug: uniqueSlug(c.campaign_name ?? `campaign-${adminId}`, adminId, takenSlugs),
        // NOT NULL with no default and no brand mapping in this scope — empty
        // means "unresolved", to be filled by the account→brand job.
        client_name: "",
        published: false,
        lifecycle_status: "draft",
        admin_campaign_id: adminId,
        admin_name: c.campaign_name,
        admin_is_active: toBool(c.is_active),
        admin_synced_at: syncedAt,
      };
    });

    const report = {
      apply,
      admin: {
        total: adminCampaigns.length,
        active: adminCampaigns.filter((c) => toBool(c.is_active) === true).length,
      },
      hub: {
        rows_with_admin_id: hubRows.length,
        distinct_admin_ids: byAdminId.size,
      },
      counts: {
        toInsert: insertRows.length,
        nameDrift: nameDrift.length,
        duplicates: duplicates.length,
        unparseable: unparseable.length,
        needsRefresh: toRefresh.length,
        skippedDuplicateMatches,
      },
      toInsert: insertRows.map((r) => ({
        admin_campaign_id: r.admin_campaign_id,
        name: r.name,
        slug: r.slug,
        admin_is_active: r.admin_is_active,
      })),
      nameDrift,
      duplicates,
      unparseable,
    };

    // 6 ── Dry run stops here.
    if (!apply) {
      await logRun(supabase, staff.id, { apply }, { ...report.counts, dry_run: true }, "complete", startedAt);
      return NextResponse.json({ ok: true, dry_run: true, ...report });
    }

    // 7 ── Apply.
    const written = { inserted: 0, refreshed: 0, errors: [] as string[] };

    if (insertRows.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("campaign_recaps")
        .insert(insertRows)
        .select("id");
      if (insertError) {
        written.errors.push(`insert failed: ${insertError.message}`);
      } else {
        written.inserted = inserted?.length ?? 0;
      }
    }

    const refreshResults = await inBatches(toRefresh, UPDATE_CONCURRENCY, async (item) => {
      const { error } = await supabase
        .from("campaign_recaps")
        .update({
          admin_name: item.admin_name,
          admin_is_active: item.admin_is_active,
          admin_synced_at: syncedAt,
        })
        .eq("id", item.row.id);
      if (error) return `refresh ${item.row.id} failed: ${error.message}`;
      return null;
    });
    for (const err of refreshResults) {
      if (err) written.errors.push(err);
      else written.refreshed++;
    }

    const status = written.errors.length > 0 ? "failed" : "complete";
    await logRun(
      supabase,
      staff.id,
      { apply },
      { ...report.counts, ...written, errors: written.errors.slice(0, 20) },
      status,
      startedAt,
    );

    return NextResponse.json({ ok: written.errors.length === 0, dry_run: false, ...report, written });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRun(supabase, staff.id, { apply }, null, "failed", startedAt, message).catch(() => {});

    // Config/auth/rate-limit problems on the admin API are upstream failures.
    const status = err instanceof PostgameAdminError ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Log to agent_runs. `model` is NOT NULL and defaults to a Claude model, but no
 *  model is called here — record 'none' rather than let the default imply one.
 *  Token/cost columns stay null for the same reason. */
async function logRun(
  supabase: ReturnType<typeof createLiveServiceSupabase>,
  staffId: string,
  inputPayload: Record<string, unknown>,
  outputPayload: Record<string, unknown> | null,
  status: "complete" | "failed",
  startedAt: number,
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabase.from("agent_runs").insert({
    agent_name: "admin_sync",
    triggered_by: staffId,
    input_payload: inputPayload,
    output_payload: outputPayload,
    model: "none",
    status,
    duration_ms: Date.now() - startedAt,
    error_message: errorMessage ?? null,
  });
  // Never let logging failure mask the real result.
  if (error) console.error("[admin-sync] agent_runs insert failed:", error.message);
}
