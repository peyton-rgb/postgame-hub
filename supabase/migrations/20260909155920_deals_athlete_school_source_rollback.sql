-- Applied to xqaybwhpgxillpbbqtks as 20260909155920_deals_athlete_school_source_rollback.
--
-- The rollback column for the school backfill and canonicalisation
-- (agent_jobs seq 40). Every row's athlete_school was copied into it before
-- anything was written, so the whole job reverses with one UPDATE.
--
-- The brief called the column deals.school; the column on this table is
-- athlete_school, so the rollback column is named to match it.

alter table public.deals add column if not exists athlete_school_source text;

comment on column public.deals.athlete_school_source is
  'Pre-normalisation athlete_school, captured 2026-09-09 before the school backfill and canonicalisation. Rollback: UPDATE deals SET athlete_school = athlete_school_source.';
