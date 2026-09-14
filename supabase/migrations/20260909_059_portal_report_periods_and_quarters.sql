-- Reports, period-aware. Supersedes portal_brand_report_totals (058), which
-- could only answer "all time".
--
-- WHY SQL AND NOT AGGREGATION IN THE APP. Two of these figures cannot be
-- summed from smaller pieces:
--   * athletes is a DISTINCT PERSON count. Adding per-campaign counts
--     double-counts everyone on more than one campaign — 2,096 CVS rows are
--     1,501 people — and adding per-QUARTER distinct counts double-counts
--     anyone who worked across quarters.
--   * the same applies to any period: "2026" is not the sum of its quarters.
-- So every period a filter can select gets its own GROUP BY, and the periods
-- are UNIONed. Three scans of a small set, and each figure is correct for the
-- window it claims.
--
-- The dedupe rule is lower(btrim(name)) — the SAME rule as portal_brand_stats
-- and the dashboard KPI. Two athlete counts for one brand is the bug that
-- produced "1,501 vs 1,523".
--
-- PERIODS
--   all              every wrapped campaign
--   y<YYYY>          one row per calendar year present
--   last4            the current quarter and the three before it
--   last4_prior      the four quarters before those — which is the same span
--                    a year earlier, so it is the year-over-year comparison
--                    for a rolling four-quarter window
-- A campaign with no quarter and no admin_created_on lands in `all` and in no
-- year: it cannot be placed on a timeline, and guessing one would move
-- figures a brand may reconcile against their own reporting. CVS has exactly
-- one such campaign — all=46 against 13+11+15+6=45 across the years.
--
-- QUARTER ATTRIBUTION matches src/lib/portal/pages-data.ts: a stored
-- settings->>'quarter' wins when it is a real value, else the quarter of
-- admin_created_on. 12 of CVS's 13 non-null stored quarters are the EMPTY
-- STRING, so the date carries almost all of it.
--
-- EVERY FIGURE CARRIES A CONTRIBUTOR COUNT (*_athletes), same contract as
-- portal_campaign_post_metrics: a sum over zero contributors is 0, which on
-- screen is indistinguishable from a real zero.
--
-- PLATFORM COLUMNS ARE KEPT SEPARATE ON PURPOSE. Reels and TikTok report
-- VIEWS; Feed and Stories report IMPRESSIONS. They are different
-- measurements and this view does not add them into one number — the UI names
-- each surface and says which metric it is.
--
-- Verified for CVS on 2026-09-09:
--   all          46 campaigns · 1,501 athletes · 1,835 posts · 65,578,076 reel views
--   last4        16 ·   628 ·  697 · 33,058,840
--   last4_prior  14 ·   650 ·  671 ·    170,235
--   y2026        13 ·   372 ·  368 · 32,504,619
--   y2025        11 ·   751 ·  860 ·    724,456
--   y2024        15 ·   257 ·  190 ·       (none)
-- Platform split, all time: Reels 65,578,076 (1,065 athletes) · Feed
-- 4,714,034 (1,139) · Stories 2,493,108 (1,142) · TikTok 46,548 (46).
--
-- Rollback:
--   DROP VIEW IF EXISTS public.portal_brand_report_quarters;
--   DROP VIEW IF EXISTS public.portal_brand_report_periods;
--   DROP VIEW IF EXISTS public.portal_report_campaign_quarters;

create or replace view public.portal_report_campaign_quarters
with (security_invoker = true) as
select
  cr.id            as campaign_id,
  cr.brand_id,
  case
    when btrim(coalesce(cr.settings->>'quarter', '')) ~ '^[Qq][1-4][ /-]?[0-9]{4}$'
      then make_date(
        (regexp_replace(cr.settings->>'quarter', '^[^0-9]*[1-4][ /-]?', ''))::int,
        ((substring(btrim(cr.settings->>'quarter') from 2 for 1))::int - 1) * 3 + 1,
        1
      )
    when cr.admin_created_on is not null
      then date_trunc('quarter', cr.admin_created_on)::date
  end              as quarter_start
from public.campaign_recaps cr
where cr.lifecycle_status in ('delivered', 'closed');

comment on view public.portal_report_campaign_quarters is
  'Each wrapped campaign placed on a quarter, by the same rule the app uses: a real stored settings.quarter wins, else the quarter of admin_created_on. NULL where neither exists.';

grant select on public.portal_report_campaign_quarters to authenticated;


