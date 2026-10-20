-- ============================================================
-- 088 — campaign_pages: the drafts behind a campaign's "Athlete pages"
-- and "Brand & team" rows (athlete contract, deal page, posting
-- instructions, creator brief, recap).
--
-- One row per campaign per kind. `content` is the draft itself as JSON
-- (the shape is owned by src/lib/admin/campaigns/page-drafts.ts);
-- `filled_from` lists the sources the draft was pre-filled from
-- ("Opt-in page", "SOW", ...) so the editor can show the "filled from"
-- bar honestly; `variant` is the template variant (contract: standard
-- or event).
--
-- The /admin/campaigns/[id]/{contract,deal,posting,brief,recap} screens
-- feature-detect this table: before it is applied they still render the
-- pre-filled draft and say saving needs this migration.
--
-- NOT applied anywhere yet. File only. Apply with apply_migration.
-- ============================================================

create table if not exists public.campaign_pages (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  bigint not null references public.campaigns(campaign_id) on delete cascade,
  kind         text not null check (kind in ('contract', 'deal', 'posting', 'brief', 'recap')),
  status       text not null default 'draft' check (status in ('draft', 'live')),
  variant      text,
  content      jsonb not null default '{}'::jsonb,
  filled_from  jsonb not null default '[]'::jsonb,
  updated_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (campaign_id, kind)
);

comment on table public.campaign_pages is 'Per-campaign page drafts: athlete contract, deal page, posting instructions, creator brief, recap. One row per campaign per kind; content is the draft as JSON.';
comment on column public.campaign_pages.kind is 'contract | deal | posting | brief | recap';
comment on column public.campaign_pages.status is 'draft until published; live once the page is published to the app / web.';
comment on column public.campaign_pages.variant is 'Template variant. Contract: standard | event.';
comment on column public.campaign_pages.content is 'The draft fields as JSON. Shape per kind lives in src/lib/admin/campaigns/page-drafts.ts.';
comment on column public.campaign_pages.filled_from is 'Array of source labels the draft was pre-filled from, e.g. ["Opt-in page","SOW"].';

create index if not exists campaign_pages_campaign_id_idx on public.campaign_pages (campaign_id);

alter table public.campaign_pages enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_pages' and policyname = 'campaign_pages_staff_all') then
    create policy campaign_pages_staff_all on public.campaign_pages
      for all to authenticated using (public.is_postgame_staff()) with check (public.is_postgame_staff());
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'campaign_pages_set_updated_at' and tgrelid = 'public.campaign_pages'::regclass) then
    create trigger campaign_pages_set_updated_at before update on public.campaign_pages
      for each row execute function public.set_updated_at();
  end if;
end $$;
