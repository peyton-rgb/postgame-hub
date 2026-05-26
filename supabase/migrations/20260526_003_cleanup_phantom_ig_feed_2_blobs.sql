-- ============================================================
-- Migration: cleanup_phantom_ig_feed_2_blobs
-- Removes phantom "Post 2" slots from athletes.metrics.
--
-- WHY: The CSV importer matched metric columns by substring, so the
-- occurrence-1 lookup for "impressions" resolved to the
-- "Engagement Rate Impressions" column and leaked the ER% value into a
-- fabricated ig_feed_2: { impressions: <rate> } slot. These phantom slots
-- carry no post_url / engagements and represent no real second post; they
-- rendered spurious "Feed Post 2" sub-rows in the recap roster.
--
-- The import bug is fixed in code (csv-parser.ts rate guard, commit aef8d27)
-- and the renderer now requires a post_url (CampaignRecap.tsx, commit
-- dc4e3d7). This migration removes the 141 pre-existing phantom blobs.
--
-- SAFETY: Only removes a *_2 slot when it exists AND has a null/missing
-- post_url. Slots with a non-empty post_url (real second posts) are never
-- touched. The jsonb minus operator removes the key entirely (not set null).
--
-- SNAPSHOT (rollback record of every affected row's metrics_before):
--   scripts/phantom-cleanup-snapshot-2026-05-26.json
--
-- NOTE: Already executed in production on 2026-05-26 against project
-- xqaybwhpgxillpbbqtks (POSTGAME HUB). 141 rows modified (141 ig_feed_2;
-- 0 ig_reel_2; 0 tiktok_2). Replaying is idempotent — the WHERE clause
-- matches nothing once the phantom slots are gone, so it affects 0 rows.
-- ============================================================

update public.athletes
set metrics = metrics
  - (case when metrics ? 'ig_feed_2' and (metrics->'ig_feed_2'->>'post_url') is null then 'ig_feed_2' else '' end)
  - (case when metrics ? 'ig_reel_2' and (metrics->'ig_reel_2'->>'post_url') is null then 'ig_reel_2' else '' end)
  - (case when metrics ? 'tiktok_2'  and (metrics->'tiktok_2'->>'post_url')  is null then 'tiktok_2'  else '' end)
where
  (metrics ? 'ig_feed_2' and (metrics->'ig_feed_2'->>'post_url') is null) or
  (metrics ? 'ig_reel_2' and (metrics->'ig_reel_2'->>'post_url') is null) or
  (metrics ? 'tiktok_2'  and (metrics->'tiktok_2'->>'post_url')  is null);