create or replace view public.portal_brand_report_periods
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
    -- The current quarter and the three before it.
    date_trunc('quarter', now())::date - interval '9 months' as last4_from,
    date_trunc('quarter', now())::date - interval '21 months' as prior4_from
  from public.portal_report_campaign_quarters q
  left join public.athletes a on a.campaign_id = q.campaign_id
),
labelled as (
  select
    s.*,
    case
      when s.quarter_start is null then null
      else extract(year from s.quarter_start)::int
    end as yr,
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
)
select
  brand_id,
  period,
  period_year,

  count(distinct campaign_id)                                          as campaigns,

  count(distinct lower(btrim(athlete_name)))
    filter (where athlete_name is not null and btrim(athlete_name) <> '')
                                                                       as athletes,

  count(athlete_row) filter (
    where coalesce(
      nullif(btrim(post_url), ''),
      metrics->'ig_reel'->>'post_url',
      metrics->'ig_feed'->>'post_url',
      metrics->'tiktok'->>'post_url'
    ) is not null
  )                                                                    as posts,

  count(*) filter (where jsonb_typeof(metrics->'ig_reel'->'views') = 'number')
                                                                       as reel_views_athletes,
  round(sum((metrics->'ig_reel'->>'views')::numeric)
        filter (where jsonb_typeof(metrics->'ig_reel'->'views') = 'number'))
                                                                       as reel_views,

  count(*) filter (where jsonb_typeof(metrics->'ig_feed'->'impressions') = 'number')
                                                                       as feed_impressions_athletes,
  round(sum((metrics->'ig_feed'->>'impressions')::numeric)
        filter (where jsonb_typeof(metrics->'ig_feed'->'impressions') = 'number'))
                                                                       as feed_impressions,

  count(*) filter (where jsonb_typeof(metrics->'ig_story'->'impressions') = 'number')
                                                                       as story_impressions_athletes,
  round(sum((metrics->'ig_story'->>'impressions')::numeric)
        filter (where jsonb_typeof(metrics->'ig_story'->'impressions') = 'number'))
                                                                       as story_impressions,

  count(*) filter (where jsonb_typeof(metrics->'tiktok'->'views') = 'number')
                                                                       as tiktok_views_athletes,
  round(sum((metrics->'tiktok'->>'views')::numeric)
        filter (where jsonb_typeof(metrics->'tiktok'->'views') = 'number'))
                                                                       as tiktok_views,

  count(*) filter (where coalesce(ig_followers, 0) > 0)                as followers_athletes,
  sum(ig_followers) filter (where coalesce(ig_followers, 0) > 0)       as followers

from agg
group by brand_id, period, period_year;

comment on view public.portal_brand_report_periods is
  'Portal Reports headline totals per period: all | y<YYYY> | last4 | last4_prior. Each period is aggregated independently because athletes is a DISTINCT PERSON count and cannot be summed across windows. Dedupe rule matches portal_brand_stats. Platform columns stay separate: Reels/TikTok report views, Feed/Stories report impressions.';

grant select on public.portal_brand_report_periods to authenticated;


create or replace view public.portal_brand_report_quarters
with (security_invoker = true) as
select
  q.brand_id,
  q.quarter_start,
  'Q' || extract(quarter from q.quarter_start)::text || ' ' ||
    extract(year from q.quarter_start)::text                            as quarter_label,
  extract(year from q.quarter_start)::int                               as quarter_year,
  count(distinct q.campaign_id)                                         as campaigns,
  count(a.id) filter (
    where coalesce(
      nullif(btrim(a.post_url), ''),
      a.metrics->'ig_reel'->>'post_url',
      a.metrics->'ig_feed'->>'post_url',
      a.metrics->'tiktok'->>'post_url'
    ) is not null
  )                                                                     as posts,
  count(*) filter (where jsonb_typeof(a.metrics->'ig_reel'->'views') = 'number')
                                                                        as reel_views_athletes,
  round(sum((a.metrics->'ig_reel'->>'views')::numeric)
        filter (where jsonb_typeof(a.metrics->'ig_reel'->'views') = 'number'))
                                                                        as reel_views
from public.portal_report_campaign_quarters q
left join public.athletes a on a.campaign_id = q.campaign_id
where q.quarter_start is not null
group by q.brand_id, q.quarter_start;

comment on view public.portal_brand_report_quarters is
  'Per-quarter posts and reel views for the portal Reports chart. Both are summable, so no distinct-person count appears here — see portal_brand_report_periods for those.';

grant select on public.portal_brand_report_quarters to authenticated;
