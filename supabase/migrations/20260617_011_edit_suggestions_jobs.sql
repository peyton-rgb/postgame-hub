-- ============================================================
-- Auto Editor — Phase 3: edit suggestions + the edit-job gate
--
-- For each top pick the curator can propose specific edits (keyed to checklist
-- categories); compliance failures surface as `required` suggestions. Each
-- suggestion has an "Approve & auto-edit" action that QUEUES an edit job for
-- the future Edit Engine — the button is real, execution is stubbed.
--
-- NOTE: the table is athlete_edit_jobs (not edit_jobs) — public.edit_jobs
-- already exists for the staff AI-editing feature, and we never touch it.
--
-- Additive only. RLS: staff read/write on both.
-- ============================================================

create table if not exists public.edit_suggestions (
  id              uuid primary key default gen_random_uuid(),
  deliverable_id  uuid not null references public.athlete_deliverables(id) on delete cascade,
  evaluation_id   uuid references public.content_evaluations(id) on delete set null,
  kind            text not null,                 -- crop | relight | trim | caption | disclosure | ...
  summary         text not null,
  detail          text,
  severity        text not null default 'recommended',  -- info | recommended | required
  status          text not null default 'proposed',     -- proposed | approved | dismissed
  created_at      timestamptz not null default now()
);

create index if not exists idx_editsug_deliverable on public.edit_suggestions (deliverable_id);

alter table public.edit_suggestions enable row level security;

drop policy if exists editsug_staff_all on public.edit_suggestions;
create policy editsug_staff_all on public.edit_suggestions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.athlete_edit_jobs (
  id              uuid primary key default gen_random_uuid(),
  deliverable_id  uuid not null references public.athlete_deliverables(id) on delete cascade,
  suggestion_id   uuid references public.edit_suggestions(id) on delete set null,
  type            text not null,
  params          jsonb not null default '{}',
  status          text not null default 'queued',   -- queued | running | done | failed
  result_url      text,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_aej_deliverable on public.athlete_edit_jobs (deliverable_id);
create index if not exists idx_aej_status on public.athlete_edit_jobs (status);

alter table public.athlete_edit_jobs enable row level security;

drop policy if exists aej_staff_all on public.athlete_edit_jobs;
create policy aej_staff_all on public.athlete_edit_jobs
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
