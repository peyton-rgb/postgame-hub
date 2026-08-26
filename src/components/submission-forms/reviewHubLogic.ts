// src/components/submission-forms/reviewHubLogic.ts
// ============================================================
// The review hub's derivation rules, kept out of the component.
//
// These are the spec — the flag thresholds, the needs-attention rule and the
// per-athlete rollup are what the design was signed off on, not an
// implementation detail. Sitting in a plain module they can be read and
// tested on their own; inside a useMemo they could only be exercised by
// driving the UI.
//
// Everything here is pure. Nothing imports React.
// ============================================================

export interface FileRow {
  id: string;
  athleteName: string;
  school: string | null;
  assetType: "photo" | "video" | "unknown";
  fileName: string;
  fileUrl: string | null;
  thumbUrl: string | null;
  composite: number | null;
  composition: number | null;
  lighting: number | null;
  subject: number | null;
  brandVisibility: number | null;
  // Null on EVERY video, by design: the hook is scored from a poster frame,
  // which cannot carry a temporal property, and the composite renormalises
  // over the other four. Callers must render it blank, never zero.
  hook: number | null;
  tags: string[];
  status: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  reviewInstructions: Instruction[] | null;
  reviewedAtStage: string | null;
}

// One reviewer instruction queued against a file. `source` separates what the
// scorer inferred from what a person actually asked for; downstream those
// carry different weight, so the distinction is stored rather than derived.
export interface Instruction {
  source: "flag" | "note";
  text: string;
  timecode?: number;
}

export interface Flag {
  text: string;
  why: string;
  high: boolean;
}

export interface Athlete {
  key: string;
  name: string;
  school: string | null;
  files: FileRow[];
  photos: number;
  videos: number;
  avg: number | null;
  lighting: number | null;
  subject: number | null;
  brandVisibility: number | null;
  hook: number | null;
  short: boolean;
  weak: boolean;
}

export interface Requirements {
  minPhotos: number;
  minVideos: number;
}

// The score→colour ramp from the prototype. null is the grey track, which is
// how an unscored dimension (every video's hook) reads as absent rather than
// as a zero.
export const col = (v: number | null) =>
  v == null ? "rgba(255,255,255,.22)" : v >= 70 ? "var(--good)" : v >= 50 ? "var(--mid)" : "var(--bad)";

export const fmt = (s: number) => `${Math.floor(s / 60)}:${s % 60 < 10 ? "0" : ""}${(s % 60).toFixed(1)}`;

export const mean = (vals: (number | null)[]): number | null => {
  const v = vals.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

// Thumbnails are stored at w400 for the rail. The stage wants the big one, so
// the size parameter is rewritten rather than the URL rebuilt — the file id is
// the only part worth trusting and it stays untouched.
export const bigImage = (url: string | null) => (url ? url.replace(/sz=w\d+/, "sz=w1600") : null);

// Flags are DERIVED at render time from the scores, never stored. Storing them
// would freeze a judgement made by a scorer that keeps changing; deriving them
// means a re-score is reflected the next time the file is opened.
//
// Ported from the prototype's flagsFor(). The thresholds are the spec — the
// order matters too, because it is the order the reviewer reads them in.
export function flagsFor(d: FileRow): Flag[] {
  const out: Flag[] = [];
  const t = d.tags ?? [];
  const add = (text: string, why: string, high = false) => out.push({ text, why, high });
  const r = (v: number) => Math.round(v);

  if (d.brandVisibility === 0) add("Product not in frame", "Brand visibility scored 0", true);
  else if (d.brandVisibility != null && d.brandVisibility < 45)
    add("Crop tighter on the product", `Brand visibility ${r(d.brandVisibility)}`, true);

  if (d.lighting != null && d.lighting < 45) add("Lift the exposure", `Lighting ${r(d.lighting)}`, true);
  else if (t.includes("low_light")) add("Lift the exposure", "Tagged low light");

  if (t.includes("cluttered")) add("Clean up the background", "Tagged cluttered");
  if (t.includes("landscape_format")) add("Reframe to vertical", "Shot landscape, social needs 9:16", true);
  if (d.subject != null && d.subject < 45) add("Subject is weak", `Subject ${r(d.subject)} — may not be usable`, true);
  if (t.includes("motion_blur")) add("Check motion blur", "Tagged motion blur");
  if (d.composition != null && d.composition < 50) add("Recompose", `Composition ${r(d.composition)}`);

  return out;
}

// Athletes are grouped by NAME, not by submission_id. Some files link to a
// parent `submissions` row and some do not (older uploads, and link-ups that
// failed), so the same athlete can hold both. Grouping by the parent id splits
// them in two — Marcellus Nash on the live SVA campaign is exactly that case.
export function buildAthletes(files: FileRow[], req: Requirements): Athlete[] {
  const byName = new Map<string, FileRow[]>();
  for (const f of files) {
    const key = f.athleteName.trim().toLowerCase() || "?";
    const list = byName.get(key);
    if (list) list.push(f);
    else byName.set(key, [f]);
  }

  // Array.from, not a spread: the build targets es5, where spreading a Map
  // iterator needs downlevelIteration and does not compile without it.
  return Array.from(byName.entries())
    .map(([key, group]) => {
      // Counted explicitly rather than as "everything that is not a photo":
      // asset_type also allows 'unknown', which is neither and must not
      // silently satisfy the video minimum.
      const photos = group.filter((f) => f.assetType === "photo").length;
      const videos = group.filter((f) => f.assetType === "video").length;
      const bv = mean(group.map((f) => f.brandVisibility));
      const first = group.find((f) => f.school) ?? group[0];
      return {
        key,
        name: first.athleteName,
        school: first.school,
        files: group,
        photos,
        videos,
        avg: mean(group.map((f) => f.composite)),
        lighting: mean(group.map((f) => f.lighting)),
        subject: mean(group.map((f) => f.subject)),
        brandVisibility: bv,
        hook: mean(group.map((f) => f.hook)),
        short: photos < req.minPhotos || videos < req.minVideos,
        // An athlete with no brand-visibility score at all is not "weak" —
        // absent evidence is not evidence of a problem, so the fallback is a
        // pass, matching the prototype.
        weak: (bv ?? 100) < 50,
      };
    })
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
}

// Short of the required counts, or a mean brand visibility under 50. Test
// uploads are excluded upstream by the API and never reach this.
export const needsAttention = (t: Athlete) => t.short || t.weak;
