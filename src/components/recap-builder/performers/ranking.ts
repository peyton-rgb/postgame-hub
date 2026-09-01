// ============================================================
// Recap Builder — top performers ranking
//
// Auto top 5 only — there is no manual selection (handoff).
// One basis for the whole step, shown in two places: the
// builder toolbar and the public section preview share this
// single state.
//
// VERIFIED AGAINST LIVE DATA. The handoff records the expected
// top fives for Ghost Amp, and the formulas below reproduce all
// ten rows exactly:
//
//   Engagements  Andi 13,291 · Sophine 1,171 · Emily 930 ·
//                Pierce Graber 804 · Lauren Lewis 758
//   Impressions  Andi 64,290 · Ethan Cook 40,713 ·
//                Kailey 14,458 · Emily 13,705 · Sophine 10,941
//
// NOTE ON REEL ENGAGEMENTS. Reel engagements are
// likes + comments + reposts + shares, shared from
// athletes/metrics.ts. Dropping reposts (as builder-01 did) puts
// Pierce Graber at 803 and Lauren Lewis at 753 — one and five
// short of the recorded figures. The stored
// ig_reel.total_engagements is canonical and agrees with the
// formula used here.
// ============================================================

import { feedEng, reelEng, type BuilderAthlete } from '../athletes/metrics';

export type Basis = 'eng' | 'impr';

const n = (v: number | null | undefined): number => v ?? 0;

/* Engagement definitions are shared with the Athletes grid and the Overview
   platform breakdown — one definition, so every surface agrees. */
export const feedEngagements = feedEng;
export const reelEngagements = reelEng;

/** Feed impressions — absent from this dataset, kept so the formula reads whole. */
export const feedImpressions = (a: BuilderAthlete): number => n(a.metrics?.ig_feed?.impressions);
export const storyImpressions = (a: BuilderAthlete): number =>
  n(a.metrics?.ig_story?.total_impressions);
export const reelViews = (a: BuilderAthlete): number => n(a.metrics?.ig_reel?.views);
export const tiktokViews = (a: BuilderAthlete): number => n(a.metrics?.tiktok?.views);

/** The ranked value for a basis. */
export function basisValue(a: BuilderAthlete, basis: Basis): number {
  return basis === 'eng'
    ? feedEngagements(a) + reelEngagements(a)
    : feedImpressions(a) + storyImpressions(a) + reelViews(a) + tiktokViews(a);
}

/** Auto top 5, recomputed from athletes.metrics on every basis change. */
export function topFive(rows: BuilderAthlete[], basis: Basis): BuilderAthlete[] {
  return [...rows].sort((a, b) => basisValue(b, basis) - basisValue(a, basis)).slice(0, 5);
}

/**
 * Source attribution for the single toggled metric: argmax across the
 * channels that make up the current basis. Empty when the winner is zero,
 * so a card never claims a source it has no number for.
 */
export function sourceLabel(a: BuilderAthlete, basis: Basis): string {
  const channels: [string, number][] =
    basis === 'eng'
      ? [
          ['IG Feed', feedEngagements(a)],
          ['IG Reel', reelEngagements(a)],
        ]
      : [
          ['IG Story', storyImpressions(a)],
          ['IG Reel', reelViews(a)],
          ['IG Feed', feedImpressions(a)],
        ];
  channels.sort((x, y) => y[1] - x[1]);
  return channels[0][1] > 0 ? channels[0][0] : '';
}

/** Compact display, the prototype's rule. */
export const fmt = (v: number): string =>
  v >= 1000 ? (v / 1000).toFixed(1).replace('.0', '') + 'K' : String(v);

/** Initials fallback when a performer has no staged photo. */
export const initials = (name: string): string =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('');

/* Supabase transformer variants — width AND height AND resize, always webp. */
const render = (u: string) => u.replace('/object/public/', '/render/image/public/');
export const cardUrl = (u: string) => render(u) + '?width=760&height=760&resize=contain&quality=80&format=webp';
export const rowThumbUrl = (u: string) => render(u) + '?width=200&height=200&resize=cover&quality=70&format=webp';
export const modalUrl = (u: string) => render(u) + '?width=420&height=420&resize=contain&quality=76&format=webp';
