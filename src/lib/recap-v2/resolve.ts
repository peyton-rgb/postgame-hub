// ============================================================
// The effective recap config.
//
// One function answers "what should this recap show?", and it answers it the
// same way whether or not anyone has opened the builder: a positive choice in
// `recap_config` where one exists, today's derivation where none does.
//
// Every resolved field carries its `source`. That is not decoration — it is
// how the page knows whether to honour an explicit list or fall back to the
// behaviour 82 published recaps currently depend on, and how the builder knows
// which controls a human has actually touched.
//
// The derivations here are deliberately identical to what the v2 page already
// does. That is the proof for step 2: a campaign with no config (all 626 of
// them today) must render byte-identically before and after the page starts
// reading this.
// ============================================================

import {
  computePresence,
  galleryItems,
  type RecapV2Data,
  type SectionId,
} from "./guards";
import { selectHeroStills } from "./hero";
import { normaliseTakeaways, type TakeawaysShape } from "./takeaways";
import {
  validateRecapConfig,
  type ContentOrder,
  type FocalPoint,
  type NumberLayout,
  type NumberMetric,
  type NumbersConfig,
  type PerformerOrder,
  type RecapConfig,
  type SectionConfig,
} from "./config";

export type ConfigSource = "configured" | "derived";

export interface Resolved<T> {
  value: T;
  source: ConfigSource;
}

/**
 * Takeaways resolve to one of two shapes, and the union is the honest model.
 *
 * The builder writes `{ headline, points[] }`. The 32 campaigns that already
 * have takeaways carry a free-text blob in `settings.key_takeaways` in three
 * incompatible forms. Deriving a headline and points out of a blob would be
 * guessing, and would change what those campaigns render — so a legacy blob
 * stays a legacy blob until someone opens the builder and restructures it.
 */
export type ResolvedTakeaways =
  | { kind: "structured"; headline: string; points: string[] }
  | { kind: "legacy"; html: string; shape: TakeawaysShape }
  | { kind: "none" };

export interface ResolvedHero {
  /** Ordered media ids. Empty when the campaign has no usable stills. */
  mediaIds: string[];
  /** Per-still crop. Absent for a still means the page's own default. */
  focal: Record<string, FocalPoint>;
}

export interface ResolvedPerformers {
  /**
   * Explicit selection, in order. Empty with source "derived" means no one has
   * chosen — rank as today. Empty with source "configured" means someone chose
   * to feature nobody, and the section is hidden.
   */
  athleteIds: string[];
  order: PerformerOrder;
}

export interface ResolvedContent {
  mediaIds: string[];
  order: ContentOrder;
}

export interface ResolvedRecapConfig {
  displayName: Resolved<string>;
  sections: Resolved<SectionConfig[]>;
  hero: Resolved<ResolvedHero>;
  takeaways: Resolved<ResolvedTakeaways>;
  numbers: Resolved<NumbersConfig>;
  performers: Resolved<ResolvedPerformers>;
  content: Resolved<ResolvedContent>;
  /** Whatever the validator dropped. Surfaced in the builder, never thrown. */
  issues: string[];
  /** True when recap_config held nothing usable — i.e. everything is derived. */
  isUnbuilt: boolean;
}

/**
 * Today's numbers section, expressed as config: a headline figure and three
 * rows. `standard` layout is the spacing the page currently ships.
 */
const DERIVED_METRICS: NumberMetric[] = ["headline", "engagements", "engagement_rate", "posts"];
const DERIVED_LAYOUT: NumberLayout = "standard";

/** Section order the v2 page renders in. Config may reorder; this is the default. */
const DERIVED_SECTION_ORDER: SectionId[] = ["overview", "take", "numbers", "perf", "bic", "roster"];

