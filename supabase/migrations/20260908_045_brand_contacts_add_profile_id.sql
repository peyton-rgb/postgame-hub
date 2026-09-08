-- Migration 045 · brand_contacts.profile_id
--
-- APPLIED to xqaybwhpgxillpbbqtks on 8 Sep as remote version
-- 20260908213148 (name: brand_contacts_add_profile_id). This file is a
-- verbatim capture of the statements read back from
-- supabase_migrations.schema_migrations — it is NOT a re-derivation, and
-- it was not run again from here.
--
-- NOTE ON THE NAME TWIN: 029 already added profile_id to
-- postgame_contacts, the IDENTITY table (one row per human). THIS adds
-- profile_id to brand_contacts, the ATTACHMENT table (one row per
-- person-per-brand). They are different columns on different tables and
-- mean different things. 029's is the one-login-per-human link; this one
-- records which attachment a given magic-link sign-in actually redeemed,
-- which is what per-brand RLS has to key on.
--
-- Rollback:
--   DROP INDEX IF EXISTS brand_contacts_profile_id_idx;
--   ALTER TABLE brand_contacts DROP COLUMN profile_id;

-- Link a brand contact to the signed-in user (profiles row) once they accept a magic-link invite.
alter table public.brand_contacts
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

create index if not exists brand_contacts_profile_id_idx
  on public.brand_contacts (profile_id);

comment on column public.brand_contacts.profile_id is
  'Set on first magic-link sign-in when the auth email matches invited_email/signup_email. Basis for brand-portal RLS.';
