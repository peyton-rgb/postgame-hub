-- Cache of pstgm.com admin campaigns — source of truth for campaign id <-> name <-> brand.
-- Read by the recap-intake cron (src/lib/admin-campaigns.ts) to validate Slack requests.
-- Seeded from a CSV export (pstgm_admin_campaigns_full.csv, ~589 rows); a scheduled live
-- sync can repopulate it later without code changes. Not seeded in this migration — data
-- load is env-specific and done via the service client.
create table if not exists public.admin_campaigns (
  admin_id  integer primary key,
  name      text not null,
  brand     text,
  status    text,
  synced_at timestamptz not null default now()
);

alter table public.admin_campaigns enable row level security;
-- No policies: service-role only (the cron bypasses RLS; anon/authenticated blocked).

comment on table public.admin_campaigns is
  'Cache of pstgm.com admin campaigns (source of truth for campaign id <-> name <-> brand). Seeded from a CSV export; refreshed by manual re-seed or a later scheduled scraper. Read by the recap-intake cron via service role.';
