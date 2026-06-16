-- ============================================================
-- Athlete App — Phase 2: deals + opt-in
--
-- Additive only.
-- 1. Fixes the goodr "Summer Series" goal copy-paste leftover (iHerb → goodr).
--    This is a surgical brand-name substitution on the existing text, not new
--    marketing copy.
-- 2. Adds the athlete participation ledger that powers "My deals". The opt-in
--    ACTION still flows through the existing campaign_optin_submissions
--    pipeline (see /api/athlete/optin); this table is the app's per-athlete
--    relational record (campaign_optin_submissions is keyed by ig_handle/jsonb
--    and is a one-way intake, so it can't drive the tracker on its own).
-- 3. Adds is_staff() — a SECURITY DEFINER helper so staff-visibility RLS can
--    check role without recursing through profiles' own policies.
-- ============================================================

-- ── 1. Fix the goodr goal text ──
update public.optin_campaigns
set goal = replace(goal, 'iHerb', 'goodr'),
    updated_at = now()
where id = '1fae6ce3-ec1b-42cf-bbf4-ba919e2eec69'
  and goal ilike '%iHerb%';

-- ── 2. Staff check helper (SECURITY DEFINER avoids RLS recursion on profiles) ──
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role <> 'athlete'
  );
$$;

-- ── 3. Athlete participation ledger ──
create table if not exists public.athlete_campaign_optins (
  id                uuid primary key default gen_random_uuid(),
  athlete_id        uuid not null references public.profiles(id) on delete cascade,
  optin_campaign_id uuid not null references public.optin_campaigns(id) on delete cascade,
  status            text not null default 'opted_in',
  ftc_ack           boolean not null default false,
  submission_id     uuid references public.campaign_optin_submissions(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (athlete_id, optin_campaign_id)
);

create index if not exists idx_aco_athlete on public.athlete_campaign_optins (athlete_id);
create index if not exists idx_aco_campaign on public.athlete_campaign_optins (optin_campaign_id);

alter table public.athlete_campaign_optins enable row level security;

-- Athlete: read/insert/update only their own opt-ins.
drop policy if exists aco_select_own on public.athlete_campaign_optins;
create policy aco_select_own on public.athlete_campaign_optins
  for select to authenticated using (athlete_id = auth.uid());

drop policy if exists aco_insert_own on public.athlete_campaign_optins;
create policy aco_insert_own on public.athlete_campaign_optins
  for insert to authenticated with check (athlete_id = auth.uid());

drop policy if exists aco_update_own on public.athlete_campaign_optins;
create policy aco_update_own on public.athlete_campaign_optins
  for update to authenticated using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

-- Staff: read all opt-ins (for the manager verification view in Phase 4).
drop policy if exists aco_staff_read on public.athlete_campaign_optins;
create policy aco_staff_read on public.athlete_campaign_optins
  for select to authenticated using (public.is_staff());
