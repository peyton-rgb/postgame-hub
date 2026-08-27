// ============================================================
// recap_config — the shape, and a validator for it.
//
// `campaign_recaps.settings` is a settings bag whose keys are almost all
// negative: hidden_heroes, hidden_platform_cards, hidden_columns,
// visible_sections. It can say "don't show that". It cannot say "show these
// four, in this order, cropped like this" — exactly one campaign of 114 has a
// "choose this" key at all. So the page guesses, and the guesses are what the
// v2 review found.
//
// `recap_config` (jsonb, nullable, already applied in production, zero rows
// populated) is where positive choices live. EVERY field here is a choice
// someone made. A field that is absent is not "off" — it means "fall back to
// the derived default", which is what the v2 page already does well, so an
// unbuilt recap still renders.
//
// Typed and validated in TypeScript rather than by the database, so the shape
// stays cheap to change while the builder is being designed.
//
// The validator is deliberately TOLERANT: it drops what it cannot understand
// and keeps the rest, reporting each drop. A malformed config must degrade to
// the derived default, never break a published client recap.
// ============================================================

import type { SectionId } from "./guards";

export const SECTION_IDS: SectionId[] = [
  "overview",
  "take",
  "numbers",
  "perf",
  "bic",
  "roster",
];

/** Metrics the numbers section can show. Keys, not labels. */
export const NUMBER_METRICS = [
  "headline",        // the big figure — reel views, or impressions when no reels
  "engagements",
  "engagement_rate", // engagements ÷ impressions
  "posts",
  "impressions",
  "athletes",
  "schools",
  "followers",
] as const;
export type NumberMetric = (typeof NUMBER_METRICS)[number];

/** How tightly the numbers section is grouped. */
export const NUMBER_LAYOUTS = ["compact", "standard", "spacious"] as const;
export type NumberLayout = (typeof NUMBER_LAYOUTS)[number];

/**
 * How performers are ranked.
 *
 * NOTE — this reads the brief's `performers.order` as a sort MODE rather than
 * a second ordering. `athlete_ids` is already an ordered array, so a separate
 * `order` list would be two sources of truth for the same thing and they would
 * eventually disagree. A mode is the only reading that adds information: it is
 * what the v2 page's engagements/views toggle already expresses. Flagged for
 * confirmation before the builder is built.
 */
export const PERFORMER_ORDERS = ["manual", "engagements", "views"] as const;
export type PerformerOrder = (typeof PERFORMER_ORDERS)[number];

/** Same reading for content: the array carries position, this carries intent. */
export const CONTENT_ORDERS = ["manual", "sort_order", "newest"] as const;
export type ContentOrder = (typeof CONTENT_ORDERS)[number];

/**
 * The live editor's labels, verbatim.
 *
 * A manager moving between /dashboard/[id] and the builder should not have to
 * learn that "bic" is "Best In Class Content" or that "numbers" is "Campaign
 * Metrics". These are the strings from SECTION_LABELS in that file.
 */
export const SECTION_LABEL_EDITOR = {
  section: {
    overview: "Campaign Overview",
    take: "Key Takeaways",
    numbers: "Campaign Metrics",
    perf: "Top Performers",
    bic: "Best In Class Content",
    roster: "Campaign Roster",
  } as Record<SectionId, string>,
  metric: {
    headline: "Headline figure",
    engagements: "Total Engagements",
    engagement_rate: "Engagement Rate",
    posts: "Total Posts",
    impressions: "Total Impressions",
    athletes: "Athletes",
    schools: "Colleges",
    followers: "Total Followers",
  } as Record<NumberMetric, string>,
};

export interface SectionConfig {
  key: SectionId;
  visible: boolean;
  /**
   * Kept because the brief specifies it, but it is redundant with array
   * position and the two can disagree. The validator canonicalises: sort by
   * `order`, array position breaks ties, and the result is renumbered from 0
   * so what is written back is always self-consistent. Also flagged.
   */
  order: number;
}

