-- "Combined followers" was double-counting people, so it is replaced by a
-- de-duplicated figure.
--
-- THE BUG. `followers` summed ig_followers over athlete ROWS, and an athlete
-- gets one row per campaign appearance. For CVS that is 17,371,557 across
-- 1,928 rows — but only 1,441 distinct people, 310 of whom appear on more
-- than one campaign and one on eight. De-duplicated, the same brand's
-- following is 14,614,989: the old figure overstated it by 2.76M, or 16%.
--
-- THE RULE. One value per person, taken as MAX(ig_followers) across their
-- appearances, then summed. Max rather than latest because `athletes` rows
-- carry no reliable per-row capture date, and max rather than min because a
-- follower count that grew is the one a brand's own reporting will show.
-- Identity is lower(btrim(name)) — the same rule as the athletes count in
-- this view and as portal_brand_stats.
--
-- WHAT IT STILL IS NOT. This counts each ATHLETE once; it cannot know how
-- many of their followers are the same people. Two athletes at one school
-- share an audience and this sum counts that audience twice. So it is not a
-- unique-people measurement, which is why the UI calls it "Combined
-- following, de-duplicated" — a following summed once per athlete — rather
-- than "audience reached", which invites exactly that misreading.
--
-- `followers` (the row-wise sum) is DROPPED rather than kept alongside:
-- leaving both invites the wrong one being picked, and this page was its only
-- consumer. DROP first, because CREATE OR REPLACE VIEW cannot remove or
-- rename a column — it fails with 42P16.
--
-- Verified after applying, per period (audience / people):
--   all 14,614,989 / 1,441 · last4 6,794,778 / 611 · last4_prior 5,628,320 /
--   593 · y2026 5,469,073 / 355 · y2025 5,783,914 / 751
-- 2026 is BELOW 2025 on this measure, and the comparison line says so.
--
-- Rollback: re-apply migration 059's definition of
-- public.portal_brand_report_periods.

drop view if exists public.portal_brand_report_periods;

create view public.portal_brand_report_periods
with (security_invoker = true) as
with scoped as (
  select
    q.brand_id,
    q.campaign_id,
    q.quarter_start,
    a.id            as athlete_row,
    a.name          as athlete_name,
    a.ig_followers,
    a.post_url,
    a.metrics,
    date_trunc('quarter', now())::date - interval '9 months'  as last4_from,
    date_trunc('quarter', now())::date - interval '21 months' as prior4_from
  from public.portal_report_campaign_quarters q
  left join public.athletes a on a.campaign_id = q.campaign_id
),
labelled as (
  select
    s.*,
    case when s.quarter_start is null then null
         else extract(year from s.quarter_start)::int end as yr,
    (s.quarter_start is not null and s.quarter_start >= s.last4_from)  as in_last4,
    (s.quarter_start is not null and s.quarter_start >= s.prior4_from
       and s.quarter_start < s.last4_from)                            as in_prior4
  from scoped s
),
agg as (
  select 'all'::text as period, null::int as period_year, brand_id,
         campaign_id, athlete_row, athlete_name, ig_followers, post_url, metrics
  from labelled
  union all
  select 'y' || yr::text, yr, brand_id,
         campaign_id, athlete_row, athlete_name, ig_followers, post_url, metrics
  from labelled where yr is not null
  union all
  select 'last4', null, brand_id,
         campaign_id, athlete_row, athlete_name, ig_followers, post_url, metrics
  from labelled where in_last4
  union all
  select 'last4_prior', null, brand_id,
         campaign_id, athlete_row, athlete_name, ig_followers, post_url, metrics
  from labelled where in_prior4
),
-- One row per person per period, so the sum below counts each athlete once.
per_person as (
  select period, brand_id, lower(btrim(athlete_name)) as person,
         max(ig_followers) as best
  from agg
  where athlete_name is not null and btrim(athlete_name) <> ''
    and coalesce(ig_followers, 0) > 0
  group by period, brand_id, lower(btrim(athlete_name))
),
audience as (
  select period, brand_id, sum(best) as audience, count(*) as audience_athletes
  from per_person group by period, brand_id
)
select
  a.brand_id,
  a.period,
  a.period_year,

  count(distinct a.campaign_id)                                        as campaigns,

  count(distinct lower(btrim(a.athlete_name)))
    filter (where a.athlete_name is not null and btrim(a.athlete_name) <> '')
                                                                       as athletes,

  count(a.athlete_row) filter (
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

  count(*) filter (where jsonb_typeof(a.metrics->'ig_feed'->'impressions') = 'number')
                                                                       as feed_impressions_athletes,
  round(sum((a.metrics->'ig_feed'->>'impressions')::numeric)
        filter (where jsonb_typeof(a.metrics->'ig_feed'->'impressions') = 'number'))
                                                                       as feed_impressions,

  count(*) filter (where jsonb_typeof(a.metrics->'ig_story'->'impressions') = 'number')
                                                                       as story_impressions_athletes,
  round(sum((a.metrics->'ig_story'->>'impressions')::numeric)
        filter (where jsonb_typeof(a.metrics->'ig_story'->'impressions') = 'number'))
                                                                       as story_impressions,

  count(*) filter (where jsonb_typeof(a.metrics->'tiktok'->'views') = 'number')
                                                                       as tiktok_views_athletes,
  round(sum((a.metrics->'tiktok'->>'views')::numeric)
        filter (where jsonb_typeof(a.metrics->'tiktok'->'views') = 'number'))
                                                                       as tiktok_views,

  -- De-duplicated: each athlete counted once, at their largest recorded
  -- following. NOT the row-wise sum this replaces.
  max(au.audience)                                                     as audience,
  max(au.audience_athletes)                                            as audience_athletes

from agg a
left join audience au on au.period = a.period and au.brand_id = a.brand_id
group by a.brand_id, a.period, a.period_year;

comment on view public.portal_brand_report_periods is
  'Portal Reports headline totals per period: all | y<YYYY> | last4 | last4_prior. Each period is aggregated independently because athletes is a DISTINCT PERSON count and cannot be summed across windows. `audience` is the de-duplicated following — one value per person, their max — and replaces the row-wise `followers` sum, which double-counted anyone on more than one campaign. Platform columns stay separate: Reels/TikTok report views, Feed/Stories report impressions.';

grant select on public.portal_brand_report_periods to authenticated;
