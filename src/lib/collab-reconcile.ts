// src/lib/collab-reconcile.ts
// ─────────────────────────────────────────────────────────────
// B-lite additive reconciliation between URL-derived collab groups
// (detectCollabGroups → id "ig_reel-<hash>") and container-derived
// groups for teams whose shared post URL isn't in the tracker yet.
//
// A pre-URL team's imported content is tagged drive_file_id =
// "collab:c-<containerId>-<slot>". This helper:
//   • emits a container-derived CollabGroup for each (container, slot)
//     that has imported media but no matching URL group yet, so the
//     card renders and the content shows; and
//   • returns a remap { containerKey -> urlGroupId } for the case where
//     a URL group DOES exist for that (team, slot) — so the container-
//     keyed media folds into the URL card at render time.
//
// Purely additive: no media row is ever rewritten. Once a shared URL
// appears, detectCollabGroups produces a URL group for that athlete set,
// the container media remaps onto it, and the standalone container card
// stops being emitted — reconciliation with zero DB writes.
// ─────────────────────────────────────────────────────────────

import type { CollabGroup } from "./types";

export type ContainerLite = {
  containerId: string;
  athleteIds: string[];
};

const setKey = (ids: string[]) => [...ids].sort().join("|");

/** Stable collab tag/group id for a pre-URL team's content in a feed/reel slot. */
export const containerGroupId = (containerId: string, slot: "feed" | "reel") =>
  `c-${containerId}-${slot}`;

/**
 * @param urlGroups         URL-derived groups from detectCollabGroups.
 * @param containers        collab_containers (id + athlete membership).
 * @param collabMediaCount  how many media rows carry a given collab key.
 * @param athleteName       resolve an athlete id to a display name.
 */
export function deriveContainerCollab(
  urlGroups: CollabGroup[],
  containers: ContainerLite[],
  collabMediaCount: (key: string) => number,
  athleteName: (id: string) => string | undefined,
): { containerGroups: CollabGroup[]; remap: Record<string, string> } {
  const remap: Record<string, string> = {};
  const containerGroups: CollabGroup[] = [];

  for (const c of containers) {
    for (const slot of ["feed", "reel"] as const) {
      const platform = slot === "feed" ? "ig_feed" : "ig_reel";
      const key = containerGroupId(c.containerId, slot);
      const urlGroup = urlGroups.find(
        (g) => setKey(g.athleteIds) === setKey(c.athleteIds) && g.platform === platform,
      );

      if (urlGroup) {
        // Reconcile: fold any container-keyed media into the URL card.
        remap[key] = urlGroup.id;
        continue;
      }
      // No URL yet — only surface a standalone card once it has content.
      if (collabMediaCount(key) === 0) continue;

      containerGroups.push({
        id: key,
        url: "",
        platform,
        platformLabel: platform === "ig_feed" ? "IG Feed" : "IG Reel",
        sources: [],
        rawUrlKeys: [],
        athleteIds: c.athleteIds,
        athleteNames: c.athleteIds
          .map(athleteName)
          .filter((n): n is string => !!n),
        combinedFollowers: 0,
        metrics: {},
        combinedEngagementRate: 0,
      });
    }
  }

  return { containerGroups, remap };
}
