-- De-dupes recap-intake FLAG posts to #campaign-recaps: one row per Slack list item
-- already flagged, so the 10-min cron never re-posts the same flag.
-- Written by the recap-intake cron (src/lib/recap-intake.ts: postFlagOnce) via service role.
create table if not exists public.recap_intake_flags (
  item_id     text primary key,   -- Slack list item id (stable per row)
  campaign_id text,
  reasons     text,
  flagged_at  timestamptz not null default now()
);

alter table public.recap_intake_flags enable row level security;
-- No policies: service-role only.

comment on table public.recap_intake_flags is
  'De-dupes recap-intake FLAG posts: one row per Slack list item already flagged to #campaign-recaps, so the 10-min cron never re-posts the same flag. Written by the recap-intake cron via service role.';