export function resolveRecapConfig(data: RecapV2Data): ResolvedRecapConfig {
  const { campaign, allAthletes, media } = data;
  const { config, issues } = validateRecapConfig(campaign.recap_config);
  const isUnbuilt = Object.keys(config).length === 0;

  // ── display name ────────────────────────────────────────────────────────
  // The hero sets this at up to 150px. `campaign.name` is the admin name and
  // is not always safe to show a client — "Dunks March Madness" carries an
  // NCAA trademark. display_name overrides it; the slug is untouched plumbing.
  const displayName: Resolved<string> = config.display_name
    ? { value: config.display_name, source: "configured" }
    : { value: campaign.name, source: "derived" };

  // ── sections ────────────────────────────────────────────────────────────
  // Derivation runs regardless, because it answers a question config cannot:
  // whether there is any DATA for a section. A configured `visible: true` on a
  // section with nothing in it must still not render an empty shell — 30 of 82
  // campaigns have no metrics at all. Config chooses order and can hide;
  // presence decides what is possible.
  const presence = computePresence(data);
  const derivedSections: SectionConfig[] = DERIVED_SECTION_ORDER.filter(
    (id) => presence.has[id],
  ).map((key, order) => ({ key, visible: true, order }));

  let sections: Resolved<SectionConfig[]>;
  if (config.sections) {
    // Keep the configured order, drop anything the data cannot support, and
    // append any section the config never mentioned so a config written before
    // a section existed does not silently lose it.
    const mentioned = new Set(config.sections.map((s) => s.key));
    const kept = config.sections.filter((s) => presence.has[s.key]);
    const missing = DERIVED_SECTION_ORDER.filter(
      (id) => presence.has[id] && !mentioned.has(id),
    ).map((key) => ({ key, visible: true, order: 0 }));
    sections = {
      value: [...kept, ...missing].map((s, order) => ({ ...s, order })),
      source: "configured",
    };
  } else {
    sections = { value: derivedSections, source: "derived" };
  }

  // ── hero ────────────────────────────────────────────────────────────────
  const gallery = galleryItems(media);
  let heroResolved: Resolved<ResolvedHero>;
  if (config.hero && config.hero.media_ids.length > 0) {
    // An explicit selection is honoured whole — not padded to four, not
    // reordered. Ids that no longer resolve to a usable still are dropped,
    // because the media may have been deleted since it was chosen.
    const usable = new Map(selectHeroStills(gallery, Number.MAX_SAFE_INTEGER).map((h) => [h.mediaId, h]));
    const mediaIds = config.hero.media_ids.filter((id) => usable.has(id));
    const dropped = config.hero.media_ids.length - mediaIds.length;
    if (dropped > 0) {
      issues.push(`hero: ${dropped} selected still(s) no longer resolve to an image — skipped`);
    }
    heroResolved = {
      value: { mediaIds, focal: config.hero.focal },
      source: "configured",
    };
  } else {
    heroResolved = {
      value: { mediaIds: selectHeroStills(gallery, 4).map((h) => h.mediaId), focal: {} },
      source: "derived",
    };
  }

  // ── takeaways ───────────────────────────────────────────────────────────
  let takeaways: Resolved<ResolvedTakeaways>;
  if (config.takeaways) {
    takeaways = {
      value: {
        kind: "structured",
        headline: config.takeaways.headline,
        points: config.takeaways.points,
      },
      source: "configured",
    };
  } else {
    const legacy = normaliseTakeaways(campaign.settings?.key_takeaways);
    takeaways = {
      value: legacy.html
        ? { kind: "legacy", html: legacy.html, shape: legacy.shape }
        : { kind: "none" },
      source: "derived",
    };
  }

  // ── numbers ─────────────────────────────────────────────────────────────
  const numbers: Resolved<NumbersConfig> = config.numbers
    ? {
        value: {
          metrics: config.numbers.metrics.length > 0 ? config.numbers.metrics : DERIVED_METRICS,
          targets: config.numbers.targets,
          layout: config.numbers.layout,
        },
        source: "configured",
      }
    : {
        value: { metrics: DERIVED_METRICS, targets: {}, layout: DERIVED_LAYOUT },
        source: "derived",
      };

  // ── performers ──────────────────────────────────────────────────────────
  const athleteIdSet = new Set(allAthletes.map((a) => a.id));
  let performers: Resolved<ResolvedPerformers>;
  if (config.performers) {
    const athleteIds = config.performers.athlete_ids.filter((id) => athleteIdSet.has(id));
    const dropped = config.performers.athlete_ids.length - athleteIds.length;
    if (dropped > 0) {
      issues.push(`performers: ${dropped} selected athlete(s) are no longer on this campaign — skipped`);
    }
    performers = { value: { athleteIds, order: config.performers.order }, source: "configured" };
  } else {
    // Empty + derived means "nobody has chosen" — the page ranks as it does
    // today. It does NOT mean "feature nobody".
    performers = { value: { athleteIds: [], order: "engagements" }, source: "derived" };
  }

  // ── content ─────────────────────────────────────────────────────────────
  const galleryIdSet = new Set(gallery.map((m) => m.id));
  let content: Resolved<ResolvedContent>;
  if (config.content) {
    const mediaIds = config.content.media_ids.filter((id) => galleryIdSet.has(id));
    const dropped = config.content.media_ids.length - mediaIds.length;
    if (dropped > 0) {
      issues.push(`content: ${dropped} selected asset(s) are no longer on this campaign — skipped`);
    }
    content = { value: { mediaIds, order: config.content.order }, source: "configured" };
  } else {
    content = { value: { mediaIds: [], order: "manual" }, source: "derived" };
  }

  return {
    displayName,
    sections,
    hero: heroResolved,
    takeaways,
    numbers,
    performers,
    content,
    issues,
    isUnbuilt,
  };
}

/** Convenience for the page: is this section visible in the resolved config? */
export function sectionVisible(resolved: ResolvedRecapConfig, key: SectionId): boolean {
  const hit = resolved.sections.value.find((s) => s.key === key);
  return !!hit && hit.visible;
}

/** Resolved sections in render order, visible ones only. */
export function visibleSections(resolved: ResolvedRecapConfig): SectionId[] {
  return resolved.sections.value.filter((s) => s.visible).map((s) => s.key);
}
