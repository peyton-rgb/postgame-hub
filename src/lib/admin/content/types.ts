// ============================================================
// Content area (/admin/content/*) — client-safe types.
//
// Nothing here imports server code, so "use client" components can
// import these freely. Loaders live in ./queries.ts (server only).
// ============================================================

import type { FileRow, Instruction } from "@/components/submission-forms/reviewHubLogic";

export type { FileRow, Instruction };

/** One campaign on the Review & edit list (a campaign with a submission form). */
export interface ReviewCampaignRow {
  /** campaign_recaps.id — the id the review routes use */
  id: string;
  adminCampaignId: number | null;
  name: string;
  brandName: string | null;
  logo: string | null;
  athletes: number;
  files: number;
  toReview: number;
  inEdit: number;
  approved: number;
  /** days the oldest submission has waited; null = nothing received */
  waitingDays: number | null;
  waitingOnAthletes: boolean;
  needsUs: boolean;
}

export type ReviewAthleteTab = "needs" | "done" | "all";

/** One athlete inside a campaign's review page. */
export interface ReviewAthleteRow {
  key: string;
  name: string;
  school: string | null;
  total: number;
  required: number;
  approved: number;
  toReview: number;
  inEdit: number;
  sentBack: number;
  missingPhotos: number;
  missingVideos: number;
  /** first file to open from the row (to-review first) */
  firstFileId: string | null;
  next: string;
  cta: string;
  ctaPrimary: boolean;
  tab: "needs" | "done" | "waiting";
}

/** A queued or finished AI edit on one file (edit_jobs) — a "version". */
export interface EditVersion {
  id: string;
  status: string;
  instruction: string | null;
  outputUrl: string | null;
  outputThumb: string | null;
  createdAt: string;
}

/** An AI suggestion row (edit_suggestions) for one file. */
export interface EditSuggestion {
  id: string;
  kind: string | null;
  summary: string | null;
  detail: string | null;
  severity: string | null;
  status: string | null;
}

export interface ReviewWorkspaceData {
  campaignId: string;
  campaignName: string;
  brandName: string | null;
  /** submission_links.token — the review API is addressed by it */
  token: string | null;
  athleteName: string;
  file: FileRow;
  /** all of this athlete's files on the campaign, in rail order */
  siblings: FileRow[];
  versions: EditVersion[];
  suggestions: EditSuggestion[];
}

/** File status → the plain-English label the rail shows. */
export function fileStateLabel(status: string): { label: string; tone: "warn" | "ok" | "bad" | "muted" } {
  if (status === "approved") return { label: "Approved", tone: "ok" };
  if (status === "needs_edit") return { label: "In edit queue", tone: "warn" };
  if (status === "rejected") return { label: "Sent back", tone: "bad" };
  if (status === "scored" || status === "pending_review") return { label: "To review", tone: "warn" };
  return { label: status.replace(/_/g, " "), tone: "muted" };
}

export const TO_REVIEW = new Set(["scored", "pending_review"]);

// ---- posting ----------------------------------------------------------------

export interface PostingCampaignRow {
  id: string;
  title: string;
  brandName: string | null;
  logo: string | null;
  athletes: number;
  posts: number;
  sent: number;
  posted: number;
}

export interface PostingRosterRow {
  key: string;
  name: string;
  school: string | null;
  handle: string | null;
  postDate: string | null;
  files: string;
  filesOk: boolean;
  status: "not_ready" | "ready" | "sent" | "posted";
  statusLabel: string;
  link: string;
  /** draft package ids that "Mark sent" would flip */
  draftIds: string[];
}

// ---- recaps -----------------------------------------------------------------

export interface RecapCard {
  id: string;
  name: string;
  slug: string | null;
  brandName: string | null;
  logo: string | null;
  status: string;
  published: boolean;
  image: string | null;
  createdAt: string;
}

// ---- run of shows -----------------------------------------------------------

export interface RosRow {
  id: string;
  name: string;
  client: string | null;
  logo: string | null;
  shoots: number;
  nextShoot: string | null;
  published: boolean;
  slug: string | null;
}

// ---- media ------------------------------------------------------------------

export interface MediaTile {
  id: string;
  type: "image" | "video";
  thumb: string | null;
  fileUrl: string;
  athleteName: string | null;
  school: string | null;
  campaignName: string | null;
  brandName: string | null;
  /** media.created_at — shown in the Rows view */
  createdAt?: string | null;
}
