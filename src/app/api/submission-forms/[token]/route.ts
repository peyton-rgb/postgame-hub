// src/app/api/submission-forms/[token]/route.ts
// ─────────────────────────────────────────────────────────────
// Staff-only. One submission form (keyed by its token).
//
//   GET   → detail: the link, its campaign_recap, per-athlete aggregation
//           of tier3_submissions, and the four stats.
//   PATCH → row / panel actions:
//             { action: "revoke" }              active=false, revoked_at=now
//             { action: "regenerate" }          new token, re-activated
//             { action: "repoint", campaignId } re-point the form to another recap
//             { action: "set-folder", driveUrl } set the campaign's Drive folder
//             { action: "update-settings", … }  the six editable form settings
//
// Re-pointing (campaign or folder) doesn't move existing files — only new
// uploads go to the new destination. The warning for that lives client-side
// (it needs the submission count); the API just applies the change.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Permissive Drive folder-id extractor: accepts /drive/folders/ID (± query),
// /file/d/ID, open?id=/uc?id=ID, or a bare ID. Extracting the canonical id
// from any shape is the difference between "works" and "reported as broken".
function extractDriveFolderId(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  let m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s; // bare id
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const svc = createServiceSupabase();

  const { data: link } = await svc
    .from("submission_links")
    .select(
      "token, campaign_id, active, min_photos, min_videos, max_files, deliverables, brief_url, created_at, created_by, expires_at, sent_at, revoked_at"
    )
    .eq("token", params.token)
    .single();
  if (!link) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const { data: recap } = await svc
    .from("campaign_recaps")
    // Logo comes from the linked brand, not campaign_recaps.client_logo_url:
    // that column is set on 2 of 611 campaigns, while brand_id is set on all of
    // them. Nested through the campaigns_brand_id_fkey FK, so no 2nd query.
    .select(
      "id, name, client_name, admin_campaign_id, drive_folder_id, brand:brands!campaigns_brand_id_fkey(logo_light_url, logo_primary_url)"
    )
    .eq("id", link.campaign_id)
    .single();

  // Resolve created_by (a profile id) to a display name when possible.
  let createdByName: string | null = link.created_by ?? null;
  if (link.created_by && UUID_RE.test(link.created_by)) {
    const { data: prof } = await svc
      .from("profiles")
      .select("full_name, email")
      .eq("id", link.created_by)
      .single();
    createdByName = prof?.full_name || prof?.email || link.created_by;
  }

  // Per-athlete aggregation of this campaign's submissions.
  const { data: subs } = await svc
    .from("tier3_submissions")
    .select("athlete_name, ig_handle, school, asset_type, created_at")
    .eq("campaign_id", link.campaign_id);

  const byAthlete = new Map<
    string,
    { name: string; handle: string | null; school: string | null; photos: number; videos: number; lastUpload: string | null }
  >();
  for (const s of subs ?? []) {
    const key = (s.ig_handle || s.athlete_name || "?").toLowerCase().trim();
    const a =
      byAthlete.get(key) ??
      { name: s.athlete_name || "Unknown", handle: s.ig_handle ?? null, school: s.school ?? null, photos: 0, videos: 0, lastUpload: null as string | null };
    if (s.asset_type === "video") a.videos++;
    else if (s.asset_type === "photo") a.photos++;
    if (!a.lastUpload || s.created_at > a.lastUpload) a.lastUpload = s.created_at;
    byAthlete.set(key, a);
  }

  // Roster is a DIRECT read of campaign_rosters keyed to campaign_recaps — not a
  // bridge. Empty until the tracker-sheet import populates it; wiring the read
  // now makes "not started" and the list's 42/54 light up automatically then.
  const { data: roster } = await svc
    .from("campaign_rosters")
    .select("first_name, last_name, ig_handle, school")
    .eq("campaign_id", link.campaign_id);
  const rosterRows = roster ?? [];

  const submittedKeys = new Set([...byAthlete.keys()]);

  const submittedAthletes = [...byAthlete.values()].map((a) => ({
    ...a,
    total: a.photos + a.videos,
    belowMinimum: a.photos < link.min_photos || a.videos < link.min_videos,
    notStarted: false,
  }));

  // Roster athletes who haven't submitted, matched on ig_handle (fallback name).
  const notStartedAthletes = rosterRows
    .filter((r) => {
      const key = (r.ig_handle || `${r.first_name ?? ""} ${r.last_name ?? ""}`).toLowerCase().trim();
      return key && !submittedKeys.has(key);
    })
    .map((r) => ({
      name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || (r.ig_handle ?? "Unknown"),
      handle: r.ig_handle ?? null,
      school: r.school ?? null,
      photos: 0,
      videos: 0,
      total: 0,
      lastUpload: null as string | null,
      belowMinimum: true,
      notStarted: true,
    }));

  const athletes = [...submittedAthletes, ...notStartedAthletes];
  athletes.sort((x, y) => (y.lastUpload ?? "").localeCompare(x.lastUpload ?? ""));

  return NextResponse.json({
    link: {
      token: link.token,
      active: link.active,
      revokedAt: link.revoked_at,
      sentAt: link.sent_at,
      expiresAt: link.expires_at,
      createdAt: link.created_at,
      createdByName,
      minPhotos: link.min_photos,
      minVideos: link.min_videos,
      maxFiles: link.max_files,
      deliverables: link.deliverables,
      briefUrl: link.brief_url,
    },
    campaign: recap
      ? {
          id: recap.id,
          name: recap.name,
          brandName: recap.client_name,
          brandLogoUrl: recap.brand?.logo_light_url ?? recap.brand?.logo_primary_url ?? null,
          adminId: recap.admin_campaign_id,
          driveFolderId: recap.drive_folder_id,
        }
      : null,
    stats: {
      submitted: submittedAthletes.length,
      filesReceived: (subs ?? []).length,
      belowMinimum: submittedAthletes.filter((a) => a.belowMinimum).length,
      notStarted: rosterRows.length > 0 ? notStartedAthletes.length : null, // — until roster populates
      rosterSize: rosterRows.length,
    },
    athletes,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const svc = createServiceSupabase();
  const token = params.token;

  if (body?.action === "revoke") {
    const { error } = await svc
      .from("submission_links")
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq("token", token);
    if (error) return NextResponse.json({ error: "Couldn't revoke." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "regenerate") {
    const newToken = randomBytes(12).toString("hex");
    const { error } = await svc
      .from("submission_links")
      .update({ token: newToken, active: true, revoked_at: null, sent_at: null })
      .eq("token", token);
    if (error) return NextResponse.json({ error: "Couldn't regenerate." }, { status: 500 });
    return NextResponse.json({ ok: true, token: newToken });
  }

  if (body?.action === "repoint") {
    const campaignId = String(body?.campaignId ?? "").trim();
    if (!UUID_RE.test(campaignId)) {
      return NextResponse.json({ error: "That doesn't look like a campaign ID." }, { status: 400 });
    }
    const { data: recap } = await svc.from("campaign_recaps").select("id").eq("id", campaignId).single();
    if (!recap) return NextResponse.json({ error: "No campaign with that ID." }, { status: 404 });
    const { error } = await svc.from("submission_links").update({ campaign_id: campaignId }).eq("token", token);
    if (error) return NextResponse.json({ error: "Couldn't re-point the form." }, { status: 500 });
    return NextResponse.json({ ok: true, campaignId });
  }

  if (body?.action === "set-folder") {
    const folderId = extractDriveFolderId(String(body?.driveUrl ?? ""));
    if (!folderId) {
      return NextResponse.json({ error: "Couldn't read a Drive folder from that link." }, { status: 400 });
    }
    const { data: link } = await svc.from("submission_links").select("campaign_id").eq("token", token).single();
    if (!link) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    const { error } = await svc
      .from("campaign_recaps")
      .update({ drive_folder_id: folderId })
      .eq("id", link.campaign_id);
    if (error) return NextResponse.json({ error: "Couldn't set the Drive folder." }, { status: 500 });
    return NextResponse.json({ ok: true, driveFolderId: folderId });
  }

  if (body?.action === "update-settings") {
    const { data: existing } = await svc
      .from("submission_links")
      .select("active")
      .eq("token", token)
      .single();
    if (!existing) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    // A revoked link that still accepts edits is a confusing state: the
    // settings would apply to something nobody can open.
    if (!existing.active) return NextResponse.json({ error: "This form is revoked." }, { status: 400 });

    const clampInt = (v: any, def: number, min: number, max: number) => {
      const n = Number.isFinite(v) ? Math.round(v) : def;
      return Math.min(max, Math.max(min, n));
    };

    // Null is a real value here, not a missing one — it's how the athlete page
    // is told to omit the deliverables line.
    let deliverables: number | null = null;
    if (body?.deliverables != null) {
      if (!Number.isFinite(body.deliverables)) {
        return NextResponse.json({ error: "Deliverables must be a number or off." }, { status: 400 });
      }
      deliverables = clampInt(body.deliverables, 1, 1, 99);
    }

    let briefUrl: string | null = null;
    if (body?.briefUrl != null) {
      const raw = String(body.briefUrl).trim();
      if (raw) {
        if (!raw.startsWith("https://")) {
          return NextResponse.json({ error: "Brief link must start with https://" }, { status: 400 });
        }
        briefUrl = raw;
      }
    }

    let expiresAt: string | null = null;
    if (body?.expiresAt != null) {
      const raw = String(body.expiresAt).trim();
      if (raw) {
        const t = new Date(raw).getTime();
        if (Number.isNaN(t)) {
          return NextResponse.json({ error: "That expiry date isn't a real date." }, { status: 400 });
        }
        if (t <= Date.now()) {
          return NextResponse.json({ error: "Expiry date must be in the future." }, { status: 400 });
        }
        expiresAt = new Date(t).toISOString();
      }
    }

    const { error } = await svc
      .from("submission_links")
      .update({
        min_photos: clampInt(body?.minPhotos, 3, 0, 50),
        min_videos: clampInt(body?.minVideos, 1, 0, 50),
        max_files: clampInt(body?.maxFiles, 25, 1, 100),
        deliverables,
        brief_url: briefUrl,
        expires_at: expiresAt,
      })
      .eq("token", token);
    if (error) {
      console.error("[submission-forms] update-settings failed:", error.message);
      return NextResponse.json({ error: "Couldn't save those settings." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
