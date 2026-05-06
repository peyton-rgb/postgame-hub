-- ============================================================
-- Phase 1: CAMPAIGN_BRIEFS table + supporting functions
-- ALREADY APPLIED to recap project (xqaybwhpgxillpbbqtks) on 2026-05-06
-- This file is kept as documentation of what was run.
-- ============================================================
-- NOTE: Table is named campaign_briefs (not briefs) because the
-- existing briefs table stores external-facing brief pages.
-- ============================================================

-- Migration 1: is_postgame_staff function
CREATE OR REPLACE FUNCTION is_postgame_staff()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT email LIKE '%@pstgm.com'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration 2: add drive_parent_folder_id to brands
ALTER TABLE brands ADD COLUMN IF NOT EXISTS drive_parent_folder_id text;

-- Migration 3: campaign_briefs table
CREATE TYPE brief_campaign_type AS ENUM (
  'standard', 'top_50', 'ambassador_program', 'gifting', 'experiential', 'recap_only'
);
CREATE TYPE brief_production_config AS ENUM (
  'vid_is_editor', 'split_team', 'no_production'
);
CREATE TYPE brief_status AS ENUM (
  'draft', 'published', 'in_production', 'complete', 'cancelled'
);

CREATE TABLE campaign_briefs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           uuid NOT NULL REFERENCES brands(id),
  campaign_id        uuid REFERENCES brand_campaigns(id),
  name               text NOT NULL,
  campaign_type      brief_campaign_type NOT NULL DEFAULT 'standard',
  start_date         date,
  target_launch_date date,
  budget             numeric,
  production_config  brief_production_config NOT NULL DEFAULT 'vid_is_editor',
  brief_content      jsonb,
  mandatories        text[] DEFAULT '{}',
  restrictions       text[] DEFAULT '{}',
  athlete_targeting  jsonb DEFAULT '{}',
  drive_folder_id    text,
  status             brief_status NOT NULL DEFAULT 'draft',
  version            integer NOT NULL DEFAULT 1,
  parent_brief_id    uuid REFERENCES campaign_briefs(id),
  created_by         uuid NOT NULL REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_briefs_brand_id ON campaign_briefs(brand_id);
CREATE INDEX idx_campaign_briefs_status ON campaign_briefs(status);
CREATE INDEX idx_campaign_briefs_created_by ON campaign_briefs(created_by);
CREATE INDEX idx_campaign_briefs_parent ON campaign_briefs(parent_brief_id) WHERE parent_brief_id IS NOT NULL;

CREATE TRIGGER campaign_briefs_updated_at
  BEFORE UPDATE ON campaign_briefs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE campaign_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view campaign_briefs" ON campaign_briefs FOR SELECT USING (is_postgame_staff());
CREATE POLICY "Staff can create campaign_briefs" ON campaign_briefs FOR INSERT WITH CHECK (is_postgame_staff());
CREATE POLICY "Staff can update campaign_briefs" ON campaign_briefs FOR UPDATE USING (is_postgame_staff());
CREATE POLICY "Staff can delete campaign_briefs" ON campaign_briefs FOR DELETE USING (is_postgame_staff());
