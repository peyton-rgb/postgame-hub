-- portal_campaigns.description was reading the wrong place.
--
-- THE BUG, and it is mine from migration 046. That view lifts quarter,
-- campaign_type, content_type, platform, key_takeaways and kpi_targets out of
-- `settings`, but took `description` from the bare campaign_recaps column.
-- The column is empty on almost every recap — the text lives in
-- settings->>'description':
--
--   campaign          column   settings
--   Chicago Activation      0        609
--   Minute Clinic           0        465
--   SPF                     0        462
--   W/CWS                   0        436
--   Mother's Day            0        402
--   Holiday                 0        302
--   RMH Boston              0        273
--   The Tournament        119        430
--
-- So the portal's campaign Overview showed "No brief on file" for every one of
-- them while the public recap page rendered the description fine — the recap
-- renderers (CampaignRecap.tsx, recap-v2/OverviewSection) read
-- settings.description.
--
-- settings WINS, and the column is the fallback. The two differ on The
-- Tournament, and settings is the copy the public recap shows; a brand
-- clicking "Open recap" from the portal should not meet different words. The
-- column fallback keeps any row where only it was filled.
--
-- Rollback: restore `description` as a bare column reference.

create or replace view public.portal_campaigns
with (security_invoker = true) as
select
  id,
  name,
  slug,
  brand_id,
  lifecycle_status,
  coalesce(nullif(btrim(settings->>'description'), ''), description) as description,
  hero_image_url,
  thumbnail_url,
  tags,
  public_sections,
  manager_name,
  manager_email,
  drive_content_folder_id,
  admin_created_on,
  settings ->> 'quarter'       as quarter,
  settings ->> 'campaign_type' as campaign_type,
  settings ->> 'content_type'  as content_type,
  settings ->> 'platform'      as platform,
  settings -> 'key_takeaways'  as key_takeaways,
  settings -> 'kpi_targets'    as kpi_targets
from campaign_recaps cr
where lifecycle_status is distinct from 'draft';

grant select on public.portal_campaigns to authenticated;