/**
 * Per-still framing. Four values, because the photo is a backdrop spanning the
 * hero and the campaign overview, blended by a horizontal and a vertical
 * gradient — not a cropped image in a box.
 *
 *   x     0-100     ACROSS. 100 rests the backdrop against the right edge;
 *                   lower values slide it left.
 *   y     0-100     UP/DOWN. Pans it vertically about the middle.
 *   scale 0.85-1.7  ZOOM, about transform-origin: right center. Below 0.85
 *                   the backdrop stops covering the block.
 *   fade  45-92     Where the horizontal gradient reaches zero, as a
 *                   percentage of block width. Below 45 the copy loses its
 *                   ground; above 92 the photo is swallowed.
 *
 * All three of the first are one transform on the backdrop — see
 * components/recap-builder/heroTransform.ts. Nothing crops: the photo is sized
 * by height and overflows horizontally, so it fills the block whatever its
 * aspect ratio.
 */
export interface FocalPoint {
  x: number;
  y: number;
  scale: number;
  fade: number;
}

/** What an unset control means — the reference's slider defaults. */
export const FOCAL_DEFAULTS: FocalPoint = { x: 100, y: 32, scale: 1, fade: 76 };

export interface HeroConfig {
  media_ids: string[];
  focal: Record<string, FocalPoint>;
  /**
   * The line under the title.
   *
   * Its own field, because one description doing two jobs is what printed the
   * same copy twice: the hero wants a short line and #overview wants the
   * opening prose, and settings.description cannot be both. #overview keeps
   * reading description; this is only the hero's line.
   */
  lede?: string;
}

export interface TakeawaysConfig {
  headline: string;
  points: string[];
}

export interface NumbersConfig {
  metrics: NumberMetric[];
  targets: Partial<Record<NumberMetric, number>>;
  layout: NumberLayout;
}

export interface PerformersConfig {
  athlete_ids: string[];
  order: PerformerOrder;
}

export interface ContentConfig {
  media_ids: string[];
  order: ContentOrder;
}

/**
 * Every key optional, on purpose. A config that sets only `hero` is valid and
 * everything else falls back — the builder is section-by-section and a
 * half-built recap has to render.
 */
export interface RecapConfig {
  display_name?: string;
  /**
   * The brand as it should read to a client, distinct from
   * campaign_recaps.client_name — that column is the account name in the admin
   * and is not always what belongs above a 150px title.
   */
  brand?: string;
  sections?: SectionConfig[];
  hero?: HeroConfig;
  takeaways?: TakeawaysConfig;
  numbers?: NumbersConfig;
  performers?: PerformersConfig;
  content?: ContentConfig;
}

export interface ValidationResult {
  config: RecapConfig;
  /** One line per thing dropped or corrected. Empty when the input was clean. */
  issues: string[];
}

// ── primitives ──────────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isFiniteNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Trimmed, non-empty strings only, de-duplicated, order preserved. */
function stringList(v: unknown, label: string, issues: string[]): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    issues.push(`${label}: expected an array, got ${typeof v} — ignored`);
    return undefined;
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of v) {
    if (typeof raw !== "string" || !raw.trim()) {
      issues.push(`${label}: dropped a non-string entry`);
      continue;
    }
    const s = raw.trim();
    if (seen.has(s)) {
      issues.push(`${label}: dropped duplicate ${s}`);
      continue;
    }
    seen.add(s);
    out.push(s);
  }
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// ── section validation ──────────────────────────────────────────────────────

function validateSections(v: unknown, issues: string[]): SectionConfig[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    issues.push("sections: expected an array — ignored");
    return undefined;
  }
  const seen = new Set<SectionId>();
  const rows: Array<{ key: SectionId; visible: boolean; order: number; pos: number }> = [];
  v.forEach((raw, pos) => {
    if (!isObj(raw)) {
      issues.push("sections: dropped a non-object entry");
      return;
    }
    const key = raw.key;
    if (typeof key !== "string" || !SECTION_IDS.includes(key as SectionId)) {
      issues.push(`sections: dropped unknown key ${JSON.stringify(key)}`);
      return;
    }
    if (seen.has(key as SectionId)) {
      issues.push(`sections: dropped duplicate key ${key}`);
      return;
    }
    seen.add(key as SectionId);
    rows.push({
      key: key as SectionId,
      // Anything not exactly false is visible, matching the `settings`
      // convention the v2 guards already follow.
      visible: raw.visible !== false,
      order: isFiniteNum(raw.order) ? raw.order : Number.POSITIVE_INFINITY,
      pos,
    });
  });
  if (rows.length === 0) return undefined;
  // Canonicalise: `order` wins, array position breaks ties, renumber from 0 so
  // what is stored can never disagree with itself.
  rows.sort((a, b) => a.order - b.order || a.pos - b.pos);
  return rows.map((r, i) => ({ key: r.key, visible: r.visible, order: i }));
}

