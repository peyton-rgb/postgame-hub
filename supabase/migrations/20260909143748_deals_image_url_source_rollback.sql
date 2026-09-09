-- Applied to xqaybwhpgxillpbbqtks as 20260909143748_deals_image_url_source_rollback.
-- Captured here after the fact: it was applied during the deal-image migration
-- (agent_jobs seq 38) and the repo had no record of it.
--
-- Named by the remote version rather than the folder's NNN counter on purpose —
-- several branches are in flight and each was about to claim the same number.
-- Statements are the ones that ran; nothing is re-run against the database by
-- committing this file.

alter table public.deals add column if not exists image_url_source text;

comment on column public.deals.image_url_source is
  'Original static.wixstatic.com URL, captured 2026-09-09 before the deal photos were moved into Supabase Storage. Rollback: UPDATE deals SET image_url = image_url_source.';
