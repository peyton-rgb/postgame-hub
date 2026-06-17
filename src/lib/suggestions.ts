// ============================================================
// Auto Editor — suggestions (Phase 3)
//
// For a top-pick deliverable, generate specific edit suggestions keyed to the
// house-checklist categories. Compliance failures from the evaluation surface
// as `required` suggestions. PHOTOS use the vision model; VIDEOS get limited,
// non-frame suggestions (caption/disclosure) pending the Edit Engine.
//
// STUB-SAFE without ANTHROPIC_API_KEY.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import { createServiceSupabase } from "@/lib/supabase-server";

const MODEL = process.env.AUTO_EDITOR_MODEL || "claude-opus-4-8";

export type Suggestion = {
  kind: string;
  summary: string;
  detail: string;
  severity: "info" | "recommended" | "required";
};

const SUGGEST_TOOL = {
  name: "submit_suggestions",
  description: "Submit concrete edit suggestions for this content item.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            kind: { type: "string", description: "crop | relight | trim | caption | disclosure | reframe | color | other" },
            summary: { type: "string", description: "short imperative, e.g. 'Crop tighter to the subject'" },
            detail: { type: "string", description: "one or two sentences of specifics" },
            severity: { type: "string", enum: ["info", "recommended", "required"] },
          },
          required: ["kind", "summary", "detail", "severity"],
        },
      },
    },
    required: ["suggestions"],
  },
} as const;

function flagToSuggestion(flag: string): Suggestion {
  const f = flag.toLowerCase();
  if (f.includes("ad") || f.includes("disclos")) {
    return { kind: "disclosure", summary: "Add the #ad / paid-partnership disclosure", detail: `Compliance flag: ${flag}. Required by FTC — add #ad in the caption and on-screen where applicable before this can be a pick.`, severity: "required" };
  }
  if (f.includes("compet")) {
    return { kind: "reframe", summary: "Remove the competing brand from frame", detail: `Compliance flag: ${flag}. Crop, reshoot, or blur so no competing brand is visible.`, severity: "required" };
  }
  if (f.includes("music") || f.includes("audio") || f.includes("copyright")) {
    return { kind: "trim", summary: "Replace the audio to avoid a mute", detail: `Compliance flag: ${flag}. Swap to licensed/cleared audio so the post isn't muted.`, severity: "required" };
  }
  return { kind: "other", summary: `Resolve compliance issue: ${flag}`, detail: `Compliance flag: ${flag}. Must be cleared before this can be a pick.`, severity: "required" };
}

async function modelSuggestions(deliverable: any, evaluation: any, deal: any, checklist: any[]): Promise<Suggestion[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return [
      { kind: "caption", summary: "Tighten the caption hook", detail: "Placeholder suggestion — ANTHROPIC_API_KEY not configured (TODO).", severity: "recommended" },
    ];
  }
  const client = new Anthropic();
  const isVideo = deliverable.media_type === "video";
  const mode = isVideo ? "video" : "photo";
  const rules = (checklist ?? [])
    .filter((i) => (i.applies_to || []).includes(mode))
    .map((i) => `- [${i.category}] ${i.rule}`)
    .join("\n");
  const briefParts = [deal?.brand?.name && `Brand: ${deal.brand.name}`, deal?.title && `Campaign: ${deal.title}`, deal?.requirements && `Requirements: ${deal.requirements}`, deal?.goal && `Goal: ${deal.goal}`].filter(Boolean).join("\n");

  const content: any[] = [];
  if (!isVideo && deliverable.file_url) {
    content.push({ type: "text", text: "The content to improve:" });
    content.push({ type: "image", source: { type: "url", url: deliverable.file_url } });
  }
  content.push({
    type: "text",
    text:
      `You are Postgame's editor. Propose concrete, actionable edit suggestions to make this ${mode} stronger for the deal, keyed to the checklist categories.\n\n` +
      `THE BRIEF:\n${briefParts || "(none)"}\n\n` +
      `CHECKLIST:\n${rules}\n\n` +
      (evaluation?.compliance_flags?.length ? `KNOWN COMPLIANCE PROBLEMS (treat as required): ${evaluation.compliance_flags.join(", ")}\n\n` : "") +
      (isVideo ? `NOTE: you cannot watch the footage — limit suggestions to caption, disclosure, length, and brief-fit; do not invent frame-level edits.\n\n` : "") +
      `Severity: required (compliance/brief-blocking), recommended (clear improvement), info (optional polish). Keep each summary a short imperative. Call submit_suggestions.`,
  });

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tools: [SUGGEST_TOOL as any],
      tool_choice: { type: "tool", name: SUGGEST_TOOL.name },
      messages: [{ role: "user", content }],
    });
    const block: any = res.content.find((b: any) => b.type === "tool_use");
    const raw = Array.isArray(block?.input?.suggestions) ? block.input.suggestions : [];
    return raw.map((s: any) => ({
      kind: typeof s.kind === "string" ? s.kind : "other",
      summary: typeof s.summary === "string" ? s.summary : "Suggestion",
      detail: typeof s.detail === "string" ? s.detail : "",
      severity: ["info", "recommended", "required"].includes(s.severity) ? s.severity : "recommended",
    }));
  } catch (e: any) {
    console.error("[suggestions] model error:", e?.message || e);
    return [];
  }
}

// Generate + persist suggestions for a deliverable. Replaces existing 'proposed'
// ones (keeps approved/dismissed history). Returns the new suggestions.
export async function generateSuggestions(deliverableId: string): Promise<{ ok: boolean; count: number; stubbed: boolean }> {
  const service = createServiceSupabase();

  const { data: deliverable } = await service
    .from("athlete_deliverables")
    .select("id,slot,media_type,file_url,optin_campaign_id")
    .eq("id", deliverableId)
    .maybeSingle();
  if (!deliverable) return { ok: false, count: 0, stubbed: false };

  const [{ data: evaluation }, { data: deal }, { data: checklist }] = await Promise.all([
    service.from("content_evaluations").select("id,compliance_flags,compliance_pass").eq("deliverable_id", deliverableId).maybeSingle(),
    service.from("optin_campaigns").select("id,title,requirements,goal,brand:brands(name)").eq("id", deliverable.optin_campaign_id).maybeSingle(),
    service.from("house_checklist_items").select("category,rule,applies_to").eq("active", true),
  ]);
  const dealNorm = deal ? { ...deal, brand: Array.isArray((deal as any).brand) ? (deal as any).brand[0] : (deal as any).brand } : null;

  // Required suggestions from compliance flags (deterministic), then model ones.
  const required: Suggestion[] = (evaluation?.compliance_flags ?? []).map(flagToSuggestion);
  const fromModel = await modelSuggestions(deliverable, evaluation, dealNorm, checklist ?? []);
  const all = [...required, ...fromModel];

  // Replace existing proposed suggestions for this deliverable.
  await service.from("edit_suggestions").delete().eq("deliverable_id", deliverableId).eq("status", "proposed");

  if (all.length > 0) {
    const rows = all.map((s) => ({
      deliverable_id: deliverableId,
      evaluation_id: evaluation?.id ?? null,
      kind: s.kind,
      summary: s.summary,
      detail: s.detail,
      severity: s.severity,
      status: "proposed",
    }));
    const { error } = await service.from("edit_suggestions").insert(rows);
    if (error) console.error("[suggestions] insert error:", error.message);
  }

  return { ok: true, count: all.length, stubbed: !process.env.ANTHROPIC_API_KEY };
}
