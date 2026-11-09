// src/lib/slack-recap/data.ts
// ─────────────────────────────────────────────────────────────
// Data behind the "Request a recap" dropdowns.
//
// Source of truth: campaign_recaps — the canonical campaign entity, kept fresh
// by the daily admin sync (657 campaigns with admin ids as of 2026-11-09).
// NOT admin_campaigns: that cache stopped syncing on 2026-08-11 (max id 1004),
// so recent campaigns like Halloween (1024) are missing from it.
// ─────────────────────────────────────────────────────────────

import { createServiceSupabase } from "@/lib/supabase";
import { normLoose } from "@/lib/admin-campaigns";

export interface SlackOption {
  text: { type: "plain_text"; text: string };
  value: string;
}

/** Slack caps option text at 75 chars and returns at most 100 options. */
function option(text: string, value: string): SlackOption {
  const clipped = text.length > 75 ? `${text.slice(0, 72)}...` : text;
  return { text: { type: "plain_text", text: clipped }, value };
}

function idNum(id: string | null | undefined): number {
  const n = parseInt(String(id ?? ""), 10);
  return Number.isFinite(n) ? n : -1;
}

/** "ID: 1024 (2026 Halloween)" — the label format Peyton asked for. */
export function campaignLabel(c: { admin_campaign_id: string | null; admin_name?: string | null; name: string }): string {
  const name = (c.admin_name || c.name || "").trim();
  return `ID: ${c.admin_campaign_id} (${name})`;
}

/** Brands that have at least one admin-synced campaign, filtered by what the user typed. */
export async function searchBrands(query: string): Promise<SlackOption[]> {
  const supabase = createServiceSupabase();
  const [{ data: brands }, { data: rows }] = await Promise.all([
    supabase.from("brands").select("id, name"),
    supabase.from("campaign_recaps").select("brand_id").not("admin_campaign_id", "is", null),
  ]);
  const withCampaigns = new Set((rows || []).map((r: any) => r.brand_id).filter(Boolean));
  const q = normLoose(query);
  return ((brands as { id: string; name: string }[]) || [])
    .filter((b) => withCampaigns.has(b.id))
    .filter((b) => !q || normLoose(b.name).includes(q))
    .sort((a, b) => a.name.trim().localeCompare(b.name.trim()))
    .slice(0, 100)
    .map((b) => option(b.name.trim(), b.id));
}

/** One brand's campaigns, newest id first, matched on id OR name. */
export async function searchCampaigns(brandId: string, query: string): Promise<SlackOption[]> {
  if (!brandId) return [];
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("campaign_recaps")
    .select("id, name, admin_name, admin_campaign_id")
    .eq("brand_id", brandId)
    .not("admin_campaign_id", "is", null);
  const q = query.trim().toLowerCase();
  const qLoose = normLoose(query);
  return ((data as any[]) || [])
    .filter((c) => {
      if (!q) return true;
      if (String(c.admin_campaign_id).startsWith(q)) return true;
      return normLoose(c.admin_name || "").includes(qLoose) || normLoose(c.name || "").includes(qLoose);
    })
    .sort((a, b) => idNum(b.admin_campaign_id) - idNum(a.admin_campaign_id))
    .slice(0, 100)
    .map((c) => option(campaignLabel(c), c.id));
}

export interface CampaignForRequest {
  id: string;
  name: string;
  admin_name: string | null;
  admin_campaign_id: string | null;
  client_name: string | null;
  brand_id: string | null;
  slug: string;
  published: boolean;
  settings: Record<string, any> | null;
  trackerUrl: string | null;
  contentFolderUrl: string | null;
  contentFolderId: string | null;
  athleteCount: number;
}

export function driveFolderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`;
}

/** Everything the form needs to prefill, plus whether a recap is already built. */
export async function getCampaignForRequest(recapId: string): Promise<CampaignForRequest | null> {
  const supabase = createServiceSupabase();
  const { data: c } = await supabase
    .from("campaign_recaps")
    .select(
      "id, name, admin_name, admin_campaign_id, client_name, brand_id, slug, published, settings, " +
        "tracker_url, tracker_internal_url, drive_folder_id, drive_content_folder_id",
    )
    .eq("id", recapId)
    .maybeSingle();
  if (!c) return null;
  const row = c as any;
  const { count } = await supabase
    .from("athletes")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", recapId);
  const folderId: string | null = row.drive_content_folder_id || row.drive_folder_id || null;
  return {
    id: row.id,
    name: row.name,
    admin_name: row.admin_name,
    admin_campaign_id: row.admin_campaign_id,
    client_name: row.client_name,
    brand_id: row.brand_id,
    slug: row.slug,
    published: !!row.published,
    settings: row.settings,
    trackerUrl: row.tracker_url || row.tracker_internal_url || null,
    contentFolderUrl: folderId ? driveFolderUrl(folderId) : null,
    contentFolderId: folderId,
    athleteCount: count ?? 0,
  };
}

/** A campaign is "already built" once athletes have been imported into it. */
export function isAlreadyBuilt(c: CampaignForRequest): boolean {
  return c.athleteCount > 0;
}