// ── hero validation ─────────────────────────────────────────────────────────

function validateHero(v: unknown, issues: string[]): HeroConfig | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) {
    issues.push("hero: expected an object — ignored");
    return undefined;
  }
  const media_ids = stringList(v.media_ids, "hero.media_ids", issues) ?? [];
  const lede = typeof v.lede === "string" ? v.lede.trim() : "";
  const focal: Record<string, FocalPoint> = {};
  if (v.focal !== undefined) {
    if (!isObj(v.focal)) {
      issues.push("hero.focal: expected an object — ignored");
    } else {
      for (const [id, raw] of Object.entries(v.focal)) {
        if (!isObj(raw)) {
          issues.push(`hero.focal[${id}]: expected an object — dropped`);
          continue;
        }
        if (!media_ids.includes(id)) {
          // A crop for a still that is no longer selected is dead weight and
          // would resurface confusingly if the still were re-added later.
          issues.push(`hero.focal[${id}]: not in media_ids — dropped`);
          continue;
        }
        const x = isFiniteNum(raw.x) ? clamp(raw.x, 0, 100) : FOCAL_DEFAULTS.x;
        const y = isFiniteNum(raw.y) ? clamp(raw.y, 0, 100) : FOCAL_DEFAULTS.y;
        const scale = isFiniteNum(raw.scale) ? clamp(raw.scale, 0.85, 1.7) : FOCAL_DEFAULTS.scale;
        // 45-92 is the usable range of the gradient, not a UI preference: the
        // copy needs ground on the left and the photo needs air on the right.
        const fade = isFiniteNum(raw.fade) ? clamp(raw.fade, 45, 92) : FOCAL_DEFAULTS.fade;
        focal[id] = { x, y, scale, fade };
      }
    }
  }
  if (media_ids.length === 0 && Object.keys(focal).length === 0 && !lede) return undefined;
  return { media_ids, focal, ...(lede ? { lede } : {}) };
}

// ── the rest ────────────────────────────────────────────────────────────────

function validateTakeaways(v: unknown, issues: string[]): TakeawaysConfig | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) {
    issues.push("takeaways: expected an object — ignored");
    return undefined;
  }
  const headline = typeof v.headline === "string" ? v.headline.trim() : "";
  const points = (stringList(v.points, "takeaways.points", issues) ?? []).filter(Boolean);
  if (!headline && points.length === 0) return undefined;
  return { headline, points };
}

function validateNumbers(v: unknown, issues: string[]): NumbersConfig | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) {
    issues.push("numbers: expected an object — ignored");
    return undefined;
  }
  const raw = stringList(v.metrics, "numbers.metrics", issues);
  const metrics = (raw ?? []).filter((m): m is NumberMetric => {
    const ok = (NUMBER_METRICS as readonly string[]).includes(m);
    if (!ok) issues.push(`numbers.metrics: dropped unknown metric ${m}`);
    return ok;
  });

  const targets: Partial<Record<NumberMetric, number>> = {};
  if (v.targets !== undefined) {
    if (!isObj(v.targets)) {
      issues.push("numbers.targets: expected an object — ignored");
    } else {
      for (const [k, val] of Object.entries(v.targets)) {
        if (!(NUMBER_METRICS as readonly string[]).includes(k)) {
          issues.push(`numbers.targets: dropped unknown metric ${k}`);
          continue;
        }
        if (!isFiniteNum(val)) {
          issues.push(`numbers.targets[${k}]: not a finite number — dropped`);
          continue;
        }
        targets[k as NumberMetric] = val;
      }
    }
  }

  let layout: NumberLayout = "standard";
  if (v.layout !== undefined) {
    if (typeof v.layout === "string" && (NUMBER_LAYOUTS as readonly string[]).includes(v.layout)) {
      layout = v.layout as NumberLayout;
    } else {
      issues.push(`numbers.layout: unknown value ${JSON.stringify(v.layout)} — using "standard"`);
    }
  }

  if (metrics.length === 0 && Object.keys(targets).length === 0 && v.layout === undefined) {
    return undefined;
  }
  return { metrics, targets, layout };
}

