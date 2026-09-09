// ============================================================
// Model pricing, in one place.
//
// The cost formula was written out at five call sites, each with the rate
// hardcoded beside it — and they had already drifted apart: creative-director,
// editor-agent, brief-writer and api/intake/brief used $3/$15 while
// intake-agent used $10/$50. Both were right for the model they were next to
// (Sonnet 4.x vs Fable 5), which is exactly why a per-site literal is the wrong
// shape: it looks like a bug and cannot be audited.
//
// Rates are USD per MILLION tokens, from the Anthropic pricing table.
//
// Gemini is deliberately absent. lib/tools/gemini.ts prices video by DURATION,
// not tokens, and estimateGeminiCost() there remains the right helper for it —
// forcing it into a per-token table would invent token counts that were never
// measured.
// ============================================================

export interface ModelRate {
  /** USD per million input tokens. */
  input: number;
  /** USD per million output tokens. */
  output: number;
}

/**
 * Exact model id -> rate.
 *
 * Keys are the full ids as passed to the API, because that is what the call
 * sites already have in hand and what lands in agent_runs.model.
 */
export const MODEL_RATES: Record<string, ModelRate> = {
  // Fable — the most expensive tier in use here.
  "claude-fable-5": { input: 10, output: 50 },
  "claude-fable-5-1": { input: 10, output: 50 },

  // Opus. Included for completeness: no call site in this repo uses an Opus
  // model today, so nothing currently resolves to these rows.
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },

  // Sonnet. Note the two generations are NOT the same price.
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },

  "claude-haiku-4-5": { input: 1, output: 5 },
};

/** Used when a model id is not in the table. Sonnet 4.x rates. */
const FALLBACK_RATE: ModelRate = { input: 3, output: 15 };

/**
 * The rate for a model id.
 *
 * Falls back on an unknown id rather than throwing or returning zero: a wrong
 * cost is a reporting problem, a thrown error would fail the agent run that
 * just succeeded, and a zero would silently exempt the model from its cap.
 * Prefix matching catches dated snapshots of a known family.
 */
export function rateFor(model: string | null | undefined): ModelRate {
  if (!model) return FALLBACK_RATE;
  const exact = MODEL_RATES[model];
  if (exact) return exact;

  // Longest matching prefix wins, so claude-sonnet-4-6 beats claude-sonnet-4.
  let best: ModelRate | null = null;
  let bestLen = 0;
  for (const [id, rate] of Object.entries(MODEL_RATES)) {
    if (model.startsWith(id) && id.length > bestLen) {
      best = rate;
      bestLen = id.length;
    }
  }
  if (!best) {
    console.warn(`[pricing] no rate for model "${model}", using $${FALLBACK_RATE.input}/$${FALLBACK_RATE.output} per MTok`);
  }
  return best ?? FALLBACK_RATE;
}

/** Cost in USD for a completed call. */
export function costUsd(model: string | null | undefined, inputTokens: number, outputTokens: number): number {
  const rate = rateFor(model);
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}

/**
 * Pull tokens and cost straight off an Anthropic response.
 *
 * Returns the three columns agent_runs wants, so a call site can spread it into
 * the update rather than recomputing the same three fields by hand.
 */
export function usageFrom(
  model: string | null | undefined,
  usage: { input_tokens?: number | null; output_tokens?: number | null } | null | undefined,
): { input_tokens: number; output_tokens: number; cost_usd: number } {
  const input_tokens = usage?.input_tokens ?? 0;
  const output_tokens = usage?.output_tokens ?? 0;
  return { input_tokens, output_tokens, cost_usd: costUsd(model, input_tokens, output_tokens) };
}
