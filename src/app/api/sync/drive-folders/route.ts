// ============================================================
// POST /api/sync/drive-folders — provision the Drive folder structure for new
// campaigns.
//
//   {client root} / {brand root} / {year} / {campaign} / {Content,Contracts,Trackers}
//
// The brand root is resolved by NAME under DRIVE_CLIENT_ROOT_FOLDER_ID when the
// brand has no stored one, and the id is persisted on first resolution so the
// search happens once per brand, ever. The brand folder itself is never
// created — sales owns that, and "not there yet" is a skip, not a failure.
//
// Two callers, one route, exactly as /api/sync/asana-managers:
//   • the daily Vercel cron, authenticated by CRON_SECRET
//   • a staff session (getStaffUser), for the "Provision folders" button
//
// GO-FORWARD ONLY. Candidates are recap rows created on or after
// FEATURE_LAUNCH_DATE with no drive_folder_id. The ~444 historical campaigns
// without a folder keep their existing structures under the old conventions;
// backfilling them is a separate, human-gated project and is NOT what happens
// if you run this.
//
// CREATION ONLY — see lib/drive-provision.ts. Nothing moves, renames or deletes.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import {
  campaignYear,
  provisionCampaign,
  resolveBrandRoot,
  type BrandRootVia,
  type CampaignCandidate,
  type ProvisionOutcome,
  type ProvisionSkip,
} from "@/lib/drive-provision";
import { getDriveClient } from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The day this feature shipped. Rows older than this are out of scope by
 * design — this is the line between "provision new campaigns" and "backfill
 * the archive", and moving it earlier turns one into the other.
 */
const FEATURE_LAUNCH_DATE = "2026-08-31";

/**
 * Most campaigns per run. Each one costs several Drive round trips, so this is
 * the circuit breaker that keeps a surprise backlog from running the function
 * to its timeout — the same role the Asana sync's page cap plays.
 */
const MAX_PER_RUN = 50;

/**
 * The folder holding one subfolder per brand.
 *
 * In env rather than a literal because the same id drives
 * scripts/provision-campaign-folders.ts, and two copies of a Drive id is one
 * copy too many. A brand with a stored drive_parent_folder_id never needs it,
 * so a missing var degrades to a per-campaign skip rather than failing the run.
 */
const CLIENT_ROOT_ENV = "DRIVE_CLIENT_ROOT_FOLDER_ID";

/** Vercel sends `Authorization: Bearer <CRON_SECRET>` once the var exists. */
function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
  // Local dev only; fail CLOSED in production so a missing secret can never
  // leave a write-capable endpoint open.
  return process.env.NODE_ENV !== "production";
}

/** See the note in /api/sync/asana-managers: agent_runs.triggered_by is NOT NULL
 *  and a foreign key to auth.users, so a cron run still needs a real user. */
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

