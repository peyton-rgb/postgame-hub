// ============================================================
// Auto Editor — the curator (Phase 2)
//
// Scores a deal's uploaded content against the brief + house checklist and
// surfaces the best, de-duplicated picks. PHOTOS are scored by a vision model
// (Anthropic, ANTHROPIC_API_KEY). VIDEOS get a PRELIMINARY evaluation only —
// no frame analysis until the Edit Engine's Twelve Labs layer (see
// docs/auto-editor/EDIT-ENGINE-HANDOFF.md). Compliance is a HARD GATE.
//
// STUB-SAFE: without an API key, returns clearly-labelled placeholder scores
// and persists them so the rest of the flow works.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import { createServiceSupabase } from "@/lib/supabase-server";
import { notifyManagers, dealContext } from "@/lib/manager-notify";

// claude-api skill default. Override per-deploy for cost (e.g. claude-sonnet-4-6).
const MODEL = process.env.AUTO_EDITOR_MODEL || "claude-opus-4-8";
const MAX_PHOTOS = 16; // cap images per run; anything beyond is logged, not silently dropped
const TOP_PICK_MAX = 10;

type Deliverable = {
  id: string;
  slot: string;
  media_type: string | null;
  file_url: string | null;
  status: string;
};

type CategoryScores = {
  authenticity: number;
  compliance: number;
  performance: number;
  brand: number;
  technical: number;
};

export type Evaluation = {
  deliverable_id: string;
  slot: string;
  scores: CategoryScores;
  overall: number;
  compliance_pass: boolean;
  compliance_flags: string[];
  dedupe_group: number | null;
  rationale: string;
  is_preliminary: boolean;
};

export type AutoEditorResult = {
  stubbed: boolean;
  model: string;
  count: number;
  topPickIds: string[];
  evaluations: (Evaluation & { is_top_pick: boolean; rank: number | null })[];
};

// Category weights mirror the house checklist priority.
const WEIGHTS: CategoryScores = { authenticity: 5, performance: 3, brand: 2, technical: 1, compliance: 4 };

function blendedOverall(s: CategoryScores): number {
  // Lean on social-performance + brand-fit + quality + authenticity; compliance
  // is a gate, not a big score contributor.
  const w = WEIGHTS;
  const total = w.authenticity + w.performance + w.brand + w.technical;
  const blended = (s.authenticity * w.authenticity + s.performance * w.performance + s.brand * w.brand + s.technical * w.technical) / total;
  return Math.round(blended);
}

function clamp(n: any): number {
  const v = Number(n);
  if (!isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

// JSON schema for the forced scoring tool.
const SCORE_TOOL = {
  name: "submit_evaluations",
  description: "Submit a structured evaluation for each numbered content item.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      evaluations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            index: { type: "integer", description: "The item number shown in the prompt." },
            authenticity: { type: "integer", description: "0-100" },
            compliance: { type: "integer", description: "0-100" },
            performance: { type: "integer", description: "0-100" },
            brand: { type: "integer", description: "0-100" },
            technical: { type: "integer", description: "0-100" },
            compliance_pass: { type: "boolean", description: "false if any HARD-GATE compliance rule fails" },
            compliance_flags: { type: "array", items: { type: "string" }, description: "specific compliance problems" },
            dedupe_group: { type: "integer", description: "near-identical items share the same group number; unique shots get their own" },
            rationale: { type: "string", description: "one line: why this scores the way it does" },
          },
          required: ["index", "authenticity", "compliance", "performance", "brand", "technical", "compliance_pass", "compliance_flags", "dedupe_group", "rationale"],
        },
      },
    },
    required: ["evaluations"],
  },
} as const;

function checklistText(items: any[], mode: "photo" | "video"): string {
  const lines = items
    .filter((i) => (i.applies_to || []).includes(mode))
    .map((i) => `- [${i.category}${i.is_hard_gate ? " · HARD GATE" : ""}] ${i.rule}`);
  return lines.join("\n");
}

function briefText(deal: any): string {
  const parts: string[] = [];
  if (deal?.brand?.name) parts.push(`Brand: ${deal.brand.name}`);
  if (deal?.title) parts.push(`Campaign: ${deal.title}`);
  if (deal?.requirements) parts.push(`Requirements: ${deal.requirements}`);
  if (deal?.goal) parts.push(`Goal: ${deal.goal}`);
  return parts.join("\n");
}

