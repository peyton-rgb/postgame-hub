-- ============================================================
-- Video w/ graphic — async render-job status table
--
-- One row per export run. The Hub route (/api/drive/render-videos) writes a
-- `pending` row and fires the FFmpeg worker fire-and-forget; the worker's
-- callback (/api/drive/render-callback) flips the row to `done` with the
-- per-spec Drive links. The draft tool polls this row to fill tracker columns
-- J–O when the render finishes. Mirrors the intake / athlete_edit_jobs pattern.
--
-- All DB access is server-side (service role). Additive only. RLS: staff r/w.
-- ============================================================

create table if not exists public.video_render_jobs (
  id            uuid primary key default gen_random_uuid(),
  athlete_name  text not null,
  status        text not null default 'pending',   -- pending | done | failed
  links         jsonb not null default '{}',        -- { spec: { fileId, webViewLink, name } }
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_vrj_status on public.video_render_jobs (status);
create index if not exists idx_vrj_created on public.video_render_jobs (created_at);

alter table public.video_render_jobs enable row level security;

drop policy if exists vrj_staff_all on public.video_render_jobs;
create policy vrj_staff_all on public.video_render_jobs
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
