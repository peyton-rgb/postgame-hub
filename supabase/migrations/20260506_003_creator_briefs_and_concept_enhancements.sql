-- ============================================================
-- Phase 3: CREATOR_BRIEFS table + concept enhancements
-- ALREADY APPLIED to recap project (xqaybwhpgxillpbbqtks) on 2026-05-06
-- This file is kept as documentation of what was run.
-- ============================================================

-- Add athlete + reference image support to concepts
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS athlete_name text;
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS reference_image_urls jsonb DEFAULT '[]';

-- Add 'brief_writer' to agent_name enum
ALTER TYPE agent_name ADD VALUE IF NOT EXISTS 'brief_writer';

-- Creator brief statuses
CREATE TYPE creator_brief_status AS ENUM ('draft', 'published', 'archived');

-- Creator briefs: public-facing videographer/creator briefs generated from approved concepts
CREATE TABLE creator_briefs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id        uuid NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  brief_id          uuid NOT NULL REFERENCES campaign_briefs(id) ON DELETE CASCADE,
  brand_id          uuid NOT NULL REFERENCES brands(id),
  slug              text UNIQUE NOT NULL,
  title             text NOT NULL,
  athlete_name      text,
  sections          jsonb NOT NULL DEFAULT '[]',
  reference_images  jsonb DEFAULT '[]',
  brand_color       text,
  brand_logo_url    text,
  status            creator_brief_status NOT NULL DEFAULT 'draft',
  published_at      timestamptz,
  created_by        uuid NOT NULL REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_creator_briefs_concept_id ON creator_briefs(concept_id);
CREATE INDEX idx_creator_briefs_brief_id ON creator_briefs(brief_id);
CREATE INDEX idx_creator_briefs_slug ON creator_briefs(slug);
CREATE INDEX idx_creator_briefs_status ON creator_briefs(status);

CREATE TRIGGER creator_briefs_updated_at
  BEFORE UPDATE ON creator_briefs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE creator_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage creator_briefs" ON creator_briefs FOR ALL USING (is_postgame_staff());
CREATE POLICY "Public can view published creator_briefs" ON creator_briefs FOR SELECT USING (status = 'published');

-- Storage bucket for reference images (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reference-images', 'reference-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload reference images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reference-images');

CREATE POLICY "Public can view reference images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'reference-images');

CREATE POLICY "Authenticated users can delete reference images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reference-images');
