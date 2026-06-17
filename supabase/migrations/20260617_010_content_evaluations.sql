-- ============================================================
-- Auto Editor — Phase 2: content evaluations (the curator's output)
--
-- One evaluation per uploaded deliverable (re-run replaces it). Photos are
-- scored by a vision model against the brief + house checklist; videos get a
-- PRELIMINARY evaluation (no frame analysis) pending the Edit Engine's Twelve
-- Labs layer. Compliance is a HARD GATE — a failing item can't be a top pick.
--
-- Additive only. RLS: staff read/write; athletes may read their own.
-- ============================================================

create table if not exists public.content_evaluations (
  id                uuid primary key default gen_random_uuid(),
  deliverable_id    uuid not null references public.athlete_deliverables(id) on delete cascade,
  optin_campaign_id uuid references public.optin_campaigns(id) on delete cascade,
  athlete_id        uuid references public.profiles(id) on delete cascade,
  overall_score     numeric,                  -- 0..100 blended
  scores            jsonb,                    -- { authenticity, compliance, performance, brand, technical }
  compliance_pass   boolean not null default true,
  compliance_flags  text[] not null default '{}',
  is_top_pick       boolean not null default false,
  rank              int,
  dedupe_group      int,                      -- near-identical shots share a group
  rationale         text,
  is_preliminary    boolean not null default false,  -- video: scored without watching footage
  model             text,
  evaluated_at      timestamptz,
  created_at        timestamptz not null default now(),
  unique (deliverable_id)
);

create index if not exists idx_ceval_optin on public.content_evaluations (optin_campaign_id);
create index if not exists idx_ceval_athlete on public.content_evaluations (athlete_id);

alter table public.content_evaluations enable row level security;

drop policy if exists ceval_staff_all on public.content_evaluations;
create policy ceval_staff_all on public.content_evaluations
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists ceval_athlete_read on public.content_evaluations;
create policy ceval_athlete_read on public.content_evaluations
  for select to authenticated using (athlete_id = auth.uid());
