-- posting_packages: close the anon read/write hole, fence authenticated to staff.
--
-- APPLY ONLY AFTER the /deliver/[token] rebuild (feat/posting-page-v2) is live
-- in production. Before that, the deployed page still reads this table with the
-- anon key and every athlete link would break.
--
-- Supersedes the never-applied 20260917_061 on fix/posting-packages-rls (same
-- SQL, renumbered so it runs after 072).
--
-- THE HOLE. Three policies stand on this table:
--   "Token-based public access"  SELECT to anon   USING (delivery_token IS NOT NULL)
--   "Token-based update"         UPDATE to anon   USING/CHECK (delivery_token IS NOT NULL)
--   "Auth users full access"     ALL to authenticated  USING (true) CHECK (true)
-- delivery_token has a default, so every row has one and the anon condition is
-- always true: anyone holding the public anon key (it ships in every visitor's
-- browser) can list every package's token and rewrite any column of any row.
-- The token filter only ever existed in app code. The authenticated policy
-- hands the same read/write to brand and athlete accounts.
--
-- AFTER. /api/deliver/[token] (+ /confirm, /posted) look up one row by exact
-- token on the service-role client, which bypasses RLS, so anon needs no path
-- to the table at all. Staff-side consumers (/api/posting-packages,
-- /api/publishing/packages, /api/assets/[id]/deliver, /dashboard/assets) run
-- as staff and are unaffected.
--
-- KNOWN SIDE EFFECT. The brand-portal policy on package_deliverables
-- (20260909_051) scopes brand users through a subquery on posting_packages.
-- With staff-only RLS here, that subquery returns nothing for a brand user, so
-- brands see no package_deliverables. Today that is 0 rows and no package has
-- a campaign_id, so nothing visible changes; if brands ever need those rows,
-- add a brand SELECT policy here scoped the same way.

begin;

drop policy if exists "Token-based public access" on public.posting_packages;
drop policy if exists "Token-based update"        on public.posting_packages;
drop policy if exists "Auth users full access"    on public.posting_packages;

drop policy if exists "posting_packages_staff_all" on public.posting_packages;
create policy "posting_packages_staff_all"
  on public.posting_packages
  for all
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

alter table public.posting_packages enable row level security;

commit;
