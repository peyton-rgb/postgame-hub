// ============================================================
// Campaign page drafts — the JSON shapes stored in
// campaign_pages.content (migration 088) for the five pages a campaign
// generates: athlete contract, deal page, posting instructions, creator
// brief and recap. Plus the parsers that turn untrusted JSON (from the
// editor forms) back into those shapes, and the fixed option lists.
//
// Every draft carries `sources`: field name -> where the pre-fill came
// from ("Opt-in page", "SOW", ...). A field with no source was left
// empty on purpose because the campaign doesn't have that information
// yet; the editors show a hint instead of inventing a value.
//
// Client-safe: no server imports.
// ============================================================

export type PageKind = "contract" | "deal" | "posting" | "brief" | "recap";
export type DraftStatus = "draft" | "live";

export const PAGE_KINDS: PageKind[] = ["contract", "deal", "posting", "brief", "recap"];

export const PAGE_TITLES: Record<PageKind, string> = {
  contract: "Athlete contract",
  deal: "Deal page",
  posting: "Posting instructions",
  brief: "Creator brief",
  recap: "Recap",
};

export type Sources = Record<string, string>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const bool = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : d);
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
const ymd = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
function sources(v: unknown): Sources {
  const o = obj(v);
  const out: Sources = {};
  for (const k of Object.keys(o)) if (typeof o[k] === "string") out[k] = o[k] as string;
  return out;
}

// ------------------------------------------------------------
// Athlete contract
// ------------------------------------------------------------

/** Standard sections, in order, from the Postgame, LLC Athlete Agreement. */
export const STD_SECTIONS = [
  "Engagement",
  "Term",
  "Deliverables",
  "Exclusivity",
  "Ownership",
  "NIL rights license & usage",
  "Brand license",
  "Travel",
  "Brand usage period",
  "Termination",
  "Confidentiality",
  "Compensation & payment",
  "Force majeure",
  "Independent contractor",
  "Representations & warranties",
  "Compliance",
  "Indemnification",
  "Limitation of liability",
  "Third-party beneficiary",
  "General terms",
  "FTC disclosure instructions",
  "Code of conduct addendum",
];

export const USAGE_PERIODS = ["30 days", "60 days", "90 days", "120 days", "180 days", "1 year"];
export const TRAVEL_OPTIONS = [
  "Brand covers travel and lodging",
  "Postgame reimburses up to a set amount",
  "Athlete covers it (local event)",
];
export const CANCEL_OPTIONS = [
  "Paid in full if the brand cancels within 7 days",
  "Paid half if the brand cancels within 7 days",
  "Not paid",
];

export type ContractVariant = "standard" | "event";

/** The four event terms, as the agreement's own standard wording. */
export const EVENT_TERM_TEXT = {
  ev_appearance: "Athlete arrives by the call time, stays through the end of the event, and follows the run of show.",
  ev_travel: "Replaces the standard Travel section, which has athletes pay their own way.",
  ev_cancel: "If the athlete cancels, they tell Postgame at least 48 hours ahead.",
  ev_photos:
    "Postgame's videographer and the Brand may film and photograph the athlete at the event. Same usage period as above.",
};

export interface ContractDraft {
  variant: ContractVariant;
  // Schedule A · Scope of work
  brand: string;
  campaign_type: string;
  purpose: string;
  event_when: string;
  arrive_by: string;
  at_event: string;
  compensation: string;
  gifting: string;
  bonus: string;
  deliverables: string;
  usage_period: string;
  // Event terms (event variant only)
  ev_appearance: string;
  ev_travel: string;
  ev_cancel: string;
  ev_photos: string;
  travel_pays: string;
  cancel_terms: string;
  // Schedule B · Brand guidelines
  sb_instagram: string;
  sb_tiktok: string;
  sb_hashtags: string;
  sb_style: string;
  sources: Sources;
}

export function emptyContract(): ContractDraft {
  return {
    variant: "standard",
    brand: "",
    campaign_type: "",
    purpose: "",
    event_when: "",
    arrive_by: "",
    at_event: "",
    compensation: "",
    gifting: "",
    bonus: "",
    deliverables: "",
    usage_period: "",
    ...EVENT_TERM_TEXT,
    travel_pays: "",
    cancel_terms: "",
    sb_instagram: "",
    sb_tiktok: "",
    sb_hashtags: "",
    sb_style: "",
    sources: {},
  };
}

