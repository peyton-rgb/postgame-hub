-- supabase/migrations/20260421_storage_policies_backup.sql
--
-- ⚠️  ROLLBACK REFERENCE — NOT FOR FORWARD APPLICATION
--
-- Captures the exact state of storage.objects policies scoped to the
-- campaign-media bucket as of 2026-04-21, immediately before the
-- tightening migration in 20260421_tighten_campaign_media_storage.sql.
--
-- If the tightening migration breaks existing features, run these
-- statements (after dropping any conflicting new policies) to restore
-- the previous behavior. Not included in the forward migration chain —
-- do not rename this file and do not `supabase db reset` it into history.
--
-- Pulled from pg_policies: policyname, cmd, roles, qual, with_check.
-- All four policies grant to role `public` (anon + authenticated).

-- 1. SELECT — anyone can read anything in the bucket
CREATE POLICY "Public can view campaign media"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'campaign-media');

-- 2. INSERT — anyone can upload anywhere in the bucket
CREATE POLICY "Anon upload campaign media"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'campaign-media');

-- 3. UPDATE — anyone can update any object in the bucket
CREATE POLICY "Anon update campaign media"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'campaign-media')
  WITH CHECK (bucket_id = 'campaign-media');

-- 4. DELETE — anyone can delete anything in the bucket
CREATE POLICY "Anon delete campaign media"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'campaign-media');
