-- ============================================================
-- agent_runs.triggered_by becomes nullable; trigger_source says why.
--
-- triggered_by was NOT NULL and a foreign key to auth.users, so anything
-- without a session could not log a run at all. The sync routes worked around
-- it by resolving a stand-in profile from SLACK_FALLBACK_EMAIL, and every
-- unattended model call site simply logged nothing — which is why their spend
-- was invisible and no cap in agent_budgets could bind on them.
--
-- Nullable plus an explicit source is the honest shape: a cron or system run
-- records that it had no user rather than borrowing someone else's identity.
--
-- Existing rows backfill to 'user', which is what they all were — every writer
-- before this migration had to supply a real auth.users id to insert at all.
--
-- ALREADY APPLIED to POSTGAME HUB (xqaybwhpgxillpbbqtks) on 2026-09-05.
-- ============================================================

alter table public.agent_runs
  alter column triggered_by drop not null;

alter table public.agent_runs
  add column if not exists trigger_source text not null default 'user';

alter table public.agent_runs
  drop constraint if exists agent_runs_trigger_source_check;
alter table public.agent_runs
  add constraint agent_runs_trigger_source_check
  check (trigger_source in ('user', 'cron', 'system'));

comment on column public.agent_runs.triggered_by is
  'The staff user who caused this run, or null for cron/system runs. See trigger_source.';
comment on column public.agent_runs.trigger_source is
  'user = a person triggered it (triggered_by set); cron = a scheduled job; system = an unattended code path with no request behind it.';
