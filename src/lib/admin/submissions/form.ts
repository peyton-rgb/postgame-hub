// ============================================================
// Content submission form — the editable fields on
// content_submission_forms (migration 087) as one typed object.
//
// Shared by the Settings editor (client), the save action (server) and
// the public /submit page (which receives it through the link API), so
// the three can never disagree about what a "deliverable" looks like.
// No Supabase imports here on purpose: this file is safe in the browser.
// ============================================================

export type DeliverableKind = "photo" | "video";

export interface Deliverable {
  kind: DeliverableKind;
  /** how many of this kind the athlete must upload (1+) */
  count: number;
  /** what it should be, e.g. "Reel, 15–30s, vertical" */
  note: string;
}

export interface SubmissionFormData {
  title: string;
  instructions: string;
  /** lower-case extensions without the dot; empty = any image/video */
  accepted_types: string[];
  /** per-file cap in MB; null = no cap */
  max_size_mb: number | null;
  deliverables: Deliverable[];
  /** YYYY-MM-DD or "" */
  deadline: string;
  /** one confirmation per line */
  consent_text: string;
  confirmation_text: string;
}

export const DEFAULT_CONSENT_LINES = [
  "I've read the campaign instructions and my content follows them.",
  "If I add music to a Reel, I'll use a copyright-free track from Instagram's commercial library.",
];

export const DEFAULT_ACCEPTED_TYPES = ["jpg", "jpeg", "png", "heic", "mp4", "mov"];

export const EMPTY_FORM: SubmissionFormData = {
  title: "",
  instructions: "",
  accepted_types: [],
  max_size_mb: null,
  deliverables: [],
  deadline: "",
  consent_text: "",
  confirmation_text: "",
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function parseDeliverables(raw: unknown): Deliverable[] {
  if (!Array.isArray(raw)) return [];
  const out: Deliverable[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kind: DeliverableKind = o.kind === "video" ? "video" : "photo";
    const n = Math.floor(Number(o.count ?? o.n ?? 1));
    out.push({ kind, count: Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 1, note: str(o.note).slice(0, 160) });
  }
  return out.slice(0, 12);
}

export function parseAcceptedTypes(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s·]+/) : [];
  const seen = new Set<string>();
  for (const t of list) {
    const ext = str(t).trim().toLowerCase().replace(/^\./, "");
    if (/^[a-z0-9]{1,8}$/.test(ext)) seen.add(ext);
  }
  return Array.from(seen).slice(0, 24);
}

/** Normalise anything (a DB row, a posted JSON blob) into SubmissionFormData. */
export function parseSubmissionForm(raw: unknown): SubmissionFormData {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const size = Number(o.max_size_mb);
  return {
    title: str(o.title).slice(0, 120),
    instructions: str(o.instructions).slice(0, 1000),
    accepted_types: parseAcceptedTypes(o.accepted_types),
    max_size_mb: Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 100000) : null,
    deliverables: parseDeliverables(o.deliverables),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(str(o.deadline)) ? str(o.deadline) : "",
    consent_text: str(o.consent_text).slice(0, 2000),
    confirmation_text: str(o.confirmation_text).slice(0, 600),
  };
}

/** The confirmation checkboxes: the saved lines, or the two defaults. */
export function consentLines(form: Pick<SubmissionFormData, "consent_text">): string[] {
  const lines = form.consent_text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length ? lines : DEFAULT_CONSENT_LINES;
}

/** min_photos / min_videos implied by the checklist (kept in step on save). */
export function deliverableTotals(items: Deliverable[]): { photos: number; videos: number; files: number } {
  let photos = 0;
  let videos = 0;
  for (const d of items) {
    if (d.kind === "video") videos += d.count;
    else photos += d.count;
  }
  return { photos, videos, files: photos + videos };
}

/** "JPG, PNG, HEIC · MP4, MOV" for the limits line. */
export function acceptedTypesLabel(types: string[]): string {
  if (types.length === 0) return "Photos and video";
  const img = types.filter((t) => /^(jpe?g|png|heic|heif|webp|gif|tiff?|raw|cr3|arw|dng)$/.test(t));
  const vid = types.filter((t) => !img.includes(t));
  const up = (xs: string[]) => xs.map((t) => t.toUpperCase()).join(", ");
  return [img.length ? up(img) : "", vid.length ? up(vid) : ""].filter(Boolean).join(" · ");
}

/** Human size cap: 200 MB · 10 GB. */
export function sizeLabel(mb: number | null): string {
  if (mb == null) return "";
  return mb >= 1024 && mb % 1024 === 0 ? `${mb / 1024} GB` : `${mb} MB`;
}

/** The `accept` attribute for a file input, from the saved extensions. */
export function acceptAttribute(types: string[]): string {
  if (types.length === 0) return "image/*,video/*,.heic,.heif";
  return types.map((t) => `.${t}`).join(",");
}
