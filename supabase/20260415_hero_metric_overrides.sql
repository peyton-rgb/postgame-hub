-- ============================================================
-- Hero Metric Overrides
-- ============================================================
-- Adds a JSONB column to campaign_recaps that stores hand-typed
-- corrections to calculated Hero metrics. Empty {} means no
-- overrides — the recap displays calculated values.
--
-- When a value is present (e.g. {"avg_engagement_rate": 4.2}),
-- the recap displays that hand-typed value AND shows a visible
-- "edited" badge so it's clear the number was manually adjusted.
--
-- Date: 2026-04-15
-- Status: APPLIED to production (xqaybwhpgxillpbbqtks) on 2026-04-15
-- ============================================================

BEGIN;

ALTER TABLE campaign_recaps
  ADD COLUMN IF NOT EXISTS metric_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN campaign_recaps.metric_overrides IS
  'Hand-typed Hero metric overrides. Keys are Hero metric names (e.g. avg_engagement_rate, total_impressions, combined_followers). Empty object means no overrides — recap uses calculated values.';

COMMIT;
