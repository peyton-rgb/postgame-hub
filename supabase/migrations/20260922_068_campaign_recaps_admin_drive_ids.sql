-- Campaign-level Drive folder and tracker ids, written by the admin via
-- POST /api/admin-drive/campaign.
--
-- Brief 15. The campaign folder, Content, Legal and its two children, and
-- Trackers already have columns. This adds the two tracker sheets that sit
-- beside the Performance Tracker.
--
-- An earlier version of this migration also added three Invoices-subtree
-- columns. Invoices are handled entirely in the admin, so the Hub never needed
-- them and they were removed before this reached production.
--
-- tracker_sheet_id / tracker_url keep meaning the PERFORMANCE tracker — that is
-- what the recap builder's refresh reads and what the master-tracker rollup
-- rolls up, so their meaning must not drift.
--
-- Additive and idempotent. No dependency on migrations 060-066.
--
-- APPLIED to the recap-editor-test branch (jlxdxuqfmnnpwvmozgmm) on 2026-09-22.
-- NOT applied to production.

alter table public.campaign_recaps
  add column if not exists tracker_internal_sheet_id text,
  add column if not exists tracker_internal_url      text,
  add column if not exists tracker_external_sheet_id text,
  add column if not exists tracker_external_url      text;

comment on column public.campaign_recaps.tracker_internal_sheet_id is
  '**INTERNAL** sheet in Trackers - {Brand} {Campaign} {Year}. Never shown to a brand.';
comment on column public.campaign_recaps.tracker_external_sheet_id is
  '**EXTERNAL** sheet in Trackers - {Brand} {Campaign} {Year}. The brand-safe one.';
