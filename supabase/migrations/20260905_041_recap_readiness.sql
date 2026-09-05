-- ============================================================
-- recap_readiness — one row per readiness check of a delivered campaign.
--
-- Written by /api/cron/recap-readiness (the daily sweep) and by the
-- "Check readiness" button on the campaign page, which runs the same check for
-- a single recap. History is kept rather than upserted: "when did this campaign
-- become ready" is a question the rows can answer, and a check is cheap.
--
-- `ready` is stored rather than computed on read, so a later change to the
-- definition cannot silently rewrite what past checks concluded.
--
-- ALREADY APPLIED to POSTGAME HUB (xqaybwhpgxillpbbqtks) on 2026-09-05.
-- ============================================================

create table if not exists public.recap_readiness (
  id               uuid primary key default gen_random_uuid(),
  recap_id         uuid not null references public.campaign_recaps(id) on delete cascade,
  checked_at       timestamptz not null default now(),
  drive_file_count integer,
  has_tracker      boolean not null default false,
  has_brief        boolean not null default false,
  media_count      integer not null default 0,
  tier3_count      integer not null default 0,
  ready            boolean not null default false
);

create index if not exists recap_readiness_recap_id_checked_at_idx
  on public.recap_readiness (recap_id, checked_at desc);

comment on table public.recap_readiness is
  'One row per readiness check of a delivered campaign. ready = drive_file_count > 0 OR media_count > 0.';
comment on column public.recap_readiness.drive_file_count is
  'Files in drive_content_folder_id, metadata only. Null = not checked (no folder id, or the Drive call failed); 0 = folder read and empty.';

alter table public.recap_readiness enable row level security;

drop policy if exists recap_readiness_staff_all on public.recap_readiness;
create policy recap_readiness_staff_all on public.recap_readiness
  for all
  using (public.is_postgame_staff())
  with check (public.is_postgame_staff());

-- The sweep makes no model call, so its ceiling is $0. Present so the agent
-- appears in budget reporting rather than looking unconfigured.
insert into public.agent_budgets (agent_name, monthly_cap_usd)
values ('recap_readiness', 0)
on conflict (agent_name) do nothing;
