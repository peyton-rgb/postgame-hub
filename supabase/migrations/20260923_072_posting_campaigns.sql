-- posting_campaigns: one row per posting campaign, holding everything its
-- athletes share (tag handle, hashtag, FTC note, invoice address, and the list
-- of deliverable types with their walkthroughs). posting_packages rows point at
-- it and say which deliverable they are.
--
-- WHY. Until now every posting_packages row carried its own copy of the shared
-- campaign copy (ftc_note, mentions, hashtags, platform_notes). The athlete page
-- (/deliver/[token]) needs the campaign-level fields in one place, and the
-- Phase 2 staff editor needs one row to edit instead of 44.
--
-- campaign_id IS DELIBERATELY UNCONSTRAINED. The brief points it at `campaigns`,
-- but that is a VIEW and cannot be a foreign-key target. The two real tables
-- behind it are name twins (campaign_recaps vs brand_campaigns — and
-- posting_packages.campaign_id already references brand_campaigns, not
-- campaign_recaps). Which one this should link to is an open decision, so the
-- column stays a plain nullable uuid and is left empty. Add the FK in the
-- migration that makes that call.
--
-- deliverable_key has no CHECK. Valid keys are whatever the campaign's
-- `deliverables` list defines ('reel' / 'feed' for Cane's); a fixed list here
-- would need a migration for every new campaign shape.
--
-- RLS: on, staff only via public.is_staff() — the product-table convention
-- (20260905 rls_staff_only_group1, 20260909_051). NO anon policy. The athlete
-- page reads this table server-side on the service-role client, which bypasses
-- RLS, so anon never needs a path to it.
--
-- BACKFILL. Cane's (brand b4f26813-c443-4a7a-b423-1e8132d070c3) gets its row.
-- The 44 packages are identified by the 'CANES-FB-2026' tag at the start of
-- am_notes, and the deliverable by the REEL / FEED word after it. Expected:
-- 22 reel, 22 feed. The campaign-level ftc_note is the Reel rows' text, which
-- is the longer of the two variants loaded on 2026-09-01/02.

begin;

create table if not exists public.posting_campaigns (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.brands(id),
  campaign_id    uuid null,  -- intentionally no FK yet; see header
  title          text,
  season_label   text,
  tag_handle     text,
  hashtag        text,
  ftc_note       text,
  invoice_email  text,
  deliverables   jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists posting_campaigns_brand_id_idx
  on public.posting_campaigns (brand_id);

drop trigger if exists posting_campaigns_set_updated_at on public.posting_campaigns;
create trigger posting_campaigns_set_updated_at
  before update on public.posting_campaigns
  for each row execute function public.set_updated_at();

alter table public.posting_campaigns enable row level security;

drop policy if exists "posting_campaigns_staff_all" on public.posting_campaigns;
create policy "posting_campaigns_staff_all"
  on public.posting_campaigns
  for all
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

alter table public.posting_packages
  add column if not exists posting_campaign_id uuid references public.posting_campaigns(id),
  add column if not exists deliverable_key text;

create index if not exists posting_packages_posting_campaign_id_idx
  on public.posting_packages (posting_campaign_id);

-- ---- backfill: Raising Cane's, Fall 2026 --------------------------------

with canes as (
  insert into public.posting_campaigns
    (brand_id, title, season_label, tag_handle, hashtag, ftc_note, invoice_email, deliverables)
  values (
    'b4f26813-c443-4a7a-b423-1e8132d070c3',
    'Caniac Ambassador',
    'Fall 2026',
    'raisingcanes',
    'CaniacAmbassador',
    'Turn on the paid partnership label and add Raising Cane''s as the brand partner. It shows as Pending — that is expected.',
    'aaron@pstgm.com',
    '[
      {"key":"reel","label":"Reel","order":1,"files":["video","cover"],"platforms":["instagram_reel","tiktok"],"walkthrough":"instagram-reel-canes-2026"},
      {"key":"feed","label":"Feed post","order":2,"files":["photo"],"platforms":["instagram_feed"],"walkthrough":null}
    ]'::jsonb
  )
  returning id
)
update public.posting_packages pp
set posting_campaign_id = canes.id,
    deliverable_key = case
      when pp.am_notes ~ '^CANES-FB-2026 REEL' then 'reel'
      when pp.am_notes ~ '^CANES-FB-2026 FEED' then 'feed'
    end
from canes
where pp.am_notes ~ '^CANES-FB-2026 (REEL|FEED)';

commit;
