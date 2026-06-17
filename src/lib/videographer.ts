// ============================================================
// Videographer upload links — server helpers
//
// A token scoped to ONE athlete + ONE campaign. The public /v/[token] page
// validates the token with the service role (no user session) and can ONLY
// ever write to that one athlete+campaign's deliverables.
// ============================================================

import { randomBytes } from "crypto";
import { createServiceSupabase } from "@/lib/supabase-server";
import { ensureDeliverables } from "@/lib/athlete-deliverables";

// Upload constraints enforced on both the sign + register steps.
export const VIDEOGRAPHER_BUCKET = "campaign-media";
export const MAX_PHOTO_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

export function isAllowedType(contentType: string): "image" | "video" | null {
  if (typeof contentType !== "string") return null;
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return null;
}

export function maxBytesFor(kind: "image" | "video"): number {
  return kind === "video" ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
}

// 32-char url-safe, ~144 bits of entropy.
export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export type ValidLink = {
  linkId: string;
  athleteId: string;
  optinCampaignId: string;
};

// Validate a public token: exists, not revoked, not expired. Service role.
export async function validateVideographerToken(token: string): Promise<ValidLink | null> {
  if (!token || typeof token !== "string" || token.length < 16) return null;
  const service = createServiceSupabase();
  const { data, error } = await service
    .from("videographer_upload_links")
    .select("id,athlete_id,optin_campaign_id,revoked,expires_at")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  return { linkId: data.id, athleteId: data.athlete_id, optinCampaignId: data.optin_campaign_id };
}

// Make sure the athlete is participating in the deal and the feed/reel
// deliverable rows exist. Idempotent. Returns the opt-in id.
export async function ensureParticipation(athleteId: string, campaignId: string): Promise<string | null> {
  const service = createServiceSupabase();

  const { data: campaign } = await service
    .from("optin_campaigns")
    .select("id,required_deliverables")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return null;

  let { data: optin } = await service
    .from("athlete_campaign_optins")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("optin_campaign_id", campaignId)
    .maybeSingle();

  if (!optin) {
    const { data: inserted, error } = await service
      .from("athlete_campaign_optins")
      .insert({ athlete_id: athleteId, optin_campaign_id: campaignId, status: "opted_in", ftc_ack: false })
      .select("id")
      .single();
    if (error) {
      // Unique race → re-read.
      const { data: re } = await service
        .from("athlete_campaign_optins")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("optin_campaign_id", campaignId)
        .maybeSingle();
      optin = re ?? null;
    } else {
      optin = inserted;
    }
  }
  if (!optin) return null;

  await ensureDeliverables(optin.id, athleteId, campaignId, (campaign as any).required_deliverables);
  return optin.id;
}

// Create a link (after ensuring participation). Returns the token + relative path.
export async function createVideographerLink(opts: {
  athleteId: string;
  campaignId: string;
  createdBy: string;
  label?: string | null;
}): Promise<{ token: string; path: string } | null> {
  const service = createServiceSupabase();
  const optinId = await ensureParticipation(opts.athleteId, opts.campaignId);
  if (!optinId) return null;

  const token = generateToken();
  const { error } = await service.from("videographer_upload_links").insert({
    token,
    athlete_id: opts.athleteId,
    optin_campaign_id: opts.campaignId,
    created_by: opts.createdBy,
    label: opts.label ?? null,
  });
  if (error) {
    console.error("createVideographerLink error:", error.message);
    return null;
  }
  return { token, path: `/v/${token}` };
}
