-- Migration 046 · portal_campaigns safe-columns view
--
-- APPLIED to xqaybwhpgxillpbbqtks on 9 Sep via apply_migration
-- (name: portal_campaigns_view). Verified after applying: 20 columns
-- exposed, 0 of the 9 forbidden columns reachable, no tracker_*/brief_*
-- columns, 0 draft rows, and CVS resolves to 52 rows (6 active + 46
-- wrapped) against 53 base rows including 1 draft.
--
-- Specified by the Phase 2 brief §3 but built during Phase 3a: every
-- dashboard tile reads through it, and Phase 3a's acceptance forbids the
-- portal touching campaign_recaps directly.
--
-- Rollback:
--   DROP VIEW IF EXISTS public.portal_campaigns;

-- security_invoker = true so the CALLER's RLS applies. A plain view runs as its
-- owner and would bypass the per-brand policies Phase 2 adds, which is the whole
-- point of the view existing.
--
-- NOT A SECURITY BOUNDARY YET. Phase 2's RLS has not shipped, and
-- campaign_recaps still carries `select to authenticated using (true)`, so today
-- this view returns every brand's rows to any authenticated session exactly as
-- the base table does. What it DOES do today is fence the COLUMNS: settings
-- (which can carry budget), pin_hash, recap_config, metric_overrides, owner_id,
-- admin_account_id, frameio_url and the tracker_*/brief_*/drive_contracts_* /
-- drive_trackers_* families are not reachable through it at all. Row scoping is
-- enforced in the app layer (resolveSessionPortal -> explicit brand_id filter)
-- until Phase 2 lands, per the belt-and-braces rule in the Phase 3 brief §5.
--
-- The six settings-derived columns are lifted out individually on purpose:
-- exposing `settings` whole is how a budget reaches a client.
--
-- Drafts are excluded here rather than in each page. "draft rows, if any appear,
-- are hidden from the portal" (Phase 3 brief §2) — enforcing that at the source
-- means no portal page can leak one by forgetting a filter.

create or replace view public.portal_campaigns
with (security_invoker = true) as
select
  cr.id,
  cr.name,
  cr.slug,
  cr.brand_id,
  cr.lifecycle_status,
  cr.description,
  cr.hero_image_url,
  cr.thumbnail_url,
  cr.tags,
  cr.public_sections,
  cr.manager_name,
  cr.manager_email,
  cr.drive_content_folder_id,
  cr.admin_created_on,
  cr.settings->>'quarter'       as quarter,
  cr.settings->>'campaign_type' as campaign_type,
  cr.settings->>'content_type'  as content_type,
  cr.settings->>'platform'      as platform,
  cr.settings->'key_takeaways'  as key_takeaways,
  cr.settings->'kpi_targets'    as kpi_targets
from public.campaign_recaps cr
where cr.lifecycle_status is distinct from 'draft';

comment on view public.portal_campaigns is
  'Safe-column projection of campaign_recaps for /portal. security_invoker=true so caller RLS applies. Never exposes settings whole (budget), pin_hash, recap_config, metric_overrides, owner_id, admin_account_id, frameio_url, or tracker_*/brief_* columns. Drafts excluded. Row scoping comes from Phase 2 RLS; until then the app passes brand_id explicitly.';

grant select on public.portal_campaigns to authenticated;