/**
 * Log to agent_runs.
 *
 * agent_name is an enum with no 'drive-folder-provision' member; adding one is a
 * schema change beyond what this build needed, so it reuses 'admin_sync' — the
 * existing member for "an external system reconciled into campaign_recaps" —
 * and distinguishes itself with `source` in input_payload, exactly as the Asana
 * sync does. `model` is NOT NULL but nothing here calls a model, so: 'none'.
 */
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
    console.warn("[drive-provision] no actor to attribute the run to — skipping agent_runs insert");
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
  if (error) console.error("[drive-provision] agent_runs insert failed:", error.message);
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

  const actorId = await resolveActor(supabase, staff?.id ?? null);
  const inputPayload = {
    source: "drive-folder-provision",
    via: viaCron ? "cron" : "staff",
    since: FEATURE_LAUNCH_DATE,
    cap: MAX_PER_RUN,
  };

  // Stub-safe: an unconfigured Google credential is a deployment state, not a
  // crash. getGoogleAuth() throws on missing env, so check before touching it.
  const missingGoogle = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"].filter(
    (v) => !process.env[v],
  );
  if (missingGoogle.length) {
    const message = `Drive provisioning unavailable — missing ${missingGoogle.join(", ")}.`;
    await logRun(supabase, actorId, inputPayload, null, "failed", startedAt, message).catch(() => {});
    return NextResponse.json({ error: message }, { status: 503 });
  }

  try {
    // Candidates. brand_id may be null — the CF admin sync leaves it that way
    // on purpose — so the brand root is resolved separately rather than joined,
    // and a missing brand is reported as its own skip reason.
    const { data: rows, error: selectError } = await supabase
      .from("campaign_recaps")
      .select("id, name, brand_id, admin_created_on, created_at")
      .eq("type", "recap")
      .is("drive_folder_id", null)
      .gte("created_at", FEATURE_LAUNCH_DATE)
      .order("created_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (selectError) throw new Error(`candidate query failed: ${selectError.message}`);
    const candidates = (rows ?? []) as CampaignCandidate[];

    // Brands in one read rather than per campaign. The NAME comes along because
    // it is what the brand root is searched for under the client root.
    const brandIds = Array.from(
      new Set(candidates.map((c) => c.brand_id).filter((id): id is string => Boolean(id))),
    );
    const brands = new Map<string, { name: string; rootId: string | null }>();
    if (brandIds.length) {
      const { data: brandRows } = await supabase
        .from("brands")
        .select("id, name, drive_parent_folder_id")
        .in("id", brandIds);
      for (const b of (brandRows ?? []) as Array<{
        id: string;
        name: string;
        drive_parent_folder_id: string | null;
      }>) {
        brands.set(b.id, { name: b.name, rootId: b.drive_parent_folder_id });
      }
    }

    const clientRootId = (process.env[CLIENT_ROOT_ENV] ?? "").trim();

    // Year shelves already known for these brands.
    const yearFolders = new Map<string, string>(); // `${brandId}:${year}` → folderId
    if (brandIds.length) {
      const { data: shelves } = await supabase
        .from("brand_year_folders")
        .select("brand_id, year, folder_id")
        .in("brand_id", brandIds);
      for (const s of (shelves ?? []) as Array<{ brand_id: string; year: number; folder_id: string }>) {
        yearFolders.set(`${s.brand_id}:${s.year}`, s.folder_id);
      }
    }

    // brandRootVia rides along with the outcome rather than inside it: the ROUTE
    // resolves the brand root (it is the half that needs the database), so the
    // route is what can report how.
    const provisioned: Array<ProvisionOutcome & { brandRootVia: BrandRootVia }> = [];
    const skipped: ProvisionSkip[] = [];

    for (const candidate of candidates) {
      // Per-campaign isolation: one bad campaign must not end the sweep.
      try {
        if (!candidate.brand_id) {
          skipped.push({
            campaignId: candidate.id,
            campaignName: candidate.name,
            reason: "no_brand_id",
            detail: "campaign has no brand_id — the CF admin sync leaves it null",
          });
          continue;
        }

        const brand = brands.get(candidate.brand_id);
        if (!brand) {
          skipped.push({
            campaignId: candidate.id,
            campaignName: candidate.name,
            reason: "no_brand_root",
            detail: `brand ${candidate.brand_id} was not readable — cannot resolve a Drive root`,
          });
          continue;
        }

        // No stored root and nowhere to look for one. Every brand that DOES
        // have a stored root still provisions, so this is a per-campaign skip
        // rather than a failed run.
        if (!brand.rootId && !clientRootId) {
          skipped.push({
            campaignId: candidate.id,
            campaignName: candidate.name,
            reason: "no_brand_root",
            detail: `brand has no drive_parent_folder_id and ${CLIENT_ROOT_ENV} is not configured`,
          });
          continue;
        }

        const rootResult = await resolveBrandRoot(
          getDriveClient(),
          clientRootId,
          brand.name,
          brand.rootId,
        );

        if ("ambiguous" in rootResult) {
          const names = rootResult.ambiguous.map((f) => `"${f.name}"`).join(", ");
          skipped.push({
            campaignId: candidate.id,
            campaignName: candidate.name,
            reason: "ambiguous_brand_root",
            detail: `${rootResult.ambiguous.length} folders under the client root could be ${brand.name} (${names}) — a human has to pick one`,
          });
          continue;
        }

        if ("notFound" in rootResult) {
          // Normal and temporary: sales has not made the brand folder yet. The
          // next pass picks it up once they do — nothing here creates it.
          skipped.push({
            campaignId: candidate.id,
            campaignName: candidate.name,
            reason: "brand_root_not_found",
            detail: `no folder named "${brand.name}" under the client root yet — sales creates it, then this provisions on the next run`,
          });
          continue;
        }

        const brandRoot = rootResult.id;

        // Persist an adopted root so the client root is listed once per brand,
        // ever. Guarded on NULL for the same reason the account map is: never
        // overwrite a root someone else set between the read above and here.
        if (rootResult.via === "matched") {
          brands.set(candidate.brand_id, { name: brand.name, rootId: brandRoot });
          const { error: rootError } = await supabase
            .from("brands")
            .update({ drive_parent_folder_id: brandRoot })
            .eq("id", candidate.brand_id)
            .is("drive_parent_folder_id", null);
          if (rootError) {
            console.error("[drive-provision] persisting brand root failed:", rootError.message);
          }
        }

        const year = campaignYear(candidate);
        const shelfKey = `${candidate.brand_id}:${year}`;

        const result = await provisionCampaign(
          candidate,
          brandRoot,
          yearFolders.get(shelfKey) ?? null,
          async (resolvedYear, folderId) => {
            // Remember the shelf so later runs never name-match again. upsert,
            // because two campaigns for one brand-year resolve it in the same
            // sweep and the second must not collide.
            yearFolders.set(`${candidate.brand_id}:${resolvedYear}`, folderId);
            const { error } = await supabase
              .from("brand_year_folders")
              .upsert(
                { brand_id: candidate.brand_id, year: resolvedYear, folder_id: folderId },
                { onConflict: "brand_id,year" },
              );
            if (error) console.error("[drive-provision] brand_year_folders upsert failed:", error.message);
          },
        );

        if ("reason" in result) {
          skipped.push(result);
          continue;
        }

        // One update, keyed on the campaign UUID — never admin_campaign_id,
        // which is not a key and has known duplicates.
        const { error: updateError } = await supabase
          .from("campaign_recaps")
          .update({
            drive_folder_id: result.campaignFolderId,
            drive_content_folder_id: result.contentFolderId,
            drive_contracts_folder_id: result.contractsFolderId,
            drive_trackers_folder_id: result.trackersFolderId,
            drive_provisioned_at: new Date().toISOString(),
          })
          .eq("id", candidate.id);

        if (updateError) throw new Error(`update failed: ${updateError.message}`);
        provisioned.push({ ...result, brandRootVia: rootResult.via });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[drive-provision] ${candidate.id} (${candidate.name}) failed:`, message);
        skipped.push({
          campaignId: candidate.id,
          campaignName: candidate.name,
          reason: "error",
          detail: message,
        });
      }
    }

    const report = {
      candidates: candidates.length,
      provisioned: provisioned.filter((p) => !p.linkedExisting).length,
      linked_existing: provisioned.filter((p) => p.linkedExisting).length,
      skipped: skipped.length,
      skipped_by_reason: skipped.reduce<Record<string, number>>((acc, s) => {
        acc[s.reason] = (acc[s.reason] ?? 0) + 1;
        return acc;
      }, {}),
      // Which year shelves were adopted rather than created, and under what
      // name. An adopted variant ("adidas 2026") is the one outcome a human
      // might want to eyeball, so it does not hide inside `details`.
      adopted_year_folders: provisioned
        .filter((p) => p.yearFolderVia === "variant")
        .map((p) => ({ campaign: p.campaignName, year: p.year, folder: p.yearFolderName })),
      // Brand roots found by name and persisted this run. Each one happens
      // exactly once per brand — every later run reads the stored id — so a
      // name here is a brand the Hub had never been pointed at before.
      adopted_brand_roots: provisioned
        .filter((p) => p.brandRootVia === "matched")
        .map((p) => ({ campaign: p.campaignName, campaign_id: p.campaignId })),
      details: { provisioned, skipped },
      // True when the cap was hit and there is more waiting — never silently
      // truncate and report it as "all done".
      capped: candidates.length === MAX_PER_RUN,
    };

    await logRun(supabase, actorId, inputPayload, report, "complete", startedAt).catch(() => {});
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[drive-provision] run failed:", message);
    await logRun(supabase, actorId, inputPayload, null, "failed", startedAt, message).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
