// src/app/api/submission-forms/campaigns/route.ts
// ─────────────────────────────────────────────────────────────
// Staff-only. Campaign picker for "New submission form" — every
// campaign_recap, flagged by whether it already has a Drive folder
// (only ~100 of 573 do) and whether an active form already exists.
//
// v1 is FLAG-ONLY: we surface the missing-folder state, we do NOT
// create folders here (no Drive writes from this surface — provisioning
// handles folder creation via Apps Script until the service account lands).
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const svc = createServiceSupabase();

  const { data: recaps } = await svc
    .from("campaign_recaps")
    .select("id, name, client_name, client_logo_url, drive_folder_id, admin_campaign_id, status")
    .order("name", { ascending: true });

  const { data: links } = await svc
    .from("submission_links")
    .select("campaign_id")
    .eq("active", true);
  const withActiveLink = new Set((links ?? []).map((l) => l.campaign_id));

  const campaigns = (recaps ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    brandName: r.client_name,
    brandLogoUrl: r.client_logo_url,
    hasFolder: !!r.drive_folder_id,
    hasActiveLink: withActiveLink.has(r.id),
    adminId: r.admin_campaign_id,
    status: r.status,
  }));

  return NextResponse.json({ campaigns });
}
