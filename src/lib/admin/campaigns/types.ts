// ============================================================
// Campaign screen types — the blended `campaigns` row (migration 083)
// plus the columns migration 084 adds. The 084 columns live in their
// own type because the code reads them through a separate, feature-
// detected query so the screens work before the migration is applied.
// ============================================================

export type CampaignType = "social" | "event";

/** Columns on public.campaigns that exist after migration 083. */
export interface CampaignRow {
  campaign_id: number;
  brand_id: string | null;
  campaign_name: string | null;
  campaign_note: string | null;
  is_active: boolean | null;
  is_auto_select: boolean | null;
  total_budget: number | null;
  est_athlete_spend: number | null;
  est_videographer_spend: number | null;
  management_fee: number | null;
  other_spend: number | null;
  est_margin_goal: number | null;
  manager_person_id: string | null;
  assistant_person_id: string | null;
  date_stamp: string | null;
  created_at: string;
  expected_pay_date: string | null;
  sow_link: string | null;
  invoice_link: string | null;
  campaign_brief_link: string | null;
  campaign_tracker: string | null;
  campaign_style_guide: string | null;
  campaign_details_link: string | null;
  campaign_webpage: string | null;
  campaign_recap_link: string | null;
  asana_link: string | null;
  instagram_hashtag: string | null;
  instagram_hashtag2: string | null;
  instagram_hashtag3: string | null;
  instagram_mention: string | null;
  instagram_mention2: string | null;
  instagram_mention3: string | null;
  tik_tok_hashtag: string | null;
  tik_tok_hash_tag2: string | null;
  tik_tok_hash_tag3: string | null;
  tiktok_mention: string | null;
  tik_tok_mention2: string | null;
  tik_tok_mention3: string | null;
  affiliate_link: string | null;
  affiliate_landing_page: string | null;
  affiliate_ad_id: string | null;
  affiliate_param_template: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  custom_tracking: string | null;
  college_id_list: string | null;
  contract: string | null;
  contract_title: string | null;
  agreement: string | null;
  content_type: string | null;
  brand_approval_mode: string | null;
  brand_approval_sheet_url: string | null;
  storage_mode: string | null;
  total_opt_in: number | null;
  total_is_selected: number | null;
  total_contract_signed: number | null;
}

/** Columns migration 084 adds to public.campaigns. */
export interface CampaignExtras {
  campaign_type: CampaignType;
  event_date: string | null;
  event_start_time: string | null;
  event_venue: string | null;
  event_call_time: string | null;
  event_activities: string | null;
  event_wardrobe: string | null;
  event_travel_notes: string | null;
  internal_sheet_link: string | null;
  external_sheet_link: string | null;
  performance_tracker_link: string | null;
  lucidlink_folder_path: string | null;
  drive_folder_id: string | null;
  brand_approves_in: string | null;
}

export const EMPTY_EXTRAS: CampaignExtras = {
  campaign_type: "social",
  event_date: null,
  event_start_time: null,
  event_venue: null,
  event_call_time: null,
  event_activities: null,
  event_wardrobe: null,
  event_travel_notes: null,
  internal_sheet_link: null,
  external_sheet_link: null,
  performance_tracker_link: null,
  lucidlink_folder_path: null,
  drive_folder_id: null,
  brand_approves_in: null,
};

export const EXTRA_COLUMNS = Object.keys(EMPTY_EXTRAS) as (keyof CampaignExtras)[];

export interface BrandLite {
  id: string;
  name: string | null;
  /** dark-ink mark, for light backgrounds */
  logo_dark_url: string | null;
  /** light-ink mark, for dark backgrounds */
  logo_light_url: string | null;
  logo_white_url: string | null;
  logo_primary_url: string | null;
  logo_mark_url: string | null;
}

export interface PersonLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  instagram_handle?: string | null;
  instagram_followers?: number | null;
  college_raw?: string | null;
  sport?: string | null;
  agency?: string | null;
  profilepicurl?: string | null;
}

export function personName(p: PersonLite | null | undefined): string | null {
  if (!p) return null;
  const n = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return n || null;
}

export function campaignTypeLabel(t: CampaignType | null | undefined): string {
  return t === "event" ? "Event" : "Social campaign";
}
