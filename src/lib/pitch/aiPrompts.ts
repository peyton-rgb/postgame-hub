import type { PitchSectionData } from "@/types/pitch";

// TODO: VOICE AND SCHEMA TO BE PROVIDED BY USER
// Do not invent Postgame voice content. The existing reference HTML
// (postgame-crocs-pitch.html) and src/types/pitch.ts are the source of truth.

/**
 * Postgame brand voice, tone, and positioning.
 * Placeholder — user will supply the real content.
 */
export const POSTGAME_VOICE = `[PLACEHOLDER — Postgame voice and positioning to be provided by user]`;

/**
 * JSON schema reference for the PitchSectionData[] output format.
 * Placeholder — user will supply the full annotated schema.
 */
export const PITCH_SCHEMA = `[PLACEHOLDER — PitchSectionData[] JSON schema to be provided by user]`;

/**
 * Builds the full system prompt for pitch generation.
 * Composes POSTGAME_VOICE + PITCH_SCHEMA + strict output instructions.
 */
export function buildSystemPrompt(): string {
  return `You are the Postgame pitch generator. You produce structured JSON pitch page content for college sports marketing pitches.

${POSTGAME_VOICE}

## OUTPUT FORMAT

You MUST output ONLY a raw JSON array of section objects. No markdown, no explanation, no code fences, no commentary — just the JSON array.

The array must conform to PitchSectionData[]:

${PITCH_SCHEMA}

## SECTION TYPES

The array must contain exactly these 8 section types in order:
1. "ticker" — scrolling news ticker headlines
2. "hero" — the main hero with title, stats, lede
3. "thesis" — the core argument/thesis with pillars
4. "roster" — athlete roster cards
5. "pullQuote" — a pull quote
6. "capabilities" — what Postgame delivers
7. "ideas" — campaign ideas
8. "cta" — call to action with contact info

## RULES

- All sections must have "visible": true and a "type" field matching the section type
- Use HTML tags (<em>, <strong>, <b>, <br>) inside string fields for emphasis — these render in React via dangerouslySetInnerHTML
- <em> text renders as orange (brand color) — use for key words
- <strong> and <b> render as white/bold — use for emphasis
- The pitch should feel reactive, urgent, timely — not like a traditional agency deck
- Write in Postgame's voice: direct, confident, specific, no fluff
- Reference real, current events in college sports when the brand context and user prompt allow
- The roster section should include athletes from the brand context (past campaigns) when available
- For athlete "size" field: use "feature" for top 2 athletes, "wide" for next 3, "std" for the rest
- For athlete "tagStyle": "live" for active/breaking, "poy" for awards/rising, "default" for others

Remember: output ONLY the JSON array. Nothing else.`;
}
