-- Migration 044 · scope writes to staff on brands / campaign_recaps / athletes / deals
--
-- APPLIED to xqaybwhpgxillpbbqtks on 5 Sep as remote version
-- 20260905083142 (name: scope_writes_to_staff_on_four_core_tables).
-- Verbatim capture of the statements read back from
-- supabase_migrations.schema_migrations; not re-run from here.
--
-- Rollback (restores the pre-existing shape — note this REOPENS writes to
-- every authenticated session, so only do it deliberately):
--   drop policy ... _select_authenticated / _insert_staff / _update_staff /
--     _delete_staff on each of the four tables, then recreate the single
--     "Auth users full access to <table>" ALL policy.

-- brands, campaign_recaps, athletes and deals each carried a single
-- `authenticated ALL USING(true) WITH CHECK(true)` policy. ALL means read AND
-- WRITE, so any authenticated session — athlete or brand included — could modify
-- them straight through the REST API with the anon key, without loading a page.
-- The middleware allowlist stops such a session reaching a staff PAGE; it does
-- nothing about direct API calls.
--
-- Reads stay open to authenticated (59 client-side write sites across 11 staff
-- /dashboard files also read heavily, and the public pages depend on the
-- separate anon policies). Writes move behind is_staff().
--
-- SAFE ONLY BECAUSE is_staff() WAS FIXED FIRST. It was `role <> 'athlete'` — a
-- denylist the brand account passed — until it became an allowlist on
-- access_level (staff, admin, exec). Applying this before that would have handed
-- brand full write access while appearing to tighten security.
--
-- Verified before applying: zero writes from the athlete app; the brand portal
-- reads via the service role; no dynamic table names in src/, so the audit of
-- write paths is exhaustive rather than indicative.
--
-- Every anon/public policy on these tables is left untouched — those govern the
-- client-facing pages and are a separate question.

-- ── brands ──
drop policy if exists "Auth users full access to brands" on public.brands;
create policy "brands_select_authenticated" on public.brands
  for select to authenticated using (true);
create policy "brands_insert_staff" on public.brands
  for insert to authenticated with check (is_staff());
create policy "brands_update_staff" on public.brands
  for update to authenticated using (is_staff()) with check (is_staff());
create policy "brands_delete_staff" on public.brands
  for delete to authenticated using (is_staff());

-- ── campaign_recaps ──
drop policy if exists "Auth users full access to campaigns" on public.campaign_recaps;
create policy "campaign_recaps_select_authenticated" on public.campaign_recaps
  for select to authenticated using (true);
create policy "campaign_recaps_insert_staff" on public.campaign_recaps
  for insert to authenticated with check (is_staff());
create policy "campaign_recaps_update_staff" on public.campaign_recaps
  for update to authenticated using (is_staff()) with check (is_staff());
create policy "campaign_recaps_delete_staff" on public.campaign_recaps
  for delete to authenticated using (is_staff());

-- ── athletes ──
drop policy if exists "Auth users full access to athletes" on public.athletes;
create policy "athletes_select_authenticated" on public.athletes
  for select to authenticated using (true);
create policy "athletes_insert_staff" on public.athletes
  for insert to authenticated with check (is_staff());
create policy "athletes_update_staff" on public.athletes
  for update to authenticated using (is_staff()) with check (is_staff());
create policy "athletes_delete_staff" on public.athletes
  for delete to authenticated using (is_staff());

-- ── deals ──
drop policy if exists "Authenticated users can do everything on deals" on public.deals;
create policy "deals_select_authenticated" on public.deals
  for select to authenticated using (true);
create policy "deals_insert_staff" on public.deals
  for insert to authenticated with check (is_staff());
create policy "deals_update_staff" on public.deals
  for update to authenticated using (is_staff()) with check (is_staff());
create policy "deals_delete_staff" on public.deals
  for delete to authenticated using (is_staff());
