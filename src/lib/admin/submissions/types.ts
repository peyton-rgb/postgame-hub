// ============================================================
// Submission forms — shared TypeScript types.
//
// Client-safe: no imports of next/headers, supabase-server, auth,
// db, or any server queries. Both client and server components can
// import from this file without pulling server dependencies into the bundle.
// ============================================================

import type { BrandLite, PersonLite } from "@/lib/admin/campaigns/types";
import type { Deliverable, DeliverableKind, SubmissionFormData } from "./form";

export type { Deliverable, DeliverableKind, SubmissionFormData };

export interface WorkerStatus {
  state: "online" | "offline" | "unknown";
  lastSeen: string | null;
}

export interface FormRow {
  id: string;
  campaign_id: number;
  status: string;
  public_token: string | null;
  min_photos: number;
  min_videos: number;
  max_files_per_athlete: number | null;
  brief_url: string | null;
  /** 087 fields; defaults when the migration is unapplied */
  data: SubmissionFormData;
  lucidlink_path: string | null;
  /** true = 087 not applied (the `title` column is absent) */
  fieldsPending: boolean;
  updated_at: string | null;
}

export interface FormListRow {
  campaignId: number;
  form: FormRow;
  campaignName: string | null;
  isActive: boolean | null;
  brand: BrandLite | null;
  /** site-relative athlete link, when a live submission_links token exists */
  athleteLink: string | null;
  uploaded: number;
  /** selected athletes on the campaign */
  total: number;
  nudges: number;
  /** null = migration 087 (campaign_videographers) not applied */
  videographers: number | null;
  lucidPath: string | null;
  lucidStatus: string | null;
}

export interface FormList {
  pending083: boolean;
  pending087: boolean;
  error: string | null;
  rows: FormListRow[];
  worker: WorkerStatus;
}

export type ReviewLabel = "To review" | "In review" | "Sent back" | "Approved";

export interface AthleteUploadRow {
  key: string;
  optInId: number | null;
  person: PersonLite | null;
  handle: string | null;
  photos: number;
  videos: number;
  raw: number;
  lastUpload: string | null;
  /** files the worker has copied into LucidLink */
  lucid: "synced" | "partial" | null;
  review: ReviewLabel | null;
  viaVideographer: boolean;
  remindedAt: string | null;
  /** matched to a profiles row (app account) by Instagram handle */
  hasApp: boolean;
}

export interface VideographerRow {
  id: string;
  profileId: string;
  name: string;
  email: string;
  accountStatus: string;
  lucidAccess: string;
  assignedAt: string;
}

export interface AvailableVideographer {
  id: string;
  full_name: string;
  email: string;
  status: string;
}

export interface CampaignSubmission {
  form: FormRow | null;
  /** true = content_submission_forms table missing (083) */
  pending083: boolean;
  /** true = 087 columns / campaign_videographers missing */
  pending087: boolean;
  athletes: { pending: boolean; error: string | null; rows: AthleteUploadRow[] };
  videographers: { pending: boolean; rows: VideographerRow[]; available: AvailableVideographer[] };
  athleteLink: string | null;
  lucidPath: string | null;
  lucidStatus: string | null;
  filesInLucid: number;
  worker: WorkerStatus;
}

export type SubmissionTab = "athletes" | "videographers" | "settings";
export type SubmissionPreviewView = "phone" | "mweb" | "desktop";
