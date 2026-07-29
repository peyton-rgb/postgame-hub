// src/app/api/submission-forms/route.ts
// ─────────────────────────────────────────────────────────────
// Staff-only. Data behind the Submission Forms list.
//
//   GET  → { metrics, forms }  — one row per submission_links link,
//          joined to campaign_recaps, with submission aggregates.
//   POST → create a new form (mint a token for a campaign_recap).
//
// Roster note: the "42 / 54" fraction needs a roster that lives in the
// campaign's Performance Tracker (a Google Sheet), which nothing syncs
// into Postgres. So today we only ever show the plain submitted count.
// `rosterSize` is returned as null on purpose — a clean seam: if a roster
// count ever lands, fill it and the row renders the fraction. We do NOT
// join campaign_rosters (empty, and keyed to brand_campaigns, not recaps).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const svc = createServiceSupabase();

  const { data: links } = await svc
    .from("submission_links")
    .select("token, campaign_id, active, min_photos, min_videos, max_files, created_at, created_by, expires_at, sent_at, revoked_at")
    .order("created_at", { ascending: false });
  const linkRows = links ?? [];

  const campaignIds = [...new Set(linkRows.map((l) => l.campaign_id))];

  // Campaign metadata for each linked recap.
  const recapsById: Record<string, any> = {};
  if (campaignIds.length) {
    const { data: recaps } = await svc
      .from("campaign_recaps")
      .select("id, name, client_name, client_logo_url, admin_campaign_id, drive_folder_id")
      .in("id", campaignIds);
    for (const r of recaps ?? []) recapsById[r.id] = r;
  }

  // Submission aggregates per campaign. tier3_submissions is one row per file;
  // "submitted" counts distinct athletes (ig_handle ?? name), "files" is rows.
  const agg: Record<string, { athletes: Set<string>; files: number; last: string | null }> = {};
  const monthStart = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  })();
  let submissionsThisMonth = 0;

  if (campaignIds.length) {
    const { data: subs } = await svc
      .from("tier3_submissions")
      .select("campaign_id, ig_handle, athlete_name, created_at")
      .in("campaign_id", campaignIds);
    for (const s of subs ?? []) {
      const c = (agg[s.campaign_id] ??= { athletes: new Set(), files: 0, last: null });
      c.files++;
      const who = (s.ig_handle || s.athlete_name || "").toLowerCase().trim();
      if (who) c.athletes.add(who);
      if (!c.last || s.created_at > c.last) c.last = s.created_at;
      if (s.created_at >= monthStart) submissionsThisMonth++;
    }
  }

  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  const forms = linkRows.map((l) => {
    const c = agg[l.campaign_id];
    const recap = recapsById[l.campaign_id] ?? null;
    return {
      token: l.token,
      active: l.active,
      revokedAt: l.revoked_at,
      sentAt: l.sent_at,
      expiresAt: l.expires_at,
      createdAt: l.created_at,
      createdBy: l.created_by,
      minPhotos: l.min_photos,
      minVideos: l.min_videos,
      maxFiles: l.max_files,
      campaign: recap
        ? {
            id: recap.id,
            name: recap.name,
            brandName: recap.client_name,
            brandLogoUrl: recap.client_logo_url,
            adminId: recap.admin_campaign_id,
            driveFolderId: recap.drive_folder_id,
          }
        : null,
      submittedCount: c ? c.athletes.size : 0,
      fileCount: c ? c.files : 0,
      lastUpload: c ? c.last : null,
      rosterSize: null as number | null, // seam for the future fraction; see header
    };
  });

  const activeForms = linkRows.filter((l) => l.active && !l.revoked_at).length;
  const expiringSoon = linkRows.filter((l) => {
    if (!l.active || l.revoked_at || !l.expires_at) return false;
    const t = new Date(l.expires_at).getTime();
    return t >= now && t - now <= WEEK;
  }).length;

  return NextResponse.json({
    metrics: {
      activeForms,
      submissionsThisMonth,
      athletesOutstanding: null, // needs a roster source; degrade, don't fake it
      expiringSoon,
    },
    forms,
  });
}

export async function POST(req: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const campaignId = String(body?.campaignId ?? "").trim();
  if (!campaignId) return NextResponse.json({ error: "campaignId is required" }, { status: 400 });

  const svc = createServiceSupabase();

  const { data: recap } = await svc.from("campaign_recaps").select("id").eq("id", campaignId).single();
  if (!recap) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const clampInt = (v: any, def: number, min: number, max: number) => {
    const n = Number.isFinite(v) ? Math.round(v) : def;
    return Math.min(max, Math.max(min, n));
  };

  const token = randomBytes(12).toString("hex");
  const { data: inserted, error } = await svc
    .from("submission_links")
    .insert({
      token,
      campaign_id: campaignId,
      active: true,
      min_photos: clampInt(body?.minPhotos, 3, 0, 50),
      min_videos: clampInt(body?.minVideos, 1, 0, 50),
      max_files: clampInt(body?.maxFiles, 25, 1, 100),
      created_by: staff.id,
    })
    .select("token")
    .single();

  if (error || !inserted) {
    console.error("[submission-forms] create failed:", error?.message);
    return NextResponse.json({ error: "Couldn't create the form." }, { status: 500 });
  }

  return NextResponse.json({ token: inserted.token });
}
