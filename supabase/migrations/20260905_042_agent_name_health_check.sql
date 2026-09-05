-- The weekly digest logs a run like the readiness sweep does. Makes no model
-- call. Own migration: ALTER TYPE ... ADD VALUE cannot be used in the
-- transaction that adds it.
--
-- ALREADY APPLIED to POSTGAME HUB (xqaybwhpgxillpbbqtks) on 2026-09-05.
alter type public.agent_name add value if not exists 'health_check';
