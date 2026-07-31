-- Connect contracts to the athlete, the campaign and the brand.
--
-- contracts.athlete_id was created by 20260711 create_contracts_table with a FK
-- to profiles(id) — the 15-row STAFF table — not athletes(id) (3,745 rows), so a
-- contract could only ever point at a staff member. There was also no campaign_id
-- and no brand_id, so a contract could not say which deal it belonged to.
--
-- Verified against the live database before writing this:
--   contracts                     1 row (test data, "goodr · Summer Series")
--   its athlete_id                present in profiles, absent from athletes
--   references TO contracts       none — no FK points at this table, so removing
--                                 the row cascades nowhere
--
-- That row cannot survive step 2: athlete_id is NOT NULL and holds a profiles id
-- with no counterpart in athletes. Deleting it is deliberate and confirmed. The
-- NOT NULL on the two new columns is only possible because the table is empty by
-- then — the delete has to come first.
--
-- optin_id is left exactly as it is.

-- ---------------------------------------------------------------- 1
-- The test row, addressed by id rather than a bare `delete from`: if this table
-- has gained a real row since this was written, step 3 fails loudly on NOT NULL
-- instead of this step quietly deleting it.
delete from public.contracts
  where id = 'ed0f0d16-9bcf-4477-bb72-ad17c959d557';

-- ---------------------------------------------------------------- 2
-- Repoint athlete_id at the athlete master table.
alter table public.contracts
  drop constraint contracts_athlete_id_fkey;

alter table public.contracts
  add constraint contracts_athlete_id_fkey
    foreign key (athlete_id)
    references public.athletes(id)
    on delete restrict;

-- ---------------------------------------------------------------- 3
-- Which campaign the contract is for. campaign_recaps is the campaign table the
-- rest of this schema keys on (submissions.campaign_id, submission_links.campaign_id).
alter table public.contracts
  add column if not exists campaign_id uuid not null;

alter table public.contracts
  add constraint contracts_campaign_id_fkey
    foreign key (campaign_id)
    references public.campaign_recaps(id)
    on delete restrict;

-- ---------------------------------------------------------------- 4
-- Stored deliberately rather than derived through the campaign: a contract is a
-- point-in-time record of who the parties were. Re-pointing a campaign at a
-- different brand later must not silently rewrite who signed.
alter table public.contracts
  add column if not exists brand_id uuid not null;

alter table public.contracts
  add constraint contracts_brand_id_fkey
    foreign key (brand_id)
    references public.brands(id)
    on delete restrict;

-- ---------------------------------------------------------------- 5
-- idx_<table>_<column>, per the add_missing_fk_indexes migration (20260406180637).
-- athlete_id already carries idx_contracts_athlete from create_contracts_table;
-- left as it is rather than duplicated under the fuller name, since a redundant
-- index is exactly what fix_duplicate_and_missing_indexes went and cleaned up.
create index if not exists idx_contracts_campaign_id on public.contracts(campaign_id);
create index if not exists idx_contracts_brand_id    on public.contracts(brand_id);

-- ---------------------------------------------------------------- 6
-- contracts_select_own was `athlete_id = auth.uid()`. That only ever worked
-- because athlete_id held a profiles.id, and profiles.id IS the auth.users id.
-- After step 2 it holds an athletes.id, and there is no path from an
-- authenticated user to a row in athletes: athletes has no user/profile column,
-- and profiles has no athlete_id. The comparison can therefore never be true.
--
-- Dropped rather than left in place, because a policy that silently matches
-- nothing reads like working athlete access when there is none. Until the
-- auth-user ↔ athletes link exists, contracts are staff-read-only via
-- contracts_staff_read. Writes remain service-role only — no INSERT/UPDATE/DELETE
-- policy has ever existed on this table.
drop policy if exists contracts_select_own on public.contracts;
