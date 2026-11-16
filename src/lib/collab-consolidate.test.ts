// ============================================================
// A team's feed + reel render as ONE collab card even when the feed has
// fewer of the team on it (2026-11-16).
//
// Real case — Unsung "2026 Fall Sports NIL", UNH Hockey: the reel lists Finn,
// Leonard and Blair; the feed carousel only Leonard and Blair (Finn posted her
// own feed). It showed as two cards; it should be one with Feed / Reel tabs.
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { consolidateCollabGroups } from "./collab-consolidate.ts";

function group(id: string, platform: "ig_feed" | "ig_reel" | "tiktok", names: string[]) {
  return {
    id, url: `https://x/${id}`, platform, platformLabel: platform, rawUrlKeys: [`${platform}|${id}`],
    athleteIds: names, athleteNames: names, combinedFollowers: names.length * 100,
    metrics: {}, combinedEngagementRate: 0,
    sources: [{ platform, url: `https://x/${id}`, metrics: {}, combinedEngagementRate: 0 }],
  } as any;
}

test("UNH: 2-athlete feed folds into the 3-athlete reel as one card", () => {
  const { merged, idToCanonical } = consolidateCollabGroups([
    group("reel", "ig_reel", ["Finn", "Leonard", "Blair"]),
    group("feed", "ig_feed", ["Leonard", "Blair"]),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "reel");
  assert.deepEqual(merged[0].athleteIds, ["Finn", "Leonard", "Blair"]);
  assert.deepEqual(merged[0].sources.map((s: any) => s.platform), ["ig_feed", "ig_reel"]);
  assert.equal(merged[0].platformLabel, "IG Feed + Reel");
  assert.equal(idToCanonical.feed, "reel");
});

test("subset order doesn't matter: feed listed first still folds into the bigger reel", () => {
  const { merged } = consolidateCollabGroups([
    group("feed", "ig_feed", ["Leonard", "Blair"]),
    group("reel", "ig_reel", ["Finn", "Leonard", "Blair"]),
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].athleteIds, ["Finn", "Leonard", "Blair"]);
});

test("two different reels never collapse, even when one team contains the other", () => {
  const { merged } = consolidateCollabGroups([
    group("r1", "ig_reel", ["A", "B", "C"]),
    group("r2", "ig_reel", ["A", "B"]),
  ]);
  assert.equal(merged.length, 2);
});

test("ambiguous subset (inside two different teams) stays its own card", () => {
  const { merged } = consolidateCollabGroups([
    group("f", "ig_feed", ["A", "B"]),
    group("r1", "ig_reel", ["A", "B", "C"]),
    group("r2", "tiktok", ["A", "B", "D"]),
  ]);
  assert.equal(merged.length, 3);
});

test("exact same team still merges as before; unrelated teams untouched", () => {
  const { merged } = consolidateCollabGroups([
    group("f", "ig_feed", ["A", "B"]),
    group("r", "ig_reel", ["B", "A"]),
    group("x", "ig_reel", ["C", "D"]),
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((g: any) => g.id === "x")!.sources.length, 1);
});
