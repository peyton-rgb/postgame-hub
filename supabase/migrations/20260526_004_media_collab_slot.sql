-- ============================================================
-- Migration: media_collab_slot
-- Adds a feed/reel "slot" label to collab media stored in the
-- existing media table (drive_file_id = 'collab:<container-id>').
-- No new table; reuses the established collab media convention.
-- Applied to project xqaybwhpgxillpbbqtks (POSTGAME HUB).
-- ============================================================

alter table public.media add column if not exists slot text;

alter table public.media drop constraint if exists media_slot_check;
alter table public.media add constraint media_slot_check
  check (slot is null or slot in ('feed','reel'));

-- speeds up "give me this container's feed/reel media in order"
create index if not exists idx_media_collab_slot
  on public.media (drive_file_id, slot, sort_order)
  where drive_file_id like 'collab:%';
