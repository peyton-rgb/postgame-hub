// ============================================================
// Campaign pages — server only.
//
// Loads the campaign_pages rows (migration 088, feature-detected) and
// builds the PRE-FILLED draft for each kind from what the campaign
// already has: the campaigns row (+084 extras), the brand, the opt-in
// page, the posting settings and creator brief rows the old admin
// wrote, and the storage pointers. Each pre-fill reports where every
// value came from; a field with nothing behind it stays empty.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/admin/auth";
import type { CampaignBundle, Playbook } from "./queries";
import { campaignTypeLabel } from "./types";
import { formatClock, formatEventDate, type OptinPageData } from "./optin-page";
import {
  emptyBrief,
  emptyContract,
  emptyDeal,
  emptyPosting,
  emptyRecap,
  parseDraft,
  longDate,
  sheetIdFromLink,
  type BriefDraft,
  type ContractDraft,
  type DealDraft,
  type DeliverableKey,
  type DraftStatus,
  type PageKind,
  type PostingDraft,
  type RecapDraft,
  type Sources,
} from "./page-drafts";

type Db = SupabaseClient<any, "public", any>;

// ------------------------------------------------------------
// campaign_pages rows
// ------------------------------------------------------------

export interface CampaignPageRow {
  id: string;
  campaign_id: number;
  kind: PageKind;
  status: DraftStatus;
  variant: string | null;
  content: unknown;
  filled_from: unknown;
  updated_at: string;
}

export interface CampaignPages {
  /** migration 088 not applied: nothing can be saved yet */
  pending: boolean;
  byKind: Partial<Record<PageKind, CampaignPageRow>>;
}

export async function loadCampaignPages(supabase: Db, id: number): Promise<CampaignPages> {
  const { data, error } = await supabase
    .from("campaign_pages")
    .select("id, campaign_id, kind, status, variant, content, filled_from, updated_at")
    .eq("campaign_id", id);
  if (error) return { pending: isMissingSchemaError(error), byKind: {} };
  const byKind: Partial<Record<PageKind, CampaignPageRow>> = {};
  for (const r of (data ?? []) as CampaignPageRow[]) byKind[r.kind] = r;
  return { pending: false, byKind };
}

