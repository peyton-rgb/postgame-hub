// ============================================================
// Athlete deliverables — server data layer
//
// Loads the athlete's opt-ins, the deal/brand, and the per-slot deliverable
// rows, lazily creating any missing deliverable rows (so opt-ins made before
// the deliverables table existed still get their feed/reel rows). Uses the
// service client scoped to the verified athlete_id.
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";
import {
  computeDealStage,
  getRequiredSlots,
  type DealStage,
  type DeliverableStatus,
} from "@/lib/deliverable-status";

export type Deliverable = {
  id: string;
  optin_id: string;
  slot: string;
  status: DeliverableStatus;
  media_id: string | null;
  live_url: string | null;
  review_note: string | null;
  media?: {
    id: string;
    file_url: string;
    thumbnail_url: string | null;
    type: string | null;
    content_type: string | null;
    file_size_bytes: number | null;
  } | null;
};

export type DealParticipation = {
  optinId: string;
  campaignId: string;
  slug: string;
  title: string;
  brandName: string | null;
  brandLogo: string | null;
  heroImage: string | null;
  payout: string | null;
  requirements: string | null;
  goal: string | null;
  deliverables: Deliverable[];
  stage: DealStage;
};

// Insert any missing deliverable rows for an opt-in based on the deal's
// required slots. Idempotent.
export async function ensureDeliverables(
  optinId: string,
  athleteId: string,
  campaignId: string,
  requiredSlots: string[] | null | undefined
): Promise<void> {
  const service = createServiceSupabase();
  const slots = getRequiredSlots(requiredSlots);
  const { data: existing } = await service
    .from("athlete_deliverables")
    .select("slot")
    .eq("optin_id", optinId);
  const have = new Set((existing ?? []).map((r: any) => r.slot));
  const toCreate = slots
    .filter((s) => !have.has(s))
    .map((slot) => ({
      optin_id: optinId,
      athlete_id: athleteId,
      optin_campaign_id: campaignId,
      slot,
      status: "to_upload",
    }));
  if (toCreate.length) {
    const { error } = await service.from("athlete_deliverables").insert(toCreate);
    if (error && (error as any).code !== "23505") {
      console.error("ensureDeliverables insert error:", error.message);
    }
  }
}

const DELIV_SELECT =
  "id,optin_id,slot,status,media_id,live_url,review_note,media:media(id,file_url,thumbnail_url,type,content_type,file_size_bytes)";

function normalizeDeliverable(row: any): Deliverable {
  const media = Array.isArray(row?.media) ? row.media[0] ?? null : row?.media ?? null;
  return { ...row, media } as Deliverable;
}

// All of the athlete's deals with progress, newest first.
export async function getMyDeals(athleteId: string): Promise<DealParticipation[]> {
  const service = createServiceSupabase();

  const { data: optins, error } = await service
    .from("athlete_campaign_optins")
    .select(
      "id,optin_campaign_id,created_at,campaign:optin_campaigns(id,slug,title,payout,requirements,goal,hero_image_url,required_deliverables,brand:brands(name,logo_url,logo_white_url))"
    )
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getMyDeals error:", error.message);
    return [];
  }

  const result: DealParticipation[] = [];
  for (const o of optins ?? []) {
    const campaign = Array.isArray((o as any).campaign) ? (o as any).campaign[0] : (o as any).campaign;
    if (!campaign) continue;
    const brand = Array.isArray(campaign.brand) ? campaign.brand[0] : campaign.brand;

    await ensureDeliverables(o.id, athleteId, campaign.id, campaign.required_deliverables);

    const { data: delivRows } = await service
      .from("athlete_deliverables")
      .select(DELIV_SELECT)
      .eq("optin_id", o.id)
      .order("slot", { ascending: true });

    const deliverables = (delivRows ?? []).map(normalizeDeliverable);
    const stage = computeDealStage(deliverables.map((d) => d.status));

    result.push({
      optinId: o.id,
      campaignId: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      brandName: brand?.name ?? null,
      brandLogo: brand?.logo_url ?? brand?.logo_white_url ?? null,
      heroImage: campaign.hero_image_url ?? null,
      payout: campaign.payout ?? null,
      requirements: campaign.requirements ?? null,
      goal: campaign.goal ?? null,
      deliverables,
      stage,
    });
  }
  return result;
}

// One deal for the detail/upload/post screens. Verifies ownership.
export async function getDealParticipation(
  athleteId: string,
  optinId: string
): Promise<DealParticipation | null> {
  const service = createServiceSupabase();
  const { data: o, error } = await service
    .from("athlete_campaign_optins")
    .select(
      "id,optin_campaign_id,athlete_id,campaign:optin_campaigns(id,slug,title,payout,requirements,goal,hero_image_url,required_deliverables,brand:brands(name,logo_url,logo_white_url))"
    )
    .eq("id", optinId)
    .eq("athlete_id", athleteId)
    .maybeSingle();

  if (error || !o) return null;
  const campaign = Array.isArray((o as any).campaign) ? (o as any).campaign[0] : (o as any).campaign;
  if (!campaign) return null;
  const brand = Array.isArray(campaign.brand) ? campaign.brand[0] : campaign.brand;

  await ensureDeliverables(o.id, athleteId, campaign.id, campaign.required_deliverables);

  const { data: delivRows } = await service
    .from("athlete_deliverables")
    .select(DELIV_SELECT)
    .eq("optin_id", o.id)
    .order("slot", { ascending: true });

  const deliverables = (delivRows ?? []).map(normalizeDeliverable);
  const stage = computeDealStage(deliverables.map((d) => d.status));

  return {
    optinId: o.id,
    campaignId: campaign.id,
    slug: campaign.slug,
    title: campaign.title,
    brandName: brand?.name ?? null,
    brandLogo: brand?.logo_url ?? brand?.logo_white_url ?? null,
    heroImage: campaign.hero_image_url ?? null,
    payout: campaign.payout ?? null,
    requirements: campaign.requirements ?? null,
    goal: campaign.goal ?? null,
    deliverables,
    stage,
  };
}
