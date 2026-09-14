-- Brand-level headline totals across WRAPPED campaigns, for the Reports page.
--
-- WHY A VIEW, and why these cannot be summed from portal_campaign_post_metrics
-- in the app: `athletes` is a DISTINCT PERSON count across campaigns, and
-- adding up per-campaign athlete counts double-counts everyone who appeared on
-- more than one campaign — 2,096 CVS athlete rows are 1,501 people. Only SQL
-- can dedupe across the set.
--
-- The dedupe rule is lower(btrim(name)), the SAME rule as portal_brand_stats
-- (migration 052). It has to be: the Reports page and the dashboard KPI sit two
-- clicks apart, and two different athlete counts for one brand is the bug that
-- produced "1,501 vs 1,523".
--
-- EVERY FIGURE CARRIES A CONTRIBUTOR COUNT (*_athletes), same contract as
-- portal_campaign_post_metrics: a sum over zero contributors is 0, which on
-- screen is indistinguishable from a real zero, so the UI needs to know which
-- it has. Impressions are feed + story added together, each guarded
-- independently, so a brand with feed data and no story data still gets a
-- true figure rather than null.
--
-- WRAPPED = delivered | closed, matching the WRAPPED constant in
-- src/lib/portal/pages-data.ts. Drafts cannot appear: they are excluded by the
-- lifecycle filter anyway.
--
-- Verified for CVS on 2026-09-09: 46 campaigns, 1,501 athletes, 1,835 posts,
-- 65,578,076 reel views (1,065 contributors), 7,207,142 impressions (1,211),
-- 17,371,557 followers (1,928 rows). The 1,501 matches the dashboard KPI
-- exactly, which is the point of sharing the dedupe rule.
--
-- security_invoker = true so the caller's RLS decides which brands are visible.
--
-- Rollback: DROP VIEW IF EXISTS public.portal_brand_report_totals;

create or replace view public.portal_brand_report_totals
with (security_invoker = true) as
select
  cr.brand_id,

  count(distinct cr.id)                                                as campaigns,

  count(distinct lower(btrim(a.name)))
    filter (where a.name is not null and btrim(a.name) <> '')          as athletes,

  count(a.id) filter (
    where coalesce(
      nullif(btrim(a.post_url), ''),
      a.metrics->'ig_reel'->>'post_url',
      a.metrics->'ig_feed'->>'post_url',
      a.metrics->'tiktok'->>'post_url'
    ) is not null
  )                                                                    as posts,

  count(*) filter (where jsonb_typeof(a.metrics->'ig_reel'->'views') = 'number')
                                                                       as reel_views_athletes,
  round(sum((a.metrics->'ig_reel'->>'views')::numeric)
        filter (where jsonb_typeof(a.metrics->'ig_reel'->'views') = 'number'))
                                                                       as reel_views,

  count(*) filter (
    where jsonb_typeof(a.metrics->'ig_feed'->'impressions') = 'number'
       or jsonb_typeof(a.metrics->'ig_story'->'impressions') = 'number'
  )                                                                    as impressions_athletes,
  coalesce(
    round(sum((a.metrics->'ig_feed'->>'impressions')::numeric)
          filter (where jsonb_typeof(a.metrics->'ig_feed'->'impressions') = 'number')), 0
  ) + coalesce(
    round(sum((a.metrics->'ig_story'->>'impressions')::numeric)
          filter (where jsonb_typeof(a.metrics->'ig_story'->'impressions') = 'number')), 0
  )                                                                    as impressions,

  count(*) filter (where coalesce(a.ig_followers, 0) > 0)              as followers_athletes,
  sum(a.ig_followers) filter (where coalesce(a.ig_followers, 0) > 0)   as followers

from public.campaign_recaps cr
left join public.athletes a on a.campaign_id = cr.id
where cr.lifecycle_status in ('delivered', 'closed')
group by cr.brand_id;

comment on view public.portal_brand_report_totals is
  'Headline totals across a brand''s wrapped campaigns for the portal Reports page. Athletes are DISTINCT people on lower(btrim(name)) — the same rule as portal_brand_stats, so the two surfaces cannot disagree. Each figure is paired with a *_athletes contributor count. security_invoker=true.';

grant select on public.portal_brand_report_totals to authenticated;
