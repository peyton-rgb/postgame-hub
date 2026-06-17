-- ============================================================
-- Security fix: close two RLS write holes (staff-only writes)
--
-- optin_campaigns and media each had a policy granting ANY authenticated user
-- full write access. Now that athletes and videographers are real authenticated
-- users, those writes must be staff-only (is_staff() = role <> 'athlete').
--
-- Additive/replace-policy only: reads are preserved, no table is dropped, and
-- no other policy on these tables is changed.
-- ============================================================

-- optin_campaigns: writes become staff-only; reads unchanged
drop policy if exists "optin_campaigns_auth_write" on public.optin_campaigns;
create policy "optin_campaigns_auth_read" on public.optin_campaigns
  for select to authenticated using (true);
create policy "optin_campaigns_staff_write" on public.optin_campaigns
  for insert to authenticated with check (public.is_staff());
create policy "optin_campaigns_staff_update" on public.optin_campaigns
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "optin_campaigns_staff_delete" on public.optin_campaigns
  for delete to authenticated using (public.is_staff());

-- media: writes become staff-only; reads unchanged
drop policy if exists "Auth users full access to media" on public.media;
create policy "media_auth_read" on public.media
  for select to authenticated using (true);
create policy "media_staff_write" on public.media
  for insert to authenticated with check (public.is_staff());
create policy "media_staff_update" on public.media
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "media_staff_delete" on public.media
  for delete to authenticated using (public.is_staff());
