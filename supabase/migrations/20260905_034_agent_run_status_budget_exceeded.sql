-- ============================================================
-- agent_run_status gains 'budget_exceeded'.
--
-- Joins running / complete / failed. Marks a run that never happened: the
-- monthly cap in agent_budgets was already reached, so lib/agents/budget.ts
-- skipped the model call and wrote the row instead of making it.
--
-- ITS OWN MIGRATION ON PURPOSE. A value added by ALTER TYPE ... ADD VALUE
-- cannot be USED until the adding transaction commits, so the table and seed
-- in 035 must land separately or the first insert against them fails.
--
-- ALREADY APPLIED to POSTGAME HUB (xqaybwhpgxillpbbqtks) on 2026-09-05.
-- ============================================================

alter type public.agent_run_status add value if not exists 'budget_exceeded';
