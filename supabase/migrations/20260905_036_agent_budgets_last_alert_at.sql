-- ============================================================
-- agent_budgets.last_alert_at — throttles the budget-exceeded email.
--
-- "At most one email per agent per day" needs somewhere to remember the last
-- send, and agent_runs cannot serve. A budget_exceeded row is only insertable
-- for an agent that IS a member of the agent_name enum, and several of the
-- callers most likely to overspend are not members. Keeping the stamp here
-- makes the throttle behave identically for every caller.
--
-- ALREADY APPLIED to POSTGAME HUB (xqaybwhpgxillpbbqtks) on 2026-09-05.
-- ============================================================

alter table public.agent_budgets
  add column if not exists last_alert_at timestamptz;

comment on column public.agent_budgets.last_alert_at is
  'When the budget-exceeded email for this agent was last sent. Throttles alerts to one per agent per ET day.';
