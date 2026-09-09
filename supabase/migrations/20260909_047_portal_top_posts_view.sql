-- Migration 047 · portal_top_posts view
--
-- APPLIED to xqaybwhpgxillpbbqtks on 9 Sep via apply_migration
-- (name: portal_top_posts_view). Verified after applying: for CVS the top
-- three are Joey Blaze 933K, Kemari Copeland 895K, Jessica Popiol 850K, from a
-- pool of 772 eligible posts under the authenticated role.
--
-- Rollback:
--   DROP VIEW IF EXISTS public.portal_top_posts;

-- One row per athlete post that has a VERIFIED per-post view count, so the
-- dashboard's Top posts tile can order and limit in SQL.
--
-- Without this the page would have to pull every athlete row carrying a
-- metrics blob (2,014 for CVS alone) and sort in JS — megabytes over the wire
-- to render three lines.
--
-- WHY ig_reel.views AND NOTHING ELSE. Of the populated metric fields,
-- ig_feed.impressions has slightly more rows (1,139 vs 1,074) but impressions
-- are not views; ranking them in one list would compare unlike quantities and
-- label the result "views". ig_story has no per-post URL. tiktok.views exists
-- on 46 rows. So the tile ranks reels and says so.
--
-- THE % 100000 GUARD IS NOT COSMETIC. Eight athlete rows on one campaign
-- ("The Tournament") carry values that are exact multiples of 100,000,
-- including 8,600,000 appearing on TWO DIFFERENT athletes. Those are
-- campaign-level reach figures copied onto each athlete row, not per-post
-- counts. Every other campaign has zero round-to-100K values (26 Spring Epic
-- Beauty: 370 distinct values across 400 rows), so the pattern is confined and
-- the tell is reliable. Unfiltered they take the entire top of the tile, which
-- would present a whole campaign's reach as one athlete's post — exactly what
-- design-system rule 6 forbids.
--
-- The regex guard on the text before casting matters: metrics is free-form
-- jsonb and a non-numeric string would raise on ::bigint and take the page
-- down with it.
--
-- security_invoker = true so the caller's RLS applies, same as
-- portal_campaigns. Not a row-security boundary until Phase 2 ships; the app
-- passes brand_id explicitly.

create or replace view public.portal_top_posts
with (security_invoker = true) as
select
  a.id                                        as athlete_id,
  a.campaign_id,
  cr.brand_id,
  a.name                                      as athlete_name,
  a.school,
  a.sport,
  cr.name                                     as campaign_name,
  (a.metrics->'ig_reel'->>'views')::bigint    as views,
  a.metrics->'ig_reel'->>'post_url'           as post_url
from public.athletes a
join public.campaign_recaps cr on cr.id = a.campaign_id
where a.metrics is not null
  and jsonb_typeof(a.metrics) = 'object'
  and a.metrics ? 'ig_reel'
  and (a.metrics->'ig_reel'->>'views') ~ '^[0-9]+$'
  and (a.metrics->'ig_reel'->>'views')::bigint > 0
  and (a.metrics->'ig_reel'->>'views')::bigint % 100000 <> 0
  and a.metrics->'ig_reel'->>'post_url' is not null
  and a.name is not null;

comment on view public.portal_top_posts is
  'Athlete posts with a verified per-post ig_reel view count, for the portal dashboard Top posts tile. Excludes values that are exact multiples of 100000 — those are campaign-level reach figures copied onto athlete rows, not per-post counts. security_invoker=true.';

grant select on public.portal_top_posts to authenticated;
