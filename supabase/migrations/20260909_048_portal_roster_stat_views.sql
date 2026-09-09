-- Migration 048 · portal_campaign_stats + portal_brand_stats
--
-- APPLIED to xqaybwhpgxillpbbqtks on 9 Sep via apply_migration
-- (name: portal_roster_stat_views). Verified after applying, as the
-- authenticated role: CVS rolls up to 0 athletes on active campaigns and 1,523
-- all time, and SPF reports 132 athletes across 102 schools.
--
-- Rollback:
--   DROP VIEW IF EXISTS public.portal_campaign_stats;
--   DROP VIEW IF EXISTS public.portal_brand_stats;

-- Aggregates for the dashboard, so the page never fetches athlete ROWS just to
-- count them.
--
-- WHY THIS EXISTS. The first cut of the dashboard loaded `athletes` and counted
-- in JS. PostgREST caps a response at 1000 rows regardless of .limit(), and
-- there are 9,436 athletes — so it received an arbitrary thousand, filtered
-- them to the brand afterwards, and reported 92 athletes for a brand that has
-- 1,523 and a 29-athlete roster for a campaign with 132. Counting in SQL is
-- both correct and a fraction of the bytes.
--
-- Distinct by lower(trim(name)), NOT by row: `athletes` carries one row per
-- athlete-per-campaign, so counting rows reports 2,096 where 1,523 people
-- exist.
--
-- security_invoker = true on both, same as portal_campaigns — the caller's RLS
-- applies. Not a row-security boundary until Phase 2; the app filters by
-- brand_id explicitly.

-- Per-campaign roster size, for the campaign cards and the roster subline.
create or replace view public.portal_campaign_stats
with (security_invoker = true) as
select
  cr.id                                                as campaign_id,
  cr.brand_id,
  cr.lifecycle_status,
  count(distinct lower(trim(a.name)))                  as athletes,
  count(distinct nullif(trim(a.school), ''))           as schools
from public.campaign_recaps cr
left join public.athletes a
  on a.campaign_id = cr.id and a.name is not null
group by cr.id, cr.brand_id, cr.lifecycle_status;

comment on view public.portal_campaign_stats is
  'Distinct athlete and school counts per campaign, for the portal dashboard. Distinct by lower(trim(name)) because athletes holds one row per athlete-per-campaign. security_invoker=true.';

-- Brand-level rollup for the Athletes KPI. Distinct across campaigns cannot be
-- summed from the per-campaign view, so it is aggregated separately.
create or replace view public.portal_brand_stats
with (security_invoker = true) as
select
  cr.brand_id,
  count(distinct lower(trim(a.name)))
    filter (where cr.lifecycle_status = 'active')      as athletes_active,
  count(distinct lower(trim(a.name)))                  as athletes_all_time
from public.campaign_recaps cr
join public.athletes a
  on a.campaign_id = cr.id and a.name is not null
group by cr.brand_id;

comment on view public.portal_brand_stats is
  'Distinct athlete counts per brand — on active campaigns and all time — for the portal dashboard Athletes KPI. security_invoker=true.';

grant select on public.portal_campaign_stats to authenticated;
grant select on public.portal_brand_stats to authenticated;
