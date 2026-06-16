-- ============================================================
-- Athlete App — Phase 3: deliverables (per-item feed/reel tracking)
--
-- Additive only.
-- 1. optin_campaigns.required_deliverables: structured list of slots a deal
--    needs (e.g. {feed,reel}). When null the app falls back to {feed,reel}.
--    Seeds the goodr Summer Series deal.
-- 2. athlete_deliverables: one row per (athlete opt-in, slot). Holds the
--    workflow status, the uploaded media reference, and the live post URL.
--    media stays a pure asset table (we just stamp media.slot on upload).
--
-- Status flow (per deliverable):
--   to_upload → uploaded → in_review → approved → to_post →
--   pending_verification → verified → paid   (+ changes_requested on reject)
-- A deal is fully done only when ALL its deliverables are verified/paid.
-- ============================================================

-- ── 1. Structured deliverable list on the deal ──
alter table public.optin_campaigns
  add column if not exists required_deliverables text[];

update public.optin_campaigns
set required_deliverables = '{feed,reel}'
where id = '1fae6ce3-ec1b-42cf-bbf4-ba919e2eec69'
  and required_deliverables is null;

-- ── 2. Per-deliverable workflow rows ──
create table if not exists public.athlete_deliverables (
  id                uuid primary key default gen_random_uuid(),
  optin_id          uuid not null references public.athlete_campaign_optins(id) on delete cascade,
  athlete_id        uuid not null references public.profiles(id) on delete cascade,
  optin_campaign_id uuid not null references public.optin_campaigns(id) on delete cascade,
  slot              text not null,                       -- 'feed' | 'reel' | 'story'
  status            text not null default 'to_upload',
  media_id          uuid references public.media(id) on delete set null,
  live_url          text,
  review_note       text,
  uploaded_at       timestamptz,
  approved_at       timestamptz,
  posted_at         timestamptz,
  verified_at       timestamptz,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (optin_id, slot)
);

create index if not exists idx_deliv_athlete on public.athlete_deliverables (athlete_id);
create index if not exists idx_deliv_optin on public.athlete_deliverables (optin_id);
create index if not exists idx_deliv_campaign on public.athlete_deliverables (optin_campaign_id);
create index if not exists idx_deliv_status on public.athlete_deliverables (status);

alter table public.athlete_deliverables enable row level security;

-- Athlete: read their own deliverables. (All writes go through service-role
-- API routes so status transitions stay controlled.)
drop policy if exists deliv_select_own on public.athlete_deliverables;
create policy deliv_select_own on public.athlete_deliverables
  for select to authenticated using (athlete_id = auth.uid());

-- Staff: read all (manager approval + verification views).
drop policy if exists deliv_staff_read on public.athlete_deliverables;
create policy deliv_staff_read on public.athlete_deliverables
  for select to authenticated using (public.is_staff());