// Map a model evaluation object onto our shape.
function shapeEval(raw: any, deliverable: Deliverable, preliminary: boolean): Evaluation {
  const scores: CategoryScores = {
    authenticity: clamp(raw?.authenticity),
    compliance: clamp(raw?.compliance),
    performance: clamp(raw?.performance),
    brand: clamp(raw?.brand),
    technical: clamp(raw?.technical),
  };
  return {
    deliverable_id: deliverable.id,
    slot: deliverable.slot,
    scores,
    overall: blendedOverall(scores),
    compliance_pass: raw?.compliance_pass !== false,
    compliance_flags: Array.isArray(raw?.compliance_flags) ? raw.compliance_flags.filter((x: any) => typeof x === "string") : [],
    dedupe_group: typeof raw?.dedupe_group === "number" ? raw.dedupe_group : null,
    rationale: typeof raw?.rationale === "string" ? raw.rationale : "",
    is_preliminary: preliminary,
  };
}

function stubEval(d: Deliverable, preliminary: boolean): Evaluation {
  const base: CategoryScores = { authenticity: 60, compliance: 70, performance: 60, brand: 60, technical: 65 };
  return {
    deliverable_id: d.id,
    slot: d.slot,
    scores: base,
    overall: blendedOverall(base),
    compliance_pass: true,
    compliance_flags: [],
    dedupe_group: null,
    rationale: preliminary
      ? "Preliminary — full video analysis pending Edit Engine."
      : "Placeholder score — ANTHROPIC_API_KEY not configured (TODO).",
    is_preliminary: preliminary,
  };
}

async function callScoreTool(client: Anthropic, content: any[]): Promise<any[]> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    tools: [SCORE_TOOL as any],
    tool_choice: { type: "tool", name: SCORE_TOOL.name },
    messages: [{ role: "user", content }],
  });
  const block: any = res.content.find((b: any) => b.type === "tool_use");
  return Array.isArray(block?.input?.evaluations) ? block.input.evaluations : [];
}

