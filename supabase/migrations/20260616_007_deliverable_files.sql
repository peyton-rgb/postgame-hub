-- ============================================================
-- Athlete App — fix: store uploaded files on athlete_deliverables
--
-- The shared public.media table is structurally bound to the recap/roster
-- world: media.campaign_id is a NOT NULL FK to campaign_recaps, and
-- media.athlete_id is a FK to the athletes ROSTER table. Neither can hold an
-- optin_campaigns deal or an athlete-user id, so media can't store athlete
-- deal content. We keep per-deliverable, slotted tracking (the brief's intent)
-- by storing the uploaded file directly on athlete_deliverables instead.
--
-- Additive only.
-- ============================================================

alter table public.athlete_deliverables
  add column if not exists file_url        text,
  add column if not exists thumbnail_url   text,
  add column if not exists storage_path    text,
  add column if not exists storage_bucket  text,
  add column if not exists content_type    text,
  add column if not exists file_size_bytes bigint,
  add column if not exists media_type      text;  -- 'image' | 'video'
