-- ============================================================
-- Athlete App — fix: allow the 'athlete' role on profiles
--
-- profiles.role has a CHECK constraint that only permitted the staff roles
-- (admin, brand_relations, campaign_manager, social_media_manager). Athlete
-- signup (handle_new_user inserting role='athlete') would have violated it and
-- failed at the database level. This widens the allowlist to include 'athlete'.
--
-- Additive in spirit: it only ADDS an allowed value — no existing row, column,
-- or data is dropped or changed. All existing rows already satisfy the new
-- constraint, so validation cannot fail.
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array[
    'admin',
    'brand_relations',
    'campaign_manager',
    'social_media_manager',
    'athlete'
  ]));
