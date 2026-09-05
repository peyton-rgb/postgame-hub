-- The readiness sweep logs a run like any other agent, though it calls no model.
-- Own migration: a value added by ALTER TYPE ... ADD VALUE cannot be used until
-- the adding transaction commits, so the $0 budget row in 041 lands separately.
--
-- ALREADY APPLIED to POSTGAME HUB (xqaybwhpgxillpbbqtks) on 2026-09-05.
alter type public.agent_name add value if not exists 'recap_readiness';
