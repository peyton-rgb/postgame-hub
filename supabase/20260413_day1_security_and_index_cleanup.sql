-- ============================================================
-- Day 1 Migration: Stop the Bleeding
-- Fixes: C1 (6 SECURITY DEFINER views), M2 (4 duplicate indexes), M3 (2 missing FK indexes)
-- Date: 2026-04-13
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: Fix 6 SECURITY DEFINER views → SECURITY INVOKER
--
-- These views are owned by `postgres` and default to SECURITY DEFINER,
-- meaning every query bypasses RLS and runs with superuser privileges.
-- Recreating them with SECURITY INVOKER makes the views respect
-- the calling user's permissions (anon, authenticated, etc.).
--
-- We DROP + CREATE (not CREATE OR REPLACE) because ALTER VIEW
-- cannot change the security mode. The definitions are identical
-- to what's currently in production.
-- ============================================================

-- 1a. public_brands
DROP VIEW IF EXISTS public_brands;
CREATE VIEW public_brands
  WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  (SELECT count(*) FROM brand_campaigns bc WHERE bc.brand_id = b.id) AS campaign_count,
  (SELECT count(*) FROM deals d WHERE d.brand_id = b.id AND d.published = true) AS deal_count,
  (SELECT count(*) FROM press_articles pa WHERE pa.brand_id = b.id AND pa.published = true) AS press_count
FROM brands b
WHERE archived = false
ORDER BY name;

-- 1b. public_campaign_recaps
DROP VIEW IF EXISTS public_campaign_recaps;
CREATE VIEW public_campaign_recaps
  WITH (security_invoker = true)
AS
SELECT
  cr.id,
  cr.name,
  cr.slug,
  cr.client_name,
  cr.client_logo_url,
  cr.type,
  cr.featured,
  cr.settings,
  cr.public_sections,
  cr.created_at,
  b.name AS brand_name
FROM campaign_recaps cr
LEFT JOIN brands b ON b.id = cr.brand_id
WHERE cr.published = true AND cr.visibility = 'public'
ORDER BY cr.featured DESC, cr.created_at DESC;

-- 1c. public_deal_tracker
DROP VIEW IF EXISTS public_deal_tracker;
CREATE VIEW public_deal_tracker
  WITH (security_invoker = true)
AS
SELECT
  id,
  headline,
  body,
  brand,
  athlete_name,
  athlete_photo_url,
  school,
  sport,
  deal_type,
  industry,
  slug,
  video_url,
  photos,
  media,
  created_at
FROM deal_tracker dt
WHERE published = true
ORDER BY created_at DESC;

-- 1d. public_deals
DROP VIEW IF EXISTS public_deals;
CREATE VIEW public_deals
  WITH (security_invoker = true)
AS
SELECT
  d.id,
  d.brand_name,
  d.brand_logo_url,
  d.athlete_name,
  d.athlete_school,
  d.athlete_sport,
  d.deal_type,
  d.tier,
  d.value,
  d.description,
  d.featured,
  d.date_announced,
  d.image_url,
  d.video_url,
  d.sort_order,
  d.created_at,
  b.name AS brand_display_name
FROM deals d
LEFT JOIN brands b ON b.id = d.brand_id
WHERE d.published = true
ORDER BY d.featured DESC, d.sort_order, d.created_at DESC;

-- 1e. public_pages
DROP VIEW IF EXISTS public_pages;
CREATE VIEW public_pages
  WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.type,
  p.title,
  p.slug,
  p.client_name,
  p.client_logo_url,
  p.settings,
  p.public_sections,
  p.description,
  p.featured,
  p.html_content,
  p.external_url,
  p.created_at,
  b.name AS brand_name,
  b.id AS brand_id
FROM pages p
LEFT JOIN brands b ON b.id = p.brand_id
WHERE p.published = true AND p.visibility = 'public'
ORDER BY p.featured DESC, p.created_at DESC;

-- 1f. public_press
DROP VIEW IF EXISTS public_press;
CREATE VIEW public_press
  WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.title,
  p.slug,
  p.publication,
  p.author,
  p.excerpt,
  p.external_url,
  p.image_url,
  p.category,
  p.featured,
  p.published_date,
  p.sort_order,
  p.created_at,
  p.show_logo,
  p.brand_logo_url,
  p.logo_position,
  b.name AS brand_name
FROM press_articles p
LEFT JOIN brands b ON b.id = p.brand_id
WHERE p.published = true AND p.archived = false
ORDER BY p.featured DESC, p.published_date DESC, p.sort_order;

-- Grant anon + authenticated SELECT on all views so public pages keep working
GRANT SELECT ON public_brands TO anon, authenticated;
GRANT SELECT ON public_campaign_recaps TO anon, authenticated;
GRANT SELECT ON public_deal_tracker TO anon, authenticated;
GRANT SELECT ON public_deals TO anon, authenticated;
GRANT SELECT ON public_pages TO anon, authenticated;
GRANT SELECT ON public_press TO anon, authenticated;


-- ============================================================
-- PART 2: Drop 4 duplicate indexes
--
-- Each pair covers the exact same column(s) on the same table.
-- We keep the newer/better-named one and drop the older duplicate.
-- ============================================================

-- 2a. campaign_optins: keep campaign_optins_brand_id_idx, drop idx_campaign_optins_brand_id
DROP INDEX IF EXISTS idx_campaign_optins_brand_id;

-- 2b. campaign_recaps: keep recaps_slug_idx, drop idx_campaigns_slug (old "campaigns" name)
DROP INDEX IF EXISTS idx_campaigns_slug;

-- 2c. deals: keep deals_brand_id_idx, drop idx_deals_brand (old naming)
DROP INDEX IF EXISTS idx_deals_brand;

-- 2d. pages: keep idx_pages_type, drop idx_hub_pages_type (old "hub_pages" name)
DROP INDEX IF EXISTS idx_hub_pages_type;


-- ============================================================
-- PART 3: Add 2 missing FK indexes
--
-- Foreign key columns without indexes force sequential scans
-- on JOIN and CASCADE DELETE operations.
-- ============================================================

-- 3a. pitch_pages.brand_id — FK to brands(id), no index exists
CREATE INDEX IF NOT EXISTS idx_pitch_pages_brand_id ON pitch_pages (brand_id);

-- 3b. tier3_submissions.recap_id — FK to campaign_recaps(id), no index exists
CREATE INDEX IF NOT EXISTS idx_tier3_submissions_recap_id ON tier3_submissions (recap_id);


COMMIT;
