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
  slot_index: number;
  status: DeliverableStatus;
  live_url: string | null;
  review_note: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  media_type: string | null; // 'image' | 'video'
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
// required slots. Idempotent — this runs on every deals page load.
//
// Multiple instances of a slot are expressed as duplicate entries in
// required_deliverables: ["reel","reel","feed"] means two reels and one feed,
// created as reel-1, reel-2, feed-1. (The previous implementation collapsed
// those duplicates through a Set, so a two-reel campaign got a single reel.)
export async function ensureDeliverables(
  optinId: string,
  athleteId: string,
  campaignId: string,
  requiredSlots: string[] | null | undefined
): Promise<void> {
  const service = createServiceSupabase();
  const slots = getRequiredSlots(requiredSlots);

  // How many of each slot the campaign asks for.
  const wanted: Record<string, number> = {};
  for (const slot of slots) wanted[slot] = (wanted[slot] ?? 0) + 1;

  // Which instances already exist, per slot.
  const { data: existing } = await service
    .from("athlete_deliverables")
    .select("slot,slot_index")
    .eq("optin_id", optinId);
  const taken: Record<string, Set<number>> = {};
  for (const r of (existing ?? []) as { slot: string; slot_index: number }[]) {
    (taken[r.slot] ??= new Set<number>()).add(r.slot_index);
  }

  // Create only the instances that are missing. Nothing is ever deleted or
  // renumbered: if a campaign shrinks from two reels to one, reel-2 stays put
  // — it may already hold an uploaded file. Removing it is a separate decision.
  const toCreate: Record<string, any>[] = [];
  for (const [slot, want] of Object.entries(wanted)) {
    const have = taken[slot] ?? new Set<number>();
    for (let index = 1; index <= want; index++) {
      if (have.has(index)) continue;
      toCreate.push({
        optin_id: optinId,
        athlete_id: athleteId,
        optin_campaign_id: campaignId,
        slot,
        slot_index: index,
        status: "to_upload",
      });
    }
  }

  if (toCreate.length) {
    const { error } = await service.from("athlete_deliverables").insert(toCreate);
    // 23505 is the (optin_id, slot, slot_index) unique constraint doing its job
    // when two concurrent page loads race here. Expected, not worth logging.
    if (error && (error as any).code !== "23505") {
      console.error("ensureDeliverables insert error:", error.message);
    }
  }
}

const DELIV_SELECT =
  "id,optin_id,slot,slot_index,status,live_url,review_note,file_url,thumbnail_url,media_type";

function normalizeDeliverable(row: any): Deliverable {
  return row as Deliverable;
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
      .order("slot", { ascending: true })
      .order("slot_index", { ascending: true });

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
    .order("slot", { ascending: true })
    .order("slot_index", { ascending: true });

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
