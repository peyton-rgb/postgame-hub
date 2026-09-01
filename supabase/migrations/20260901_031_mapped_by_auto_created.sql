-- ============================================================
-- admin_account_map.mapped_by gains 'auto_created'.
--
-- The account → brand sync can now CREATE a brand when an account name is
-- neither an exact match for an existing brand nor near one (see
-- src/lib/account-brand-map.ts). Those mappings need provenance distinct from
-- 'auto_exact': an auto_exact row was matched against a brand a human had
-- already vouched for, an auto_created row brought its brand into existence.
-- Auditing "which brands did the sync invent" is a WHERE clause, not a guess.
--
-- Must be applied BEFORE the route change deploys — the insert fails the CHECK
-- without it.
-- ============================================================

alter table public.admin_account_map
  drop constraint if exists admin_account_map_mapped_by_check;

alter table public.admin_account_map
  add constraint admin_account_map_mapped_by_check
  check (mapped_by is null or mapped_by in ('auto_exact', 'human', 'auto_created'));