export function parseContract(v: unknown): ContractDraft {
  const o = obj(v);
  const e = emptyContract();
  const pick = (k: keyof ContractDraft) => str(o[k]).trim();
  return {
    variant: o.variant === "event" ? "event" : "standard",
    brand: pick("brand"),
    campaign_type: pick("campaign_type"),
    purpose: pick("purpose"),
    event_when: pick("event_when"),
    arrive_by: pick("arrive_by"),
    at_event: pick("at_event"),
    compensation: pick("compensation"),
    gifting: pick("gifting"),
    bonus: pick("bonus"),
    deliverables: pick("deliverables"),
    usage_period: USAGE_PERIODS.includes(pick("usage_period")) ? pick("usage_period") : "",
    ev_appearance: pick("ev_appearance") || e.ev_appearance,
    ev_travel: pick("ev_travel") || e.ev_travel,
    ev_cancel: pick("ev_cancel") || e.ev_cancel,
    ev_photos: pick("ev_photos") || e.ev_photos,
    travel_pays: TRAVEL_OPTIONS.includes(pick("travel_pays")) ? pick("travel_pays") : "",
    cancel_terms: CANCEL_OPTIONS.includes(pick("cancel_terms")) ? pick("cancel_terms") : "",
    sb_instagram: pick("sb_instagram"),
    sb_tiktok: pick("sb_tiktok"),
    sb_hashtags: pick("sb_hashtags"),
    sb_style: pick("sb_style"),
    sources: sources(o.sources),
  };
}

// ------------------------------------------------------------
// Deal page
// ------------------------------------------------------------

export interface DealDraft {
  welcome: string;
  pay: string;
  content_due: string; // YYYY-MM-DD or ""
  post_start: string;
  post_end: string;
  paid_by: string; // YYYY-MM-DD or ""
  sources: Sources;
}

export function emptyDeal(): DealDraft {
  return { welcome: "", pay: "", content_due: "", post_start: "", post_end: "", paid_by: "", sources: {} };
}

export function parseDeal(v: unknown): DealDraft {
  const o = obj(v);
  return {
    welcome: str(o.welcome).trim(),
    pay: str(o.pay).trim(),
    content_due: ymd(o.content_due),
    post_start: ymd(o.post_start),
    post_end: ymd(o.post_end),
    paid_by: ymd(o.paid_by),
    sources: sources(o.sources),
  };
}

// ------------------------------------------------------------
// Posting instructions
// ------------------------------------------------------------

export const FTC_OPTIONS = ["Paid partnership label + #ad", "#ad in caption", "Paid partnership label only"];
export type PostingDates = "one" | "spread" | "each";
export const DELIVERABLE_KEYS = ["reel", "feed", "story", "tiktok"] as const;
export type DeliverableKey = (typeof DELIVERABLE_KEYS)[number];
export const DELIVERABLE_LABELS: Record<DeliverableKey, string> = {
  reel: "Reel + cover",
  feed: "Feed photos",
  story: "Story",
  tiktok: "TikTok",
};

export interface PostingDraft {
  tag: string;
  hashtag: string;
  ftc: string;
  collab: boolean;
  dates: PostingDates;
  start: string;
  end: string;
  deliverables: Record<DeliverableKey, boolean>;
  only_approved: boolean;
  /** person id -> YYYY-MM-DD, used when dates === "each" */
  per_athlete: Record<string, string>;
  sources: Sources;
}

export function emptyPosting(): PostingDraft {
  return {
    tag: "",
    hashtag: "",
    ftc: "",
    collab: false,
    dates: "spread",
    start: "",
    end: "",
    deliverables: { reel: false, feed: false, story: false, tiktok: false },
    only_approved: true,
    per_athlete: {},
    sources: {},
  };
}

