// src/lib/collab-consolidate.ts
// ─────────────────────────────────────────────────────────────
// Consolidate the per-PLATFORM collab groups that detectCollabGroups emits
// (one group per feed/reel/tiktok URL) into ONE group per athlete-set, so a
// team that shared both a feed and a reel renders as a single card with each
// platform shown as a tag — instead of two duplicate cards.
//
// Purely a presentation/grouping transform, downstream of detectCollabGroups.
// The per-platform group ids stay intact as the media keys (drive_file_id =
// "collab:<platform-hash>"); this helper only picks a CANONICAL id per set and
// maps the members onto it, plus stamps each merged source with the id of the
// group it came from so per-source consumers (Top Performers) still key media
// to the exact platform post — no renderer change, no DB write.
// ─────────────────────────────────────────────────────────────

import type { CollabGroup, CollabSource } from "./types";

const setKey = (ids: string[]) => [...ids].sort().join("|");
const RANK: Record<CollabGroup["platform"], number> = { ig_feed: 0, ig_reel: 1, tiktok: 2 };

const PLATFORM_ORDER = (a: CollabSource, b: CollabSource) => RANK[a.platform] - RANK[b.platform];

/** "IG Feed + Reel"-style label from the union of source platforms (feed→reel→tiktok). */
function mergedPlatformLabel(sources: CollabSource[]): string {
  const NAME: Record<CollabGroup["platform"], string> = { ig_feed: "IG Feed", ig_reel: "IG Reel", tiktok: "TikTok" };
  const seen: CollabGroup["platform"][] = [];
  for (const s of [...sources].sort(PLATFORM_ORDER)) if (!seen.includes(s.platform)) seen.push(s.platform);
  if (seen.length <= 1) return seen.length ? NAME[seen[0]] : "";
  // "IG Feed + Reel" reads better than "IG Feed + IG Reel" when both are IG.
  return seen.map((p, i) => (i > 0 && p.startsWith("ig_") ? NAME[p].replace("IG ", "") : NAME[p])).join(" + ");
}

export type ConsolidatedCollab = {
  /** One group per athlete-set; sources union every platform, ordered feed→reel→tiktok. */
  merged: CollabGroup[];
  /** Original per-platform group id → canonical (merged) group id. */
  idToCanonical: Record<string, string>;
  /** Canonical group id → the original member group ids folded into it. */
  membersByCanonical: Record<string, string[]>;
};

/**
 * Group per-platform collab groups by athlete-set and merge each set into one
 * group. Single-platform sets pass through unchanged (same id, same object) so
 * their rendering — and their media key — is byte-identical to before.
 */
export function consolidateCollabGroups(groups: CollabGroup[]): ConsolidatedCollab {
  const bySet = new Map<string, CollabGroup[]>();
  const order: string[] = [];
  for (const g of groups) {
    const k = setKey(g.athleteIds);
    if (!bySet.has(k)) { bySet.set(k, []); order.push(k); }
    bySet.get(k)!.push(g);
  }

  const merged: CollabGroup[] = [];
  const idToCanonical: Record<string, string> = {};
  const membersByCanonical: Record<string, string[]> = {};

  for (const k of order) {
    const members = bySet.get(k)!;
    // Canonical group: prefer a reel/tiktok member so the renderer's
    // reel-only "Collab Reel" filter (which keys off group.platform) still
    // includes a multi-platform team; otherwise the lowest-rank member.
    const sorted = [...members].sort((a, b) => RANK[a.platform] - RANK[b.platform]);
    const canonical = sorted.find((g) => g.platform === "ig_reel" || g.platform === "tiktok") ?? sorted[0];

    for (const g of members) idToCanonical[g.id] = canonical.id;
    membersByCanonical[canonical.id] = members.map((g) => g.id);

    if (members.length === 1) {
      // Unchanged — no copy, no relabel. Keeps single-platform cards identical.
      merged.push(canonical);
      continue;
    }

    // Union every platform's sources, stamping each with its origin group id so
    // Top Performers can still key media to the exact platform post.
    const sources: CollabSource[] = members
      .flatMap((g) => g.sources.map((s) => ({ ...s, srcGroupId: g.id })))
      .sort(PLATFORM_ORDER);
    const rawUrlKeys = Array.from(new Set(members.flatMap((g) => g.rawUrlKeys)));

    merged.push({
      ...canonical,
      sources,
      rawUrlKeys,
      platformLabel: mergedPlatformLabel(sources),
    });
  }

  return { merged, idToCanonical, membersByCanonical };
}

/**
 * Re-key a media-by-key map so a merged card resolves all its platforms' media
 * under the canonical id, while ALSO leaving each original per-platform key in
 * place (Top Performers reads media per platform post). Non-collab keys
 * (athlete ids) pass through untouched.
 */
export function rekeyCollabMedia<T>(
  mediaByKey: Record<string, T[]>,
  membersByCanonical: Record<string, string[]>,
): Record<string, T[]> {
  const out: Record<string, T[]> = { ...mediaByKey };
  for (const [canonical, memberIds] of Object.entries(membersByCanonical)) {
    if (memberIds.length <= 1) continue; // single-platform: canonical === its own key already
    const union: T[] = [];
    for (const id of memberIds) for (const m of mediaByKey[id] || []) union.push(m);
    out[canonical] = union;
  }
  return out;
}
