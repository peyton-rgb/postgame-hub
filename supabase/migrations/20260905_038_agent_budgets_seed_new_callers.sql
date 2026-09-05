-- ============================================================
-- Cap the newly-named callers, plus the three whose logging was broken.
--
-- editor / edit_planner / editing_orchestrator were already enum members but
-- had never produced an agent_runs row, so the seed in 035 (which reads
-- distinct agent_name FROM agent_runs) could not have covered them.
--
-- on conflict do nothing: never overwrites a cap a human has edited, and leaves
-- the existing video_evaluator $25 alone.
--
-- ALREADY APPLIED to POSTGAME HUB (xqaybwhpgxillpbbqtks) on 2026-09-05.
-- ============================================================

insert into public.agent_budgets (agent_name, monthly_cap_usd)
values ('pitch_generator', 10),
       ('tier3_scorer', 10),
       ('auto_editor', 10),
       ('suggestions', 10),
       ('analytics', 10),
       ('content_strategist', 10),
       ('distributor', 10),
       ('gemini', 10),
       ('editor', 10),
       ('edit_planner', 10),
       ('editing_orchestrator', 10)
on conflict (agent_name) do nothing;
