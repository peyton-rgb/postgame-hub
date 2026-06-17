-- ============================================================
-- Auto Editor — Phase 1: videographer upload links
--
-- A private, unguessable link scoped to ONE athlete + ONE campaign that lets a
-- (logged-out) videographer upload the content they shot straight into the
-- SAME athlete_deliverables pipeline. The public page validates the token
-- server-side with the service role — RLS below is for the in-app creators.
--
-- Additive only.
-- ============================================================

create table if not exists public.videographer_upload_links (
  id                uuid primary key default gen_random_uuid(),
  token             text not null unique,                 -- high-entropy, unguessable
  athlete_id        uuid not null references public.profiles(id) on delete cascade,
  optin_campaign_id uuid not null references public.optin_campaigns(id) on delete cascade,
  created_by        uuid references public.profiles(id) on delete set null,
  label             text,
  expires_at        timestamptz,
  revoked           boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists idx_vul_athlete on public.videographer_upload_links (athlete_id);
create index if not exists idx_vul_campaign on public.videographer_upload_links (optin_campaign_id);

alter table public.videographer_upload_links enable row level security;

-- The owning athlete (athlete_id = auth.uid()) and staff can create/list/revoke.
-- (The public /v/[token] page does NOT use these — it reads via the service
-- role after validating the token.)
drop policy if exists vul_select on public.videographer_upload_links;
create policy vul_select on public.videographer_upload_links
  for select to authenticated using (athlete_id = auth.uid() or public.is_staff());

drop policy if exists vul_insert on public.videographer_upload_links;
create policy vul_insert on public.videographer_upload_links
  for insert to authenticated with check (athlete_id = auth.uid() or public.is_staff());

drop policy if exists vul_update on public.videographer_upload_links;
create policy vul_update on public.videographer_upload_links
  for update to authenticated using (athlete_id = auth.uid() or public.is_staff())
  with check (athlete_id = auth.uid() or public.is_staff());
