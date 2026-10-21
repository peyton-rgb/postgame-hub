-- ============================================================
-- 097 — frameio_webhook_events: the logbook for Frame.io's webhooks.
--
-- Every POST Frame.io sends to /api/frameio/webhook lands here as one row,
-- raw payload kept verbatim. Mirrors instagram_webhook_events.
--
-- Phase 1 (Oct 2026): log comment.* events from internal reviewers (Dom) on
-- the Raising Cane's basketball edits. Nothing acts on these rows yet.
--
-- comment_text / file_id / timecode_seconds are NULL on arrival: Frame.io's
-- payload only carries IDs. They are filled once the Hub holds a Frame.io
-- connection (frameio_connection) and can look the comment up.
-- ============================================================

create table if not exists public.frameio_webhook_events (
  id                uuid primary key default gen_random_uuid(),
  received_at       timestamptz not null default now(),
  event_type        text not null,            -- e.g. comment.created
  resource_type     text,                     -- e.g. comment
  resource_id       text,                     -- Frame.io ID of the comment/file
  account_id        text,
  workspace_id      text,
  project_id        text,
  user_id           text,                     -- Frame.io user who triggered it
  payload           jsonb not null,           -- full body, verbatim
  comment_text      text,                     -- filled after lookup
  file_id           text,                     -- filled after lookup
  timecode_seconds  numeric,                  -- filled after lookup
  processed_at      timestamptz,
  process_error     text
);

comment on table public.frameio_webhook_events is
  'Raw Frame.io webhook payloads (comment.* first). Written by /api/frameio/webhook.';

create index if not exists frameio_webhook_events_received_idx
  on public.frameio_webhook_events (received_at desc);
create index if not exists frameio_webhook_events_resource_idx
  on public.frameio_webhook_events (resource_id);
create index if not exists frameio_webhook_events_unprocessed_idx
  on public.frameio_webhook_events (received_at) where processed_at is null;

alter table public.frameio_webhook_events enable row level security;

drop policy if exists frameio_webhook_events_staff_all on public.frameio_webhook_events;
create policy frameio_webhook_events_staff_all on public.frameio_webhook_events
  for all to authenticated
  using (public.is_postgame_staff())
  with check (public.is_postgame_staff());
