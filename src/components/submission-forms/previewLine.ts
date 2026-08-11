// src/components/submission-forms/previewLine.ts
// ─────────────────────────────────────────────────────────────
// The sentence the athlete actually reads, assembled from the live field
// values. Shared by the create modal and the settings panel for the same
// reason the fields are: two copies drift, and a preview that has drifted
// from the page it previews is worse than no preview.
//
// Null deliverables drops the posts sentence — the athlete page does exactly
// this, which is what makes "off" different from 0.
// ─────────────────────────────────────────────────────────────

const plural = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function previewLine({
  minPhotos,
  minVideos,
  deliverables,
  expiresAt,
}: {
  minPhotos: number;
  minVideos: number;
  deliverables: number | null;
  expiresAt: string | null;
}): string {
  const parts = [
    `Send ${minPhotos} ${plural(minPhotos, "photo")} and ${minVideos} ${plural(minVideos, "video")}.`,
  ];
  if (deliverables != null) parts.push(`This covers ${deliverables} ${plural(deliverables, "post")}.`);
  if (expiresAt) parts.push(`Link expires ${fmtDate(expiresAt)}.`);
  return parts.join(" ");
}
