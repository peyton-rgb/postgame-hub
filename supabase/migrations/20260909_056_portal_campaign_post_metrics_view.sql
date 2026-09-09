-- Campaign totals computed from what the athletes actually posted, for
-- campaigns whose kpi_targets was never filled in.
--
-- WHY A VIEW. Same reason as 048/049: summing in the app would mean pulling
-- every athlete row, and PostgREST caps a response at 1000 regardless of
-- .limit() — a brand with 2,096 athlete rows would silently total a fraction
-- of them.
--
-- EVERY FIGURE CARRIES ITS OWN CONTRIBUTOR COUNT (*_athletes). The UI must
-- show a figure only when at least one athlete actually has that metric,
-- and a sum of nothing is 0, which is indistinguishable from a real zero.
-- The count is how the caller tells "nobody reported this" from "this is
-- genuinely zero".
--
-- Values in athletes.metrics are JSON numbers (some with decimals, e.g.
-- 1087.47), so each sum is guarded by jsonb_typeof(...) = 'number'. That
-- also skips the JSON nulls left where an aggregate-shaped value was cleared.
--
-- posts counts athlete rows carrying ANY post URL — the athletes.post_url
-- column or a per-platform post_url inside metrics — because which one is
-- populated depends on how the row was imported.
--
-- Drafts are excluded, matching portal_campaigns and portal_brand_athletes.
-- security_invoker = true so the caller's RLS applies.
--
-- Rollback: DROP VIEW IF EXISTS public.portal_campaign_post_metrics;

create or replace view public.portal_campaign_post_metrics
with (security_invoker = true) as
select
  a.campaign_id,

  count(*) filter (
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

  count(*) filter (where coalesce(a.ig_followers, 0) > 0)              as followers_athletes,
  sum(a.ig_followers) filter (where coalesce(a.ig_followers, 0) > 0)   as followers

from public.athletes a
join public.campaign_recaps cr on cr.id = a.campaign_id
where cr.lifecycle_status is distinct from 'draft'
group by a.campaign_id;

comment on view public.portal_campaign_post_metrics is
  'Per-campaign totals derived from athletes.metrics, for recaps whose kpi_targets was never filled. Each figure is paired with a *_athletes contributor count so the UI can distinguish "nobody reported this" from a genuine zero. security_invoker=true.';

grant select on public.portal_campaign_post_metrics to authenticated;
