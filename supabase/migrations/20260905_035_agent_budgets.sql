-- ============================================================
-- agent_budgets — a monthly USD ceiling per agent.
--
-- Read by lib/agents/budget.ts immediately before a model call. If this
-- calendar month's agent_runs.cost_usd for the agent has reached the cap, the
-- call is skipped and a budget_exceeded row is written instead.
--
-- agent_name is TEXT, not the agent_name enum, deliberately: several callers
-- that spend money (pitch generation, tier3 processing, the auto-editor,
-- suggestions) have no enum member, and a cap keyed to the enum could never
-- cover them. The cost is no referential integrity — a typo yields a silently
-- unused row, which is why the weekly health check lists caps with no runs.
--
-- ALREADY APPLIED to POSTGAME HUB (xqaybwhpgxillpbbqtks) on 2026-09-05.
-- ============================================================

create table if not exists public.agent_budgets (
  agent_name      text primary key,
  monthly_cap_usd numeric not null check (monthly_cap_usd >= 0),
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.agent_budgets is
  'Monthly USD spend ceiling per agent. Consulted by lib/agents/budget.ts before a model call. enabled=false disables the cap without losing the configured number.';
comment on column public.agent_budgets.agent_name is
  'Free text, not the agent_name enum — callers without an enum member still need a cap.';

alter table public.agent_budgets enable row level security;

-- Staff-only, matching the convention used elsewhere in this schema. The
-- service role bypasses RLS, which is how the agents themselves read it.
drop policy if exists agent_budgets_staff_all on public.agent_budgets;
create policy agent_budgets_staff_all on public.agent_budgets
  for all
  using (public.is_postgame_staff())
  with check (public.is_postgame_staff());

-- Seed: every distinct agent_name already in agent_runs at $10, video_evaluator
-- at $25. on conflict do nothing so re-running never overwrites a human's edit.
insert into public.agent_budgets (agent_name, monthly_cap_usd)
select distinct agent_name::text,
       case when agent_name::text = 'video_evaluator' then 25 else 10 end
  from public.agent_runs
on conflict (agent_name) do nothing;