function validatePerformers(v: unknown, issues: string[]): PerformersConfig | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) {
    issues.push("performers: expected an object — ignored");
    return undefined;
  }
  const athlete_ids = stringList(v.athlete_ids, "performers.athlete_ids", issues) ?? [];
  let order: PerformerOrder = "manual";
  if (v.order !== undefined) {
    if (typeof v.order === "string" && (PERFORMER_ORDERS as readonly string[]).includes(v.order)) {
      order = v.order as PerformerOrder;
    } else {
      issues.push(`performers.order: unknown value ${JSON.stringify(v.order)} — using "manual"`);
    }
  }
  if (athlete_ids.length === 0 && v.order === undefined) return undefined;
  return { athlete_ids, order };
}

function validateContent(v: unknown, issues: string[]): ContentConfig | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) {
    issues.push("content: expected an object — ignored");
    return undefined;
  }
  const media_ids = stringList(v.media_ids, "content.media_ids", issues) ?? [];
  let order: ContentOrder = "manual";
  if (v.order !== undefined) {
    if (typeof v.order === "string" && (CONTENT_ORDERS as readonly string[]).includes(v.order)) {
      order = v.order as ContentOrder;
    } else {
      issues.push(`content.order: unknown value ${JSON.stringify(v.order)} — using "manual"`);
    }
  }
  if (media_ids.length === 0 && v.order === undefined) return undefined;
  return { media_ids, order };
}

/**
 * Parse whatever is in the jsonb column into a config we can trust.
 *
 * Never throws. Anything unrecognised is dropped and reported; a section that
 * validates to nothing is left absent so it falls back to the derived default
 * rather than rendering empty.
 */
export function validateRecapConfig(input: unknown): ValidationResult {
  const issues: string[] = [];
  if (input === null || input === undefined) return { config: {}, issues };
  if (!isObj(input)) {
    return { config: {}, issues: [`recap_config: expected an object, got ${typeof input} — ignored`] };
  }

  const known = new Set([
    "display_name", "brand", "sections", "hero", "takeaways", "numbers", "performers", "content",
  ]);
  for (const k of Object.keys(input)) {
    if (!known.has(k)) issues.push(`recap_config: unknown key ${k} — ignored`);
  }

  const config: RecapConfig = {};

  if (input.display_name !== undefined) {
    if (typeof input.display_name === "string" && input.display_name.trim()) {
      config.display_name = input.display_name.trim();
    } else if (typeof input.display_name !== "string") {
      issues.push("display_name: expected a string — ignored");
    }
    // An explicitly blank display_name means "no override", not "blank title".
  }

  if (input.brand !== undefined) {
    if (typeof input.brand === "string" && input.brand.trim()) {
      config.brand = input.brand.trim();
    } else if (typeof input.brand !== "string") {
      issues.push("brand: expected a string — ignored");
    }
  }

  const sections = validateSections(input.sections, issues);
  if (sections) config.sections = sections;
  const hero = validateHero(input.hero, issues);
  if (hero) config.hero = hero;
  const takeaways = validateTakeaways(input.takeaways, issues);
  if (takeaways) config.takeaways = takeaways;
  const numbers = validateNumbers(input.numbers, issues);
  if (numbers) config.numbers = numbers;
  const performers = validatePerformers(input.performers, issues);
  if (performers) config.performers = performers;
  const content = validateContent(input.content, issues);
  if (content) config.content = content;

  return { config, issues };
}

/**
 * Canonical JSON form, for comparing what was loaded against what is about to
 * be saved.
 *
 * #208 fixed a bug where opening a campaign page WROTE to it, because dirty
 * was computed against a normalised payload rather than against what was
 * loaded. The builder must compare like with like: normalise both sides
 * through this, then compare. Keys are sorted so key order can never read as
 * a change.
 */
export function canonicalise(config: RecapConfig): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (isObj(v)) {
      return Object.fromEntries(
        Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(sortKeys(config));
}

/** True when the two configs differ in substance rather than in key order. */
export function isDirty(loaded: RecapConfig, current: RecapConfig): boolean {
  return canonicalise(loaded) !== canonicalise(current);
}