export function parsePosting(v: unknown): PostingDraft {
  const o = obj(v);
  const d = obj(o.deliverables);
  const pa = obj(o.per_athlete);
  const per: Record<string, string> = {};
  for (const k of Object.keys(pa)) if (ymd(pa[k])) per[k] = ymd(pa[k]);
  const ftc = str(o.ftc).trim();
  return {
    tag: str(o.tag).trim().replace(/^@/, ""),
    hashtag: str(o.hashtag).trim().replace(/^#/, ""),
    ftc: FTC_OPTIONS.includes(ftc) ? ftc : "",
    collab: bool(o.collab),
    dates: o.dates === "one" || o.dates === "each" ? o.dates : "spread",
    start: ymd(o.start),
    end: ymd(o.end),
    deliverables: { reel: bool(d.reel), feed: bool(d.feed), story: bool(d.story), tiktok: bool(d.tiktok) },
    only_approved: bool(o.only_approved, true),
    per_athlete: per,
    sources: sources(o.sources),
  };
}

// ------------------------------------------------------------
// Creator brief
// ------------------------------------------------------------

export interface BriefDraft {
  idea: string;
  product: string;
  shots: string[];
  dos: string;
  donts: string;
  content_due: string;
  upload_to: string;
  doc_link: string;
  sources: Sources;
}

export function emptyBrief(): BriefDraft {
  return { idea: "", product: "", shots: [], dos: "", donts: "", content_due: "", upload_to: "", doc_link: "", sources: {} };
}

export function parseBrief(v: unknown): BriefDraft {
  const o = obj(v);
  return {
    idea: str(o.idea).trim(),
    product: str(o.product).trim(),
    shots: strs(o.shots),
    dos: str(o.dos).trim(),
    donts: str(o.donts).trim(),
    content_due: ymd(o.content_due),
    upload_to: str(o.upload_to).trim(),
    doc_link: str(o.doc_link).trim(),
    sources: sources(o.sources),
  };
}

// ------------------------------------------------------------
// Recap
// ------------------------------------------------------------

export const RECAP_SECTIONS = ["Summary", "Headline numbers", "Top posts", "Top athletes", "Platform split", "Content gallery"];

export interface RecapDraft {
  tracker_link: string;
  summary: string;
  include: Record<string, boolean>;
  /** snapshot of the tracker's RECAP SUMMARY grid at the last save */
  numbers: string[][];
  numbers_read_at: string;
  sources: Sources;
}

export function emptyRecap(): RecapDraft {
  const include: Record<string, boolean> = {};
  for (const s of RECAP_SECTIONS) include[s] = true;
  return { tracker_link: "", summary: "", include, numbers: [], numbers_read_at: "", sources: {} };
}

export function parseRecap(v: unknown): RecapDraft {
  const o = obj(v);
  const inc = obj(o.include);
  const include: Record<string, boolean> = {};
  for (const s of RECAP_SECTIONS) include[s] = bool(inc[s], true);
  const numbers = Array.isArray(o.numbers)
    ? o.numbers.slice(0, 40).map((r) => (Array.isArray(r) ? r.slice(0, 12).map((c) => str(c)) : []))
    : [];
  return {
    tracker_link: str(o.tracker_link).trim(),
    summary: str(o.summary).trim(),
    include,
    numbers,
    numbers_read_at: str(o.numbers_read_at),
    sources: sources(o.sources),
  };
}

// ------------------------------------------------------------
// Generic
// ------------------------------------------------------------

export function parseDraft(kind: PageKind, v: unknown) {
  switch (kind) {
    case "contract":
      return parseContract(v);
    case "deal":
      return parseDeal(v);
    case "posting":
      return parsePosting(v);
    case "brief":
      return parseBrief(v);
    case "recap":
      return parseRecap(v);
  }
}

/** Google Sheets id from a pasted link (or the id itself); null when it isn't one. */
export function sheetIdFromLink(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(v);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(v.trim()) ? v.trim() : null;
}

/** "Saturday, November 15, 2026" from YYYY-MM-DD; "" when unset. */
export function longDate(v: string | null | undefined): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return "";
  const d = new Date(v.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** "Nov 15" from YYYY-MM-DD; "" when unset. */
export function shortDate(v: string | null | undefined): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return "";
  const d = new Date(v.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