export async function runAutoEditor(athleteId: string, campaignId: string): Promise<AutoEditorResult> {
  const service = createServiceSupabase();

  const [{ data: checklist }, { data: deal }, { data: delivRows }] = await Promise.all([
    service.from("house_checklist_items").select("category,rule,applies_to,is_hard_gate").eq("active", true),
    service
      .from("optin_campaigns")
      .select("id,title,requirements,goal,brand:brands(name)")
      .eq("id", campaignId)
      .maybeSingle(),
    service
      .from("athlete_deliverables")
      .select("id,slot,media_type,file_url,status")
      .eq("optin_campaign_id", campaignId)
      .eq("athlete_id", athleteId)
      .in("status", ["uploaded", "in_review", "changes_requested", "approved", "to_post", "pending_verification", "verified"])
      .not("file_url", "is", null),
  ]);

  const dealNorm = deal ? { ...deal, brand: Array.isArray((deal as any).brand) ? (deal as any).brand[0] : (deal as any).brand } : null;
  const deliverables = (delivRows ?? []) as Deliverable[];
  const photos = deliverables.filter((d) => d.media_type !== "video");
  const videos = deliverables.filter((d) => d.media_type === "video");

  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const evals: Evaluation[] = [];
  let stubbed = !hasKey;

  if (hasKey && deliverables.length > 0) {
    const client = new Anthropic();
    try {
      // ── Photos: one vision call with all images ──
      const usePhotos = photos.slice(0, MAX_PHOTOS);
      if (photos.length > MAX_PHOTOS) console.warn(`[auto-editor] ${photos.length} photos; scoring first ${MAX_PHOTOS}.`);
      if (usePhotos.length > 0) {
        const content: any[] = [];
        usePhotos.forEach((d, i) => {
          content.push({ type: "text", text: `Item ${i} — ${d.slot} photo:` });
          content.push({ type: "image", source: { type: "url", url: d.file_url } });
        });
        content.push({
          type: "text",
          text:
            `You are Postgame's content curator. Score each numbered photo (0-100 per category) for this deal.\n\n` +
            `THE BRIEF:\n${briefText(dealNorm) || "(none provided)"}\n\n` +
            `THE HOUSE CHECKLIST (photo rules):\n${checklistText(checklist ?? [], "photo")}\n\n` +
            `Rules: Compliance items marked HARD GATE — if any fails, set compliance_pass=false and list the specific flag(s). ` +
            `Group near-identical shots with the same dedupe_group (unique shots get their own). Be honest and specific in one-line rationales. ` +
            `Call submit_evaluations with one entry per item index.`,
        });
        const raw = await callScoreTool(client, content);
        const byIndex = new Map<number, any>();
        for (const r of raw) byIndex.set(r.index, r);
        usePhotos.forEach((d, i) => {
          const r = byIndex.get(i);
          evals.push(r ? shapeEval(r, d, false) : stubEval(d, false));
        });
        // Any photos beyond the cap → stubbed placeholders so they still appear.
        photos.slice(MAX_PHOTOS).forEach((d) => evals.push(stubEval(d, false)));
      }

      // ── Videos: preliminary (brief + checklist + metadata, no frames) ──
      if (videos.length > 0) {
        const content: any[] = [
          {
            type: "text",
            text:
              `Give a PRELIMINARY evaluation (0-100 per category) for each numbered VIDEO deliverable. ` +
              `You CANNOT watch the footage — judge only from the brief, the checklist, and the slot. ` +
              `Be conservative; mark uncertainty in the rationale. Do not invent frame-level judgments.\n\n` +
              videos.map((d, i) => `Item ${i} — ${d.slot} video (file present, not analyzed).`).join("\n") +
              `\n\nTHE BRIEF:\n${briefText(dealNorm) || "(none provided)"}\n\n` +
              `THE HOUSE CHECKLIST (video rules):\n${checklistText(checklist ?? [], "video")}\n\n` +
              `For compliance you cannot fully verify audio/music from metadata — pass unless the brief itself implies a problem, and note the limitation. Call submit_evaluations.`,
          },
        ];
        const raw = await callScoreTool(client, content);
        const byIndex = new Map<number, any>();
        for (const r of raw) byIndex.set(r.index, r);
        videos.forEach((d, i) => {
          const r = byIndex.get(i);
          evals.push(r ? shapeEval(r, d, true) : stubEval(d, true));
        });
      }
    } catch (e: any) {
      console.error("[auto-editor] scoring failed, falling back to stub:", e?.message || e);
      stubbed = true;
      evals.length = 0;
      photos.forEach((d) => evals.push(stubEval(d, false)));
      videos.forEach((d) => evals.push(stubEval(d, true)));
    }
  } else {
    // No key (or nothing to score): stub everything.
    photos.forEach((d) => evals.push(stubEval(d, false)));
    videos.forEach((d) => evals.push(stubEval(d, true)));
  }

  // ── Top-pick selection: compliance gate → dedupe → rank by overall ──
  const eligible = evals.filter((e) => e.compliance_pass);
  const bestPerGroup = new Map<string, Evaluation>();
  for (const e of eligible) {
    // Items without a dedupe_group are each their own group (keyed by id).
    const key = e.dedupe_group != null ? `g${e.dedupe_group}` : `id:${e.deliverable_id}`;
    const cur = bestPerGroup.get(key);
    if (!cur || e.overall > cur.overall) bestPerGroup.set(key, e);
  }
  const ranked = Array.from(bestPerGroup.values()).sort((a, b) => b.overall - a.overall);
  const topPickIds = new Set(ranked.slice(0, TOP_PICK_MAX).map((e) => e.deliverable_id));
  const rankById = new Map<string, number>();
  ranked.slice(0, TOP_PICK_MAX).forEach((e, i) => rankById.set(e.deliverable_id, i + 1));

  // ── Persist (upsert by deliverable_id) ──
  const now = new Date().toISOString();
  const rows = evals.map((e) => ({
    deliverable_id: e.deliverable_id,
    optin_campaign_id: campaignId,
    athlete_id: athleteId,
    overall_score: e.overall,
    scores: e.scores,
    compliance_pass: e.compliance_pass,
    compliance_flags: e.compliance_flags,
    is_top_pick: topPickIds.has(e.deliverable_id),
    rank: rankById.get(e.deliverable_id) ?? null,
    dedupe_group: e.dedupe_group,
    rationale: e.rationale,
    is_preliminary: e.is_preliminary,
    model: stubbed ? "stub" : MODEL,
    evaluated_at: now,
  }));
  if (rows.length > 0) {
    const { error } = await service.from("content_evaluations").upsert(rows, { onConflict: "deliverable_id" });
    if (error) console.error("[auto-editor] persist error:", error.message);
  }

  // Notify managers if the curator hard-gated any content on compliance.
  const flaggedCount = evals.filter((e) => !e.compliance_pass).length;
  if (flaggedCount > 0) {
    const ctx = await dealContext(athleteId, campaignId);
    const who = ctx.athleteName || "an athlete";
    await notifyManagers({
      type: "compliance_flag",
      title: `Compliance flag on ${who}'s content`,
      message: `${ctx.brandName ? ctx.brandName + " · " : ""}${ctx.campaignTitle ?? "deal"} — ${flaggedCount} item${flaggedCount === 1 ? "" : "s"} failed a compliance check and can't be a top pick until cleared.`,
      linkUrl: ctx.reviewLink,
      athleteName: ctx.athleteName,
      brandName: ctx.brandName,
      campaignTitle: ctx.campaignTitle,
    });
  }

  return {
    stubbed,
    model: stubbed ? "stub" : MODEL,
    count: evals.length,
    topPickIds: Array.from(topPickIds),
    evaluations: evals.map((e) => ({ ...e, is_top_pick: topPickIds.has(e.deliverable_id), rank: rankById.get(e.deliverable_id) ?? null })),
  };
}
