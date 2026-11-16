// ============================================================
// Collab posts count their views ONCE (2026-11-16).
//
// Same link in the tracker = the same Instagram post. Before this change the
// Hub added that post's views once per athlete in the collab, so CVS
// Pittsburgh's Pitt Baseball reel (5 athletes, 360K views each copy) showed
// 1.8M instead of 360K. Delivered recaps keep the old math via
// settings.legacy_collab_views so their totals never move.
//
// Fixture numbers are the real Pitt Baseball rows from the Pittsburgh tracker.
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, computeStatsWithOverrides, collabViewMismatches } from "./recap-helpers.ts";

// Minimal stand-in for csv-parser's detectCollabGroups (that module can't load
// under plain `node --test` because of an extensionless import). Same rule:
// one group per platform+link shared by 2+ athletes.
function detectCollabGroups(athletes: any[], getId: (a: any) => string) {
  const buckets = new Map<string, any[]>();
  for (const a of athletes) {
    for (const [slot, platform] of [["ig_feed", "ig_feed"], ["ig_reel", "ig_reel"], ["tiktok", "tiktok"]]) {
      const url = a.metrics?.[slot]?.post_url?.trim();
      if (!url) continue;
      const k = `${platform}|${url}`;
      buckets.set(k, [...(buckets.get(k) || []), a]);
    }
  }
  const collabGroups: any[] = [];
  buckets.forEach((members, k) => {
    if (members.length < 2) return;
    const [platform, url] = k.split("|");
    const block = members.map((m) => m.metrics[platform]).find((b) => b && b.total_engagements != null) || {};
    collabGroups.push({
      id: k, url, platform, platformLabel: platform, rawUrlKeys: [k],
      athleteIds: members.map(getId), athleteNames: members.map((m) => m.name),
      combinedFollowers: 0, metrics: {}, combinedEngagementRate: 0,
      sources: [{ platform, url, metrics: { totalEngagements: block.total_engagements }, combinedEngagementRate: 0 }],
    });
  });
  return { collabGroups };
}

const REEL = "https://www.instagram.com/p/DfH5ABeoJpB/";

function athlete(name: string, extra: Record<string, unknown> = {}) {
  return {
    id: name,
    name,
    school: "University Of Pittsburgh",
    sport: "Baseball",
    ig_followers: 1000,
    metrics: {
      ig_reel: { post_url: REEL, views: 360000, likes: 193, total_engagements: 241 },
      ...extra,
    },
  } as any;
}

const pitt = ["Chase Krewson", "Jake Paulick", "Aidan Paradine", "Colin Guerra", "Carter Groen"].map((n) => athlete(n));
const solo = {
  id: "Maya Maycock", name: "Maya Maycock", school: "Pitt", sport: "Track", ig_followers: 1593,
  metrics: { ig_feed: { post_url: "https://www.instagram.com/p/solo/", impressions: 1119, total_engagements: 22 } },
} as any;
const roster = [...pitt, solo];
const groups = detectCollabGroups(roster, (a: any) => a.id).collabGroups;

test("a shared reel's views count once", () => {
  const s = computeStats(roster, groups);
  assert.equal(s.igReel.views, 360000);
  assert.equal(s.totalImpressions, 360000 + 1119);
  assert.equal(s.igReelPosts, 1);
});

test("delivered recaps flagged legacy keep the old per-athlete sum", () => {
  const s = computeStatsWithOverrides(roster, { settings: { legacy_collab_views: true } }, groups);
  assert.equal(s.igReel.views, 360000 * 5);
  assert.equal(s.totalImpressions, 360000 * 5 + 1119);
});

test("recaps without the flag use the corrected math", () => {
  const s = computeStatsWithOverrides(roster, { settings: {} }, groups);
  assert.equal(s.totalImpressions, 360000 + 1119);
});

test("blank copies on other athletes don't zero the post", () => {
  const ava = athlete("Ava Praeter", { ig_reel: { post_url: REEL, views: 6690, total_engagements: 243 } });
  const anya = athlete("Anya Phillips", { ig_reel: { post_url: REEL } });
  const r = [ava, anya];
  const s = computeStats(r, detectCollabGroups(r, (a: any) => a.id).collabGroups);
  assert.equal(s.igReel.views, 6690);
});

test("mismatched copies: highest counted once, and flagged", () => {
  const feed = "https://www.instagram.com/p/DfKyAsvkR-4/";
  const melea = athlete("Melea Weber", { ig_reel: undefined, ig_feed: { post_url: feed, impressions: 3962 } });
  const charley = athlete("Charley Kramer", { ig_reel: undefined, ig_feed: { post_url: feed, impressions: 1628, total_engagements: 278 } });
  const r = [melea, charley];
  const g = detectCollabGroups(r, (a: any) => a.id).collabGroups;
  assert.equal(computeStats(r, g).igFeed.impressions, 3962);
  const mm = collabViewMismatches(r, g);
  assert.equal(mm.length, 1);
  assert.deepEqual([...mm[0].values].sort((a, b) => a - b), [1628, 3962]);
});

test("matching copies are not flagged", () => {
  assert.equal(collabViewMismatches(roster, groups).length, 0);
});
