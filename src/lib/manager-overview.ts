// ============================================================
// Campaign manager overview — server data layer
//
// Rolls up the athlete pipeline per campaign for the staff overview page.
// Uses a fixed, small number of grouped reads (campaigns, opt-ins,
// deliverables, compliance flags) — never N+1 per card.
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";

export const FUNNEL_STAGES: { key: string; label: string; statuses: string[]; needsAction?: boolean }[] = [
  { key: "to_upload", label: "To upload", statuses: ["to_upload", "changes_requested"] },
  { key: "uploaded", label: "Uploaded", statuses: ["uploaded"] },
  { key: "in_review", label: "In review", statuses: ["in_review"], needsAction: true },
  { key: "approved", label: "Approved", statuses: ["approved", "to_post"] },
  { key: "pending_verification", label: "Pending verify", statuses: ["pending_verification"], needsAction: true },
  { key: "verified", label: "Verified", statuses: ["verified"] },
  { key: "paid", label: "Paid", statuses: ["paid"] },
];

const DEADLINE_SOON_DAYS = 3;

export type CampaignRollup = {
  id: string;
  slug: string;
  title: string;
  status: string;
  brandName: string | null;
  brandLogo: string | null;
  deadline: string | null;
  deadlineState: "none" | "ok" | "soon" | "overdue";
  optinCount: number;
  funnel: Record<string, number>;
  totalDeliverables: number;
  inReview: number;
  pendingVerification: number;
  complianceFlags: number;
  incomplete: number; // deliverables not yet verified/paid
};

export type ManagerOverview = {
  campaigns: CampaignRollup[];
  totals: { activeCampaigns: number; needsAction: number; overdue: number };
};

function deadlineState(deadline: string | null, incomplete: number): CampaignRollup["deadlineState"] {
  if (!deadline) return "none";
  const t = new Date(deadline).getTime();
  const now = Date.now();
  if (t < now) return incomplete > 0 ? "overdue" : "ok";
  if (t < now + DEADLINE_SOON_DAYS * 86400_000) return "soon";
  return "ok";
}

export async function getManagerOverview(): Promise<ManagerOverview> {
  const service = createServiceSupabase();

  // 1) Active campaigns = live deals + any campaign that has opt-ins.
  const [{ data: liveCampaigns }, { data: optins }] = await Promise.all([
    service.from("optin_campaigns").select("id,slug,title,status,deadline,brand:brands(name,logo_url)").eq("status", "live"),
    service.from("athlete_campaign_optins").select("optin_campaign_id"),
  ]);

  const campaignById = new Map<string, any>();
  for (const c of liveCampaigns ?? []) campaignById.set(c.id, c);

  const optinCountByCampaign = new Map<string, number>();
  const activeIds = new Set<string>(campaignById.keys());
  for (const o of optins ?? []) {
    activeIds.add(o.optin_campaign_id);
    optinCountByCampaign.set(o.optin_campaign_id, (optinCountByCampaign.get(o.optin_campaign_id) ?? 0) + 1);
  }

  // Pull any opt-in-only campaigns not already loaded.
  const missing = Array.from(activeIds).filter((id) => !campaignById.has(id));
  if (missing.length > 0) {
    const { data: more } = await service
      .from("optin_campaigns")
      .select("id,slug,title,status,deadline,brand:brands(name,logo_url)")
      .in("id", missing);
    for (const c of more ?? []) campaignById.set(c.id, c);
  }

  const ids = Array.from(campaignById.keys());
  if (ids.length === 0) return { campaigns: [], totals: { activeCampaigns: 0, needsAction: 0, overdue: 0 } };

  // 2) Deliverable funnel + 3) compliance flags — one grouped read each.
  const [{ data: delivs }, { data: flags }] = await Promise.all([
    service.from("athlete_deliverables").select("optin_campaign_id,status").in("optin_campaign_id", ids),
    service.from("content_evaluations").select("optin_campaign_id").in("optin_campaign_id", ids).eq("compliance_pass", false),
  ]);

  const funnelByCampaign = new Map<string, Record<string, number>>();
  const statusToStage = new Map<string, string>();
  for (const s of FUNNEL_STAGES) for (const st of s.statuses) statusToStage.set(st, s.key);

  for (const d of delivs ?? []) {
    const f = funnelByCampaign.get(d.optin_campaign_id) ?? {};
    const stage = statusToStage.get(d.status) ?? "to_upload";
    f[stage] = (f[stage] ?? 0) + 1;
    funnelByCampaign.set(d.optin_campaign_id, f);
  }

  const flagsByCampaign = new Map<string, number>();
  for (const f of flags ?? []) flagsByCampaign.set(f.optin_campaign_id, (flagsByCampaign.get(f.optin_campaign_id) ?? 0) + 1);

  // Assemble.
  const campaigns: CampaignRollup[] = ids.map((id) => {
    const c = campaignById.get(id);
    const brand = Array.isArray(c.brand) ? c.brand[0] : c.brand;
    const funnel = funnelByCampaign.get(id) ?? {};
    const totalDeliverables = Object.values(funnel).reduce((a, b) => a + b, 0);
    const inReview = funnel["in_review"] ?? 0;
    const pendingVerification = funnel["pending_verification"] ?? 0;
    const complianceFlags = flagsByCampaign.get(id) ?? 0;
    const incomplete = totalDeliverables - (funnel["verified"] ?? 0) - (funnel["paid"] ?? 0);
    return {
      id,
      slug: c.slug,
      title: c.title,
      status: c.status,
      brandName: brand?.name ?? null,
      brandLogo: brand?.logo_url ?? null,
      deadline: c.deadline ?? null,
      deadlineState: deadlineState(c.deadline ?? null, incomplete),
      optinCount: optinCountByCampaign.get(id) ?? 0,
      funnel,
      totalDeliverables,
      inReview,
      pendingVerification,
      complianceFlags,
      incomplete,
    };
  });

  // Sort: most needs-action first, then by deadline urgency.
  const needsActionOf = (c: CampaignRollup) => c.inReview + c.pendingVerification + c.complianceFlags;
  campaigns.sort((a, b) => {
    const order = { overdue: 0, soon: 1, ok: 2, none: 3 } as const;
    return needsActionOf(b) - needsActionOf(a) || order[a.deadlineState] - order[b.deadlineState];
  });

  const totals = {
    activeCampaigns: campaigns.length,
    needsAction: campaigns.reduce((a, c) => a + needsActionOf(c), 0),
    overdue: campaigns.filter((c) => c.deadlineState === "overdue").length,
  };

  return { campaigns, totals };
}
