-- The brand's athlete directory: one row per PERSON across all of the brand's
-- campaigns, for /portal/athletes.
--
-- WHY A VIEW. `athletes` holds one row per athlete-per-campaign — 2,096 rows
-- for CVS covering 1,523 people. Deduplicating in the app would mean pulling
-- all 2,096, and PostgREST caps a response at 1000 rows regardless of
-- .limit(), so the page would silently show a fraction. Same trap that made
-- the dashboard report 92 athletes for a brand with 1,523.
--
-- Identity is lower(trim(name)). There is no athlete-identity key on this
-- table, so the name is what there is; `people` and `athletes_master` are not
-- wired to campaign rosters. Consequence to be aware of: two different people
-- with the same name collapse into one row. Logged as a known limitation
-- rather than papered over.
--
-- Followers and top-reel views take the MAX across the person's rows rather
-- than the latest, because `athletes` carries no per-row timestamp that
-- reliably orders them.
--
-- security_invoker = true so the caller's RLS applies, same as the other
-- portal views. Not a row-security boundary until Phase 2; the app filters by
-- brand_id explicitly.
--
-- Rollback:
--   DROP VIEW IF EXISTS public.portal_brand_athletes;

create or replace view public.portal_brand_athletes
with (security_invoker = true) as
select
  cr.brand_id,
  lower(trim(a.name))                                   as athlete_key,
  min(a.name)                                           as name,
  -- mode() would be better for school/sport but needs an ordered-set
  -- aggregate per column; min() is deterministic and good enough for a
  -- directory row.
  min(nullif(trim(a.school), ''))                       as school,
  min(nullif(trim(a.sport), ''))                        as sport,
  max(a.ig_followers)                                   as followers,
  count(distinct a.campaign_id)                         as campaigns,
  max(cr.admin_created_on)                              as last_campaign_on,
  (array_agg(cr.name order by cr.admin_created_on desc nulls last))[1] as last_campaign,
  (array_agg(a.id order by a.ig_followers desc nulls last))[1]         as sample_athlete_id,
  max(
    case
      when a.metrics ? 'ig_reel'
       and (a.metrics->'ig_reel'->>'views') ~ '^[0-9]+$'
       and (a.metrics->'ig_reel'->>'views')::bigint % 100000 <> 0
      then (a.metrics->'ig_reel'->>'views')::bigint
    end
  )                                                     as top_reel_views
from public.athletes a
join public.campaign_recaps cr on cr.id = a.campaign_id
where a.name is not null
  and trim(a.name) <> ''
  and cr.lifecycle_status is distinct from 'draft'
group by cr.brand_id, lower(trim(a.name));

comment on view public.portal_brand_athletes is
  'One row per athlete (by lower(trim(name))) across a brand''s non-draft campaigns, for the portal athletes directory. Deduplicated in SQL because athletes holds one row per athlete-per-campaign and PostgREST caps responses at 1000 rows. security_invoker=true.';

grant select on public.portal_brand_athletes to authenticated;
