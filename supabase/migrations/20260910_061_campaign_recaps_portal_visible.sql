-- portal_visible — an explicit switch for whether a campaign appears in the
-- brand-facing portal.
--
-- WHY A NEW COLUMN AND NOT AN EXISTING ONE. The portal had no visibility rule at
-- all: CampaignsBody selected every recap for the brand and rendered every one,
-- so 17 empty CVS shells (old surveys, BOPIS runs, "Injured Athlete") showed to
-- the client as "Campaign content uploading soon" cards. Two existing fields
-- were candidates and both are wrong:
--
--   * published — already means "the recap page is live". Reusing it to mean
--     "listed in the portal" would collapse two different ideas, and would also
--     hide the in-flight cards, which are deliberate: a brand with one running
--     campaign should see it running, not see nothing.
--   * "has media" — an accident of ingest timing, not an intent. It would hide a
--     published campaign the moment its media was still uploading.
--
-- So visibility gets its own field. Default true, so nothing changes for any
-- existing row until someone decides otherwise, and the admin sync can keep
-- recreating rows without resurrecting them into the portal — the flag lives on
-- the recap, and a re-synced row simply starts visible again unless set false.
--
-- Rollback: ALTER TABLE campaign_recaps DROP COLUMN portal_visible;

ALTER TABLE campaign_recaps
  ADD COLUMN IF NOT EXISTS portal_visible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN campaign_recaps.portal_visible IS
  'Brand-facing portal listing switch. false hides the campaign from CampaignsBody, '
  'the portal dashboard counts and the in-flight list. Independent of published, '
  'which controls whether the recap page itself is live.';

-- Partial index: the portal filters on portal_visible = true on every page load,
-- and the false set is tiny, so index the common predicate.
CREATE INDEX IF NOT EXISTS idx_campaign_recaps_portal_visible
  ON campaign_recaps (brand_id)
  WHERE portal_visible;
