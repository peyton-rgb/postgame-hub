// src/app/api/submission-forms/campaigns/route.ts
// ─────────────────────────────────────────────────────────────
// Staff-only. Campaign picker for "New submission form" — active
// campaigns only, grouped by brand.
//
// "Active" is ColdFusion's answer, not ours: admin_campaigns.status =
// 'Active', joined to campaign_recaps on admin_campaign_id. That column is
// text on the recap side and integer on the admin side, so the ids are
// compared as strings. 57 of 605 admin campaigns are Active, landing on 57
// recaps across 16 brands — small enough that there is no pagination here.
//
// Still FLAG-ONLY on folders: we surface driveFolderId / hasBrandFolder so the
// picker can show what will happen, we do NOT create anything (no Drive writes
// from this surface).
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const svc = createServiceSupabase();

  // ColdFusion is the source of truth for "still running". admin_id is an
  // integer here and text on campaign_recaps — compare as strings, never
  // assume the types line up.
  const { data: adminRows } = await svc.from("admin_campaigns").select("admin_id").eq("status", "Active");
  const activeAdminIds = [...new Set((adminRows ?? []).map((a) => String(a.admin_id)))];
  if (!activeAdminIds.length) return NextResponse.json({ brands: [] });

  const { data: recaps } = await svc
    .from("campaign_recaps")
    // Logo and folder state come from the linked brand, not
    // campaign_recaps.client_logo_url: that column is set on a negligible
    // handful of campaigns, while brand_id is set on all of them. Nested
    // through the campaigns_brand_id_fkey FK, so no 2nd query.
    .select(
      "id, name, admin_campaign_id, drive_folder_id, brief_url, admin_created_on, brand:brands!campaigns_brand_id_fkey(id, name, logo_light_url, logo_primary_url, drive_parent_folder_id)"
    )
    .in("admin_campaign_id", activeAdminIds);

  const { data: links } = await svc.from("submission_links").select("campaign_id").eq("active", true);
  const withActiveLink = new Set((links ?? []).map((l) => l.campaign_id));

  type Campaign = {
    id: string;
    name: string;
    adminId: string | null;
    driveFolderId: string | null;
    briefUrl: string | null;
    hasActiveLink: boolean;
    createdOn: string | null;
  };
  type Brand = {
    id: string;
    name: string;
    logoUrl: string | null;
    activeCount: number;
    hasBrandFolder: boolean;
    campaigns: Campaign[];
  };

  // Group by brand_id, never by client_name — that column is free text.
  // A recap with no linked brand can't be grouped, so it's dropped rather
  // than bucketed into a fake "Unknown" brand.
  const byBrand = new Map<string, Brand>();
  for (const r of recaps ?? []) {
    const b = r.brand;
    if (!b) continue;
    let bucket = byBrand.get(b.id);
    if (!bucket) {
      bucket = {
        id: b.id,
        name: b.name,
        logoUrl: b.logo_light_url ?? b.logo_primary_url ?? null,
        activeCount: 0,
        hasBrandFolder: !!b.drive_parent_folder_id,
        campaigns: [],
      };
      byBrand.set(b.id, bucket);
    }
    bucket.campaigns.push({
      id: r.id,
      name: r.name,
      adminId: r.admin_campaign_id,
      driveFolderId: r.drive_folder_id,
      briefUrl: r.brief_url,
      hasActiveLink: withActiveLink.has(r.id),
      createdOn: r.admin_created_on,
    });
    bucket.activeCount++;
  }

  const brands = [...byBrand.values()]
    .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name))
    .map((b) => ({
      ...b,
      // Newest first, undated last.
      campaigns: b.campaigns.sort((x, y) => {
        if (!x.createdOn && !y.createdOn) return x.name.localeCompare(y.name);
        if (!x.createdOn) return 1;
        if (!y.createdOn) return -1;
        return y.createdOn.localeCompare(x.createdOn);
      }),
    }));

  return NextResponse.json({ brands });
}
