-- Brand-level Drive folder ids, written by the admin via POST /api/admin-drive/brand.
--
-- Brief 15. The admin provisions the brand folder tree and tells the Hub the
-- ids immediately; the Hub caches them so submission forms, the recap and the
-- content browser can reach the right folders without waiting for a nightly
-- sweep. drive_parent_folder_id, master_tracker_id and master_tracker_url
-- already exist — this adds the three that do not.
--
-- Additive and idempotent. No dependency on migrations 060-066, which live
-- only on the redesign branch.
--
-- APPLIED to the recap-editor-test branch (jlxdxuqfmnnpwvmozgmm) on 2026-09-22.
-- NOT applied to production.

alter table public.brands
  add column if not exists drive_legal_folder_id           text,
  add column if not exists drive_sales_materials_folder_id text,
  add column if not exists drive_brand_assets_folder_id    text;

comment on column public.brands.drive_legal_folder_id is
  'Legal - {Brand}. Provisioned by the admin, cached here. See docs/drive/CONVENTION.md.';