export function filledFrom(row: CampaignPageRow | undefined): string[] {
  return Array.isArray(row?.filled_from) ? (row!.filled_from as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

// ------------------------------------------------------------
// Pre-fill sources
// ------------------------------------------------------------

export interface DraftSources {
  bundle: CampaignBundle;
  playbook: Playbook;
  optin: OptinPageData;
  posting: { tag_handle: string | null; hashtag: string | null; ftc_note: string | null; deliverables: unknown } | null;
  brief: { due_date: string | null; deliverables: unknown; brief_text: string | null; must_say: string[] | null; avoid: string[] | null } | null;
}

export async function loadDraftSources(supabase: Db, id: number, bundle: CampaignBundle, playbook: Playbook): Promise<DraftSources> {
  const [posting, brief] = await Promise.all([
    supabase.from("content_posting_settings").select("tag_handle, hashtag, ftc_note, deliverables").eq("campaign_id", id).maybeSingle(),
    supabase.from("campaign_creator_briefs").select("due_date, deliverables, brief_text, must_say, avoid").eq("campaign_id", id).maybeSingle(),
  ]);
  return {
    bundle,
    playbook,
    optin: playbook.optinPage.data,
    posting: (posting.data as DraftSources["posting"]) ?? null,
    brief: (brief.data as DraftSources["brief"]) ?? null,
  };
}

export interface Prefilled<T> {
  content: T;
  filled_from: string[];
}

const SRC = {
  settings: "Campaign settings",
  optin: "Opt-in page",
  event: "Event details",
  brand: "Brand",
  posting: "Posting settings",
  brief: "Creator brief",
  form: "Content submission form",
  tracker: "Performance tracker",
  agreement: "Standard agreement",
  docs: "Campaign Brief",
};

function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

/** Date of a timeline step whose label matches (e.g. "Create" / "Post"), or "". */
function stepDate(optin: OptinPageData, re: RegExp): string {
  const s = optin.timeline.find((t) => re.test(t.label) && /^\d{4}-\d{2}-\d{2}$/.test(t.date));
  return s?.date ?? "";
}

function firstTag(list: string[], prefix: "@" | "#"): string {
  const t = list.find((x) => x.trim());
  return t ? (t.startsWith(prefix) ? t : prefix + t) : "";
}

// ---- Athlete contract ----

export function prefillContract(s: DraftSources): Prefilled<ContractDraft> {
  const { campaign: c, extras, brand } = s.bundle;
  const d = emptyContract();
  const src: Sources = {};
  const from: string[] = [SRC.agreement];
  const ev = extras.campaign_type === "event";
  d.variant = ev ? "event" : "standard";

  if (brand?.name) {
    d.brand = brand.name;
    src.brand = SRC.settings;
  }
  d.campaign_type = ev ? "Event appearance" : "Social media campaign";
  src.campaign_type = SRC.settings;
  from.push(SRC.settings);

  if (s.optin.description) {
    d.purpose = s.optin.description;
    src.purpose = SRC.optin;
  } else if (c.campaign_note) {
    d.purpose = c.campaign_note;
    src.purpose = SRC.settings;
  }

  if (ev) {
    const when = [formatEventDate(extras.event_date), formatClock(extras.event_start_time), extras.event_venue].filter(Boolean).join(" · ");
    if (when) {
      d.event_when = when;
      src.event_when = SRC.event;
    }
    if (extras.event_call_time) {
      d.arrive_by = `${formatClock(extras.event_call_time)} (call time)`;
      src.arrive_by = SRC.event;
    }
    if (extras.event_activities) {
      d.at_event = extras.event_activities;
      src.at_event = SRC.event;
    }
    if (when || extras.event_call_time || extras.event_activities) from.push(SRC.event);
  }

  if (s.optin.compensation) {
    d.compensation = s.optin.compensation;
    src.compensation = SRC.optin;
  }
  if (s.optin.bonus_note) {
    d.bonus = s.optin.bonus_note;
    src.bonus = SRC.optin;
  }
  if (s.optin.required_posts.length) {
    d.deliverables = s.optin.required_posts.join(" · ");
    src.deliverables = SRC.optin;
  }

  // Schedule B — brand handles from the campaign row first, then the opt-in page.
  const ig = c.instagram_mention ? "@" + c.instagram_mention.replace(/^@/, "") : firstTag(s.optin.ig_mentions, "@");
  const tt = c.tiktok_mention ? "@" + c.tiktok_mention.replace(/^@/, "") : firstTag(s.optin.tiktok_mentions, "@");
  if (ig) {
    d.sb_instagram = ig;
    src.sb_instagram = c.instagram_mention ? SRC.settings : SRC.optin;
  }
  if (tt) {
    d.sb_tiktok = tt;
    src.sb_tiktok = c.tiktok_mention ? SRC.settings : SRC.optin;
  }
  const tags = uniq(
    [c.instagram_hashtag, c.instagram_hashtag2, c.instagram_hashtag3, ...s.optin.ig_hashtags]
      .filter((t): t is string => !!t && t.trim() !== "")
      .map((t) => (t.startsWith("#") ? t : "#" + t))
  );
  if (tags.length) {
    d.sb_hashtags = uniq([...tags, "#ad"]).join(" ");
    src.sb_hashtags = c.instagram_hashtag ? SRC.settings : SRC.optin;
  }
  if (Object.values(src).includes(SRC.optin)) from.push(SRC.optin);

  d.sources = src;
  return { content: d, filled_from: uniq(from) };
}

// ---- Deal page ----

export function prefillDeal(s: DraftSources): Prefilled<DealDraft> {
  const { campaign: c } = s.bundle;
  const d = emptyDeal();
  const src: Sources = {};
  const from: string[] = [];

  if (s.optin.compensation) {
    d.pay = s.optin.compensation;
    src.pay = SRC.optin;
  }
  const due = stepDate(s.optin, /create|content|due|submit/i) || s.brief?.due_date?.slice(0, 10) || "";
  if (due) {
    d.content_due = due;
    src.content_due = stepDate(s.optin, /create|content|due|submit/i) ? SRC.optin : SRC.brief;
  }
  const post = stepDate(s.optin, /post/i);
  if (post) {
    d.post_start = post;
    src.post_start = SRC.optin;
  }
  const paid = stepDate(s.optin, /paid|pay/i) || c.expected_pay_date?.slice(0, 10) || "";
  if (paid) {
    d.paid_by = paid;
    src.paid_by = stepDate(s.optin, /paid|pay/i) ? SRC.optin : SRC.settings;
  }
  for (const v of Object.values(src)) from.push(v);
  d.sources = src;
  return { content: d, filled_from: uniq(from) };
}

/** The deal page's "Steps, in order", computed from what the campaign has. */
export interface DealStep {
  key: string;
  title: string;
  sub: string;
  linked: boolean;
  /** where "+ Create first" goes when not linked */
  href: string;
}

export function dealSteps(s: DraftSources, pages: CampaignPages, pay: string): DealStep[] {
  const id = s.bundle.campaign.campaign_id;
  const contract = !!pages.byKind.contract || !!s.bundle.campaign.contract;
  const posting = !!pages.byKind.posting || !!s.playbook.postingSettings;
  return [
    { key: "contract", title: "Sign your contract", sub: "Athlete contract", linked: contract, href: `/admin/campaigns/${id}/contract` },
    {
      key: "upload",
      title: "Upload your content",
      sub: "Content submission form",
      linked: !!s.playbook.submissionForm,
      href: `/admin/content/submissions/${id}`,
    },
    { key: "post", title: "Post it", sub: "Posting instructions", linked: posting, href: `/admin/campaigns/${id}/posting` },
    { key: "paid", title: "Get paid", sub: pay ? `Payouts · ${pay}` : "Payouts", linked: !!pay, href: `/admin/campaigns/${id}/page` },
  ];
}

// ---- Posting instructions ----

function inferDeliverables(posts: string[], saved: unknown): Record<DeliverableKey, boolean> {
  const out: Record<DeliverableKey, boolean> = { reel: false, feed: false, story: false, tiktok: false };
  // Saved posting settings win when they exist.
  if (Array.isArray(saved) && saved.length) {
    for (const x of saved) {
      const key = typeof x === "string" ? x : x && typeof x === "object" ? String((x as { key?: unknown }).key ?? "") : "";
      if (key === "reel" || key === "feed" || key === "story" || key === "tiktok") out[key] = true;
    }
    return out;
  }
  for (const p of posts) {
    const t = p.toLowerCase();
    if (/reel/.test(t)) out.reel = true;
    if (/feed|carousel|photo|post/.test(t) && !/reel|story|tiktok/.test(t)) out.feed = true;
    if (/story|stories/.test(t)) out.story = true;
    if (/tiktok|tik tok/.test(t)) out.tiktok = true;
  }
  return out;
}

export function prefillPosting(s: DraftSources): Prefilled<PostingDraft> {
  const { campaign: c } = s.bundle;
  const d = emptyPosting();
  const src: Sources = {};
  const from: string[] = [];

  const tag = s.posting?.tag_handle || c.instagram_mention || firstTag(s.optin.ig_mentions, "@");
  if (tag) {
    d.tag = tag.replace(/^@/, "");
    src.tag = s.posting?.tag_handle ? SRC.posting : c.instagram_mention ? SRC.settings : SRC.optin;
  }
  const hashtag = s.posting?.hashtag || c.instagram_hashtag || firstTag(s.optin.ig_hashtags, "#");
  if (hashtag) {
    d.hashtag = hashtag.replace(/^#/, "");
    src.hashtag = s.posting?.hashtag ? SRC.posting : c.instagram_hashtag ? SRC.settings : SRC.optin;
  }
  if (s.posting?.ftc_note) {
    const note = s.posting.ftc_note;
    d.ftc = /partnership/i.test(note) && /#ad/i.test(note) ? "Paid partnership label + #ad" : /#ad/i.test(note) ? "#ad in caption" : /partnership/i.test(note) ? "Paid partnership label only" : "";
    if (d.ftc) src.ftc = SRC.posting;
  }
  d.deliverables = inferDeliverables(s.optin.required_posts, s.posting?.deliverables);
  if (Object.values(d.deliverables).some(Boolean)) {
    src.deliverables = Array.isArray(s.posting?.deliverables) && (s.posting!.deliverables as unknown[]).length ? SRC.posting : SRC.optin;
  }
  const post = stepDate(s.optin, /post/i);
  if (post) {
    d.start = post;
    src.start = SRC.optin;
  }
  for (const v of Object.values(src)) from.push(v);
  d.sources = src;
  return { content: d, filled_from: uniq(from) };
}

// ---- Creator brief ----

export function prefillBrief(s: DraftSources): Prefilled<BriefDraft> {
  const { campaign: c } = s.bundle;
  const d = emptyBrief();
  const src: Sources = {};
  const from: string[] = [];

  if (s.brief?.brief_text) {
    d.idea = s.brief.brief_text;
    src.idea = SRC.brief;
  } else if (s.optin.description) {
    d.idea = s.optin.description;
    src.idea = SRC.optin;
  }
  if (s.optin.required_posts.length) {
    d.shots = [...s.optin.required_posts];
    src.shots = SRC.optin;
  }
  if (s.brief?.must_say?.length) {
    d.dos = s.brief.must_say.join(" ");
    src.dos = SRC.brief;
  }
  if (s.brief?.avoid?.length) {
    d.donts = s.brief.avoid.join(" ");
    src.donts = SRC.brief;
  }
  const due = s.brief?.due_date?.slice(0, 10) || stepDate(s.optin, /create|content|due|submit/i);
  if (due) {
    d.content_due = due;
    src.content_due = s.brief?.due_date ? SRC.brief : SRC.optin;
  }
  if (s.playbook.submissionForm) {
    d.upload_to = "Content submission form → LucidLink";
    src.upload_to = SRC.form;
  }
  if (c.campaign_brief_link) {
    d.doc_link = c.campaign_brief_link;
    src.doc_link = SRC.docs;
  }
  for (const v of Object.values(src)) from.push(v);
  d.sources = src;
  return { content: d, filled_from: uniq(from) };
}

// ---- Recap ----

export function trackerLink(s: DraftSources): string {
  const { campaign: c, extras } = s.bundle;
  return extras.performance_tracker_link || s.playbook.storage?.performance_tracker_url || c.campaign_tracker || "";
}

export function prefillRecap(s: DraftSources): Prefilled<RecapDraft> {
  const d = emptyRecap();
  const src: Sources = {};
  const from: string[] = [];
  const link = trackerLink(s);
  if (link) {
    d.tracker_link = link;
    src.tracker_link = SRC.tracker;
    from.push(SRC.tracker);
  }
  d.sources = src;
  return { content: d, filled_from: from };
}

/**
 * Read the tracker's RECAP SUMMARY tab as plain values. Never throws:
 * a tracker that can't be read comes back with the reason.
 */
export async function readTrackerNumbers(link: string): Promise<{ rows: string[][]; readAt: string; error: string | null }> {
  const sheetId = sheetIdFromLink(link);
  if (!sheetId) return { rows: [], readAt: "", error: link ? "That link isn't a Google Sheet." : "No performance tracker linked yet." };
  try {
    const { readRecapSummaryValues } = await import("@/lib/tracker-sheet");
    const rows = await readRecapSummaryValues(sheetId);
    return { rows, readAt: new Date().toISOString(), error: rows.length ? null : "The RECAP SUMMARY tab is empty." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], readAt: "", error: `Couldn't read the tracker: ${msg}` };
  }
}

// ------------------------------------------------------------
// Resolve: saved row if there is one, else the pre-fill
// ------------------------------------------------------------

export interface ResolvedDraft<T> {
  content: T;
  filled_from: string[];
  status: DraftStatus;
  exists: boolean;
  updated_at: string | null;
}

export function resolveDraft<T>(kind: PageKind, pages: CampaignPages, prefill: Prefilled<T>): ResolvedDraft<T> {
  const row = pages.byKind[kind];
  if (!row) return { content: prefill.content, filled_from: prefill.filled_from, status: "draft", exists: false, updated_at: null };
  return {
    content: parseDraft(kind, row.content) as unknown as T,
    filled_from: filledFrom(row),
    status: row.status === "live" ? "live" : "draft",
    exists: true,
    updated_at: row.updated_at,
  };
}

/** Everything a draft editor route needs, in one call. */
export async function loadDraftContext(
  supabase: Db,
  id: number
): Promise<{ ctx: { bundle: CampaignBundle; playbook: Playbook; pages: CampaignPages; sources: DraftSources } | null; error: string | null }> {
  const { loadCampaign, loadPlaybook } = await import("./queries");
  const { bundle, error } = await loadCampaign(supabase, id);
  if (error || !bundle) return { ctx: null, error };
  const [playbook, pages] = await Promise.all([loadPlaybook(supabase, id), loadCampaignPages(supabase, id)]);
  const sources = await loadDraftSources(supabase, id, bundle, playbook);
  return { ctx: { bundle, playbook, pages, sources }, error: null };
}

export { campaignTypeLabel, longDate };
