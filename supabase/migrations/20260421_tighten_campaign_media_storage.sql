-- supabase/migrations/20260421_tighten_campaign_media_storage.sql
--
-- Tighten RLS on storage.objects for the campaign-media bucket.
--
-- BEFORE: 4 policies granted to role `public` (anon + authenticated) with
-- no path scoping — any anon client could upload/update/delete anywhere.
-- AFTER:
--   - Public can still READ anything in the bucket (campaign recaps are
--     public-facing; no change to downstream display code).
--   - Anon clients can INSERT only under the `bts/` prefix (BTS submission
--     endpoint lands files under `bts/...`; nothing else anon-writes).
--   - Authenticated clients (dashboard users) keep full INSERT / UPDATE /
--     DELETE access to the bucket, so the campaign media picker, drive
--     import, and any dashboard file ops continue to work unchanged.
--   - Anon clients can no longer UPDATE or DELETE — these were unused and
--     a liability.
--
-- Rollback: run supabase/migrations/20260421_storage_policies_backup.sql
-- after first dropping the 5 new policies created below.

BEGIN;

-- ── Drop the 4 existing permissive policies ──────────────────────────
DROP POLICY IF EXISTS "Anon upload campaign media"      ON storage.objects;
DROP POLICY IF EXISTS "Public can view campaign media"  ON storage.objects;
DROP POLICY IF EXISTS "Anon update campaign media"      ON storage.objects;
DROP POLICY IF EXISTS "Anon delete campaign media"      ON storage.objects;

-- ── New policy set ───────────────────────────────────────────────────

-- a. Public read — recap pages serve campaign-media URLs directly to
-- anonymous browsers, so SELECT stays wide open (bucket is public).
CREATE POLICY "campaign-media public read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'campaign-media');

-- b. Anon INSERT — only under the bts/ prefix. The BTS submission
-- endpoint builds storage paths like "bts/{uuid}-{filename}". Any
-- other anon upload attempt is denied.
CREATE POLICY "campaign-media anon upload bts prefix"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'campaign-media'
    AND starts_with(name, 'bts/')
  );

-- c. Authenticated INSERT — dashboard users (campaign media picker,
-- drive import, etc.) keep full upload access across the bucket.
CREATE POLICY "campaign-media authenticated upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'campaign-media');

-- d. Authenticated UPDATE — same rationale; dashboard users keep the
-- ability to modify metadata on existing objects.
CREATE POLICY "campaign-media authenticated update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'campaign-media')
  WITH CHECK (bucket_id = 'campaign-media');

-- e. Authenticated DELETE — dashboard users keep the ability to remove
-- files (e.g. un-import from drive, delete an athlete's uploads).
CREATE POLICY "campaign-media authenticated delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'campaign-media');

COMMIT;
