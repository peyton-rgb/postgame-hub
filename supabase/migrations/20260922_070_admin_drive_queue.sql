-- Campaign handoffs that arrived before the Hub had the campaign.
--
-- Brief 15 §1b. A campaign created in CF today reaches the Hub on tomorrow's
-- 10:45 sync. The admin should not have to retry, and should not have to know
-- the Hub's schedule — so a handoff for a campaign the Hub cannot see yet is
-- ACCEPTED (202) and parked here. The nightly campaign sync applies it once the
-- row appears.
--
-- Keyed on cf_campaign_id + admin_account_id because that pair is what the
-- admin knows; the Hub's own uuid does not exist yet by definition.
--
-- APPLIED to the recap-editor-test branch (jlxdxuqfmnnpwvmozgmm) on 2026-09-22.
-- NOT applied to production.

create table if not exists public.admin_drive_queue (
  id                uuid primary key default gen_random_uuid(),
  cf_campaign_id    text not null,
  admin_account_id  text not null,
  -- The whole handoff body, replayed verbatim when the campaign appears.
  payload           jsonb not null,
  status            text not null default 'queued'
                      check (status in ('queued','applied','failed')),
  attempts          integer not null default 0,
  last_error        text,
  applied_at        timestamptz,
  applied_campaign_id uuid references public.campaign_recaps(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One live queue entry per campaign. A repeated handoff for a campaign still
-- missing updates the parked payload rather than stacking duplicates — that is
-- what makes the 202 path idempotent too.
create unique index if not exists admin_drive_queue_pending_key
  on public.admin_drive_queue (cf_campaign_id, admin_account_id)
  where status = 'queued';

create index if not exists admin_drive_queue_status_idx
  on public.admin_drive_queue (status, created_at);

alter table public.admin_drive_queue enable row level security;

create policy "Service role manages admin drive queue"
  on public.admin_drive_queue for all to service_role using (true) with check (true);
create policy "Authenticated users can view admin drive queue"
  on public.admin_drive_queue for select to authenticated using (true);
