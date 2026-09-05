-- ============================================================
-- agent_name gains the callers that spend money but had no member.
--
-- Until now these could not log an agent_runs row at all, so their spend was
-- invisible and no cap in agent_budgets could ever bind on them.
--
-- 'distributor' is already a member — `add value if not exists` makes that line
-- a no-op rather than an error.
--
-- OWN MIGRATION. A value added by ALTER TYPE ... ADD VALUE cannot be USED until
-- the adding transaction commits, so the seed in 038 must land separately.
--
-- ALREADY APPLIED to POSTGAME HUB (xqaybwhpgxillpbbqtks) on 2026-09-05.
-- ============================================================

alter type public.agent_name add value if not exists 'pitch_generator';
alter type public.agent_name add value if not exists 'tier3_scorer';
alter type public.agent_name add value if not exists 'auto_editor';
alter type public.agent_name add value if not exists 'suggestions';
alter type public.agent_name add value if not exists 'analytics';
alter type public.agent_name add value if not exists 'content_strategist';
alter type public.agent_name add value if not exists 'distributor';
alter type public.agent_name add value if not exists 'gemini';
