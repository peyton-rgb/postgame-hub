// ============================================================
// Opt-in page data — one plain object shared by the builder form,
// the live preview and the public /join page.
//
// Storage: public.campaign_optin_pages (migration 083) plus the
// `timeline`, `eligibility` and `hero_media_url` columns migration 084
// adds. `fromRow` tolerates a row without the 084 columns; `toRow`
// splits the write into the 083 part and the 084 part so the save
// action can retry without the new columns if they aren't there yet.
//
// Client-safe: no server imports.
// ============================================================

export interface OptinExample {
  url: string;
  caption: string;
}

export interface OptinStep {
  label: string;
  date: string;
}

export interface OptinEligibility {
  show: boolean;
  who: string;
  sports: string;
  colleges: string;
  min_followers: string;
}

export interface OptinPageData {
  headline: string;
  content_type: string;
  description: string;
  compensation: string;
  about: string;
  required_posts: string[];
  optin_deadline: string; // YYYY-MM-DD or ""
  bonus_note: string;
  examples: OptinExample[];
  next_steps: string;
  timeline: OptinStep[];
  ig_hashtags: string[];
  ig_mentions: string[];
  tiktok_hashtags: string[];
  tiktok_mentions: string[];
  eligibility: OptinEligibility;
  hero_media_url: string;
}

export const DEFAULT_TIMELINE: OptinStep[] = [
  { label: "Opt in", date: "" },
  { label: "Selected", date: "" },
  { label: "Create", date: "" },
  { label: "Post", date: "" },
  { label: "Get paid", date: "" },
];

export function emptyOptinPage(): OptinPageData {
  return {
    headline: "",
    content_type: "",
    description: "",
    compensation: "",
    about: "",
    required_posts: [],
    optin_deadline: "",
    bonus_note: "",
    examples: [],
    next_steps: "",
    timeline: DEFAULT_TIMELINE.map((s) => ({ ...s })),
    ig_hashtags: [],
    ig_mentions: [],
    tiktok_hashtags: [],
    tiktok_mentions: [],
    eligibility: { show: false, who: "", sports: "", colleges: "", min_followers: "" },
    hero_media_url: "",
  };
}

/** The campaign_optin_pages row shape (083 columns required, 084 optional). */
export interface OptinPageRow {
  campaign_id: number;
  headline: string | null;
  content_type: string | null;
  description: string | null;
  compensation: string | null;
  about_html: string | null;
  required_posts: string[] | null;
  optin_deadline: string | null;
  bonus_note_html: string | null;
  example_images: unknown;
  next_steps_html: string | null;
  ig_hashtags: string[] | null;
  ig_mentions: string[] | null;
  tiktok_hashtags: string[] | null;
  tiktok_mentions: string[] | null;
  timeline?: unknown;
  eligibility?: unknown;
  hero_media_url?: string | null;
  updated_at?: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function parseExamples(v: unknown): OptinExample[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === "string") return { url: x, caption: "" };
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        return { url: str(o.url), caption: str(o.caption) };
      }
      return null;
    })
    .filter((x): x is OptinExample => !!x && (x.url !== "" || x.caption !== ""));
}

function parseTimeline(v: unknown): OptinStep[] {
  if (!Array.isArray(v) || v.length === 0) return DEFAULT_TIMELINE.map((s) => ({ ...s }));
  return v
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      return { label: str(o.label), date: str(o.date) };
    })
    .filter((x): x is OptinStep => !!x);
}

function parseEligibility(v: unknown): OptinEligibility {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    show: o.show === true,
    who: str(o.who),
    sports: str(o.sports),
    colleges: str(o.colleges),
    min_followers: str(o.min_followers),
  };
}

export function fromRow(row: OptinPageRow | null | undefined): OptinPageData {
  if (!row) return emptyOptinPage();
  return {
    headline: str(row.headline),
    content_type: str(row.content_type),
    description: str(row.description),
    compensation: str(row.compensation),
    about: str(row.about_html),
    required_posts: strs(row.required_posts),
    optin_deadline: str(row.optin_deadline).slice(0, 10),
    bonus_note: str(row.bonus_note_html),
    examples: parseExamples(row.example_images),
    next_steps: str(row.next_steps_html),
    timeline: parseTimeline(row.timeline),
    ig_hashtags: strs(row.ig_hashtags),
    ig_mentions: strs(row.ig_mentions),
    tiktok_hashtags: strs(row.tiktok_hashtags),
    tiktok_mentions: strs(row.tiktok_mentions),
    eligibility: parseEligibility(row.eligibility),
    hero_media_url: str(row.hero_media_url),
  };
}

/** Normalise untrusted JSON (from the builder form) into OptinPageData. */
export function parseOptinPage(v: unknown): OptinPageData {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const clean = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean);
  return {
    headline: str(o.headline).trim(),
    content_type: str(o.content_type).trim(),
    description: str(o.description).trim(),
    compensation: str(o.compensation).trim(),
    about: str(o.about).trim(),
    required_posts: clean(strs(o.required_posts)),
    optin_deadline: /^\d{4}-\d{2}-\d{2}$/.test(str(o.optin_deadline)) ? str(o.optin_deadline) : "",
    bonus_note: str(o.bonus_note).trim(),
    examples: parseExamples(o.examples).map((e) => ({ url: e.url.trim(), caption: e.caption.trim() })),
    next_steps: str(o.next_steps).trim(),
    timeline: parseTimeline(o.timeline).map((s) => ({ label: s.label.trim(), date: s.date.trim() })),
    ig_hashtags: clean(strs(o.ig_hashtags)),
    ig_mentions: clean(strs(o.ig_mentions)),
    tiktok_hashtags: clean(strs(o.tiktok_hashtags)),
    tiktok_mentions: clean(strs(o.tiktok_mentions)),
    eligibility: parseEligibility(o.eligibility),
    hero_media_url: str(o.hero_media_url).trim(),
  };
}

/** Split into the 083 columns and the 084 columns. */
export function toRow(campaignId: number, d: OptinPageData) {
  const base = {
    campaign_id: campaignId,
    headline: d.headline || null,
    content_type: d.content_type || null,
    description: d.description || null,
    compensation: d.compensation || null,
    about_html: d.about || null,
    required_posts: d.required_posts,
    optin_deadline: d.optin_deadline || null,
    bonus_note_html: d.bonus_note || null,
    example_images: d.examples,
    next_steps_html: d.next_steps || null,
    ig_hashtags: d.ig_hashtags,
    ig_mentions: d.ig_mentions,
    tiktok_hashtags: d.tiktok_hashtags,
    tiktok_mentions: d.tiktok_mentions,
  };
  const extras = {
    timeline: d.timeline,
    eligibility: d.eligibility,
    hero_media_url: d.hero_media_url || null,
  };
  return { base, extras };
}

/** "Saturday, November 15" from YYYY-MM-DD; "" when unset. */
export function formatDeadline(ymd: string, opts?: { short?: boolean }): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const d = new Date(ymd + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", opts?.short
    ? { month: "short", day: "numeric" }
    : { weekday: "long", month: "long", day: "numeric" });
}

/** Event details the preview shows for event campaigns. */
export interface OptinEventInfo {
  date: string | null; // YYYY-MM-DD
  start_time: string | null; // HH:MM
  venue: string | null;
  call_time: string | null;
}

export function formatEventDate(ymd: string | null): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return "";
  const d = new Date(ymd.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function formatClock(hm: string | null): string {
  if (!hm) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(hm);
  if (!m) return hm;
  const h = Number(m[1]);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}
